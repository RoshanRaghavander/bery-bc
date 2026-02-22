import BN from 'bn.js';
import { StateManager as AppState } from '../state/state_manager.js';

export interface CallParams {
  from?: string;
  to: string;
  data?: string;
  value?: string;
  gas?: string | number;
}

export async function createVM(chainId: number) {
  const dynImport: any = (new Function('m', 'return import(m)')) as (m: string) => Promise<any>;
  const vmMod: any = await dynImport('@ethereumjs/vm');
  const commonMod: any = await dynImport('@ethereumjs/common');
  const { VM } = vmMod;
  const { Common } = commonMod;
  const common = new Common({ chainId, hardfork: 'shanghai' } as any);
  const vm = await VM.create({ common });
  return vm;
}

async function hydrateAccount(vm: any, appState: AppState, addrHex: string) {
  const utilMod: any = await import('@ethereumjs/util');
  const { Address, Account } = utilMod;
  const addr = Address.fromString('0x' + addrHex);
  const acc = await appState.getAccount(addrHex);
  const ethAcc = new Account();
  ethAcc.balance = BigInt(acc.balance.toString());
  ethAcc.nonce = BigInt(acc.nonce.toString());
  await vm.stateManager.putAccount(addr, ethAcc);
  if (acc.codeHash && !acc.codeHash.equals(Buffer.alloc(32))) {
    const code = await appState.getCode(acc.codeHash);
    if (code) {
      await vm.stateManager.putContractCode(addr, code);
    }
  }
  const storage = await appState.dumpContractStorage(addrHex);
  for (const [kHex, vHex] of Object.entries(storage)) {
    await vm.stateManager.putContractStorage(addr, Buffer.from(kHex, 'hex'), Buffer.from(vHex, 'hex'));
  }
  return addr;
}

export async function evmCall(appState: AppState, chainId: number, params: CallParams) {
  const vm = await createVM(chainId);
  const dynImport: any = (new Function('m', 'return import(m)')) as (m: string) => Promise<any>;
  const utilMod: any = await dynImport('@ethereumjs/util');
  const { Address } = utilMod;
  const toAddr = await hydrateAccount(vm, appState, params.to.replace('0x', ''));
  const fromHex = (params.from || '0x' + '0'.repeat(40)).replace('0x', '');
  const fromAddr = await hydrateAccount(vm, appState, fromHex);
  const dataBuf = params.data ? Buffer.from(params.data.replace('0x', ''), 'hex') : Buffer.alloc(0);
  const valueWei = params.value ? new BN(params.value.replace('0x', ''), 'hex') : new BN(0);
  const gasLimit = typeof params.gas === 'number' ? BigInt(params.gas) : params.gas ? BigInt(parseInt((params.gas as string), 16)) : BigInt(10000000);

  const res = await vm.evm.runCall({
    to: toAddr,
    caller: fromAddr,
    value: BigInt(valueWei.toString()),
    data: dataBuf,
    gasLimit
  } as any);

  const ret = Buffer.from(res.execResult.returnValue);
  const gasUsed = Number(res.totalGasSpent ?? res.gasUsed ?? 0);
  const logs = (res.execResult.logs || []).map((l: any) => ({
    address: l[0].toString(),
    topics: l[1].map((t: any) => '0x' + Buffer.from(t).toString('hex')),
    data: '0x' + Buffer.from(l[2]).toString('hex')
  }));
  return { returnData: '0x' + ret.toString('hex'), gasUsed, logs };
}

/** Persist VM state (accounts, code, storage) back to app state for from and to addresses */
async function persistVmState(vm: any, appState: AppState, fromHex: string, toHex: string) {
  const { Hash } = await import('../crypto/hash.js');
  const utilMod: any = await import('@ethereumjs/util');
  const { Address } = utilMod;

  for (const addrHex of [fromHex, toHex]) {
    if (!addrHex || addrHex.length !== 40) continue;
    const addr = Address.fromString('0x' + addrHex);
    const ethAcc = await vm.stateManager.getAccount(addr);
    if (!ethAcc) continue;

    const acc = await appState.getAccount(addrHex);
    acc.balance = new BN(ethAcc.balance.toString());
    acc.nonce = new BN(ethAcc.nonce.toString());
    await appState.putAccount(addrHex, acc);

    const code = await vm.stateManager.getContractCode(addr);
    if (code && code.length > 0) {
      const codeHash = Hash.keccak256(code);
      await appState.putCode(codeHash, code);
      acc.codeHash = codeHash;
      await appState.putAccount(addrHex, acc);
    }

    try {
      const dump = await vm.stateManager.dumpStorage(addr);
      for (const [kHex, vHex] of Object.entries(dump)) {
        await appState.putContractStorage(addrHex, Buffer.from(kHex, 'hex'), Buffer.from(vHex as string, 'hex'));
      }
    } catch (_) { /* dumpStorage may fail on some implementations */ }
  }
}

