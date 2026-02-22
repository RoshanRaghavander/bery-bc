import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { EthereumProvider } from '@walletconnect/ethereum-provider';

export const CHAIN_ID = 8379;
export const RPC_URL = typeof window !== 'undefined'
  ? (import.meta.env.VITE_RPC_URL || `${window.location.origin}/rpc`)
  : '';

export function useWallet() {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [type, setType] = useState<'metamask' | 'walletconnect' | null>(null);
  const [wcProvider, setWcProvider] = useState<EthereumProvider | null>(null);

  const connectMetaMask = useCallback(async () => {
    if (!(window as any).ethereum) throw new Error('MetaMask not installed');
    const p = new ethers.BrowserProvider((window as any).ethereum);
    const accounts = await p.send('eth_requestAccounts', []);
    const network = await p.getNetwork();
    setProvider(p);
    setAddress(accounts[0]);
    setChainId(Number(network.chainId));
    setType('metamask');
  }, []);

  const connectWalletConnect = useCallback(async () => {
    const wc = await EthereumProvider.init({
      projectId: 'fe646570fb3c8caf4c2aef5ead54ba66',
      chains: [CHAIN_ID],
      optionalChains: [CHAIN_ID],
      showQrModal: true,
      rpcMap: { [CHAIN_ID]: RPC_URL },
    });
    await wc.connect();
    const p = new ethers.BrowserProvider(wc);
    const accounts = await p.listAccounts();
    const network = await p.getNetwork();
    setProvider(p);
    setAddress(accounts[0]?.address ?? null);
    setChainId(Number(network.chainId));
    setType('walletconnect');
    setWcProvider(wc);
  }, []);

  const disconnect = useCallback(() => {
    if (wcProvider) wcProvider.disconnect();
    setProvider(null);
    setAddress(null);
    setChainId(null);
    setType(null);
    setWcProvider(null);
  }, [wcProvider]);

  const ensureChain = useCallback(async () => {
    if (!(window as any).ethereum || type !== 'metamask') return;
    try {
      await (window as any).ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
      });
    } catch (e: any) {
      if (e.code === 4902) {
        await (window as any).ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: `0x${CHAIN_ID.toString(16)}`,
            chainName: 'Bery',
            nativeCurrency: { name: 'BRY', symbol: 'BRY', decimals: 18 },
            rpcUrls: [RPC_URL],
          }],
        });
      }
    }
  }, [type]);

  useEffect(() => {
    if (type === 'metamask' && (window as any).ethereum) {
      (window as any).ethereum.on('accountsChanged', (accounts: string[]) => {
        setAddress(accounts[0] ?? null);
      });
      (window as any).ethereum.on('chainChanged', () => window.location.reload());
    }
  }, [type]);

  return { provider, address, chainId, type, connectMetaMask, connectWalletConnect, disconnect, ensureChain };
}