/** Like evmCall but persists state changes back to app state (for tx execution) */
export async function evmCallWithPersist(appState: AppState, chainId: number, params: CallParams) {
  const vm = await createVM(chainId);
  const utilMod: any = await import('@ethereumjs/util');
  const { Address } = utilMod;
  const toHex = params.to.replace('0x', '');
  const fromHex = (params.from || '0x' + '0'.repeat(40)).replace('0x', '');
  await hydrateAccount(vm, appState, toHex);
  await hydrateAccount(vm, appState, fromHex);
  const dataBuf = params.data ? Buffer.from(params.data.replace('0x', ''), 'hex') : Buffer.alloc(0);
  const valueWei = params.value ? new BN(params.value.replace('0x', ''), 'hex') : new BN(0);
  const gasLimit = typeof params.gas === 'number' ? BigInt(params.gas) : params.gas ? BigInt(parseInt((params.gas as string), 16)) : BigInt(10000000);

  const res = await vm.evm.runCall({
    to: Address.fromString('0x' + toHex),
    caller: Address.fromString('0x' + fromHex),
    value: BigInt(valueWei.toString()),
    data: dataBuf,
    gasLimit
  } as any);

  await persistVmState(vm, appState, fromHex, toHex);

  const ret = Buffer.from(res.execResult.returnValue);
  const gasUsed = Number(res.totalGasSpent ?? res.gasUsed ?? 0);
  const logs = (res.execResult.logs || []).map((l: any) => ({
    address: l[0].toString(),
    topics: l[1].map((t: any) => '0x' + Buffer.from(t).toString('hex')),
    data: '0x' + Buffer.from(l[2]).toString('hex')
  }));
  return { returnData: '0x' + ret.toString('hex'), gasUsed, logs };
}

export async function evmEstimateGas(appState: AppState, chainId: number, params: CallParams) {
  const res = await evmCall(appState, chainId, params);
  // Basic heuristic: gasUsed plus call overhead
  const estimated = Math.max(res.gasUsed, 21000);
  return '0x' + estimated.toString(16);
}

export async function evmCreate(appState: AppState, chainId: number, params: { from: string; initCode: string; value?: string; gas?: string | number }) {
  const vm = await createVM(chainId);
  const dynImport: any = (new Function('m', 'return import(m)')) as (m: string) => Promise<any>;
  const utilMod: any = await dynImport('@ethereumjs/util');
  const { Address, Account } = utilMod;
  const fromHex = params.from.replace('0x', '');
  const fromAddr = await hydrateAccount(vm, appState, fromHex);
  const initBuf = Buffer.from(params.initCode.replace('0x', ''), 'hex');
  const valueWei = params.value ? new BN(params.value.replace('0x', ''), 'hex') : new BN(0);
  const gasLimit = typeof params.gas === 'number' ? BigInt(params.gas) : params.gas ? BigInt(parseInt((params.gas as string), 16)) : BigInt(10000000);

  const res = await vm.evm.runCode({
    code: initBuf,
    caller: fromAddr,
    gasLimit,
    value: BigInt(valueWei.toString()),
    data: Buffer.alloc(0)
  } as any);

  const runtime = Buffer.from(res.execResult.returnValue);
  const gasUsed = Number(res.totalGasSpent ?? res.gasUsed ?? 0);
  const logs = (res.execResult.logs || []).map((l: any) => ({
    address: l[0].toString(),
    topics: l[1].map((t: any) => '0x' + Buffer.from(t).toString('hex')),
    data: '0x' + Buffer.from(l[2]).toString('hex')
  }));
  return { runtimeCode: runtime, gasUsed, logs };
}
