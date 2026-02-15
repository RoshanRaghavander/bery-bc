let currentWallet = null;
let connectedWalletAddress = null;

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = text;
  }
}

function setStatus(id, message, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message || "";
  el.classList.remove("success", "error", "neutral");
  el.classList.add(type || "neutral");
}

async function apiGet(path) {
  const res = await fetch(path, {
    method: "GET",
    headers: {
      Accept: "application/json"
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data && data.error ? data.error : "Request failed";
    throw new Error(msg);
  }
  return data;
}

async function apiPost(path, body, extraHeaders) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json"
  };
  if (extraHeaders) {
    for (const k of Object.keys(extraHeaders)) {
      headers[k] = extraHeaders[k];
    }
  }
  const res = await fetch(path, {
    method: "POST",
    headers,
    body: JSON.stringify(body || {})
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data && data.error ? data.error : "Request failed";
    throw new Error(msg);
  }
  return data;
}

async function loadNetworkInfo() {
  try {
    const info = await apiGet("/v1/chain/info");
    const parts = [];
    if (info.name && info.symbol) {
      parts.push(info.name + " (" + info.symbol + ")");
    }
    if (typeof info.height === "number") {
      parts.push("Height " + info.height);
    }
    if (typeof info.peers === "number") {
      parts.push(info.peers + " peer" + (info.peers === 1 ? "" : "s"));
    }
    if (info.chainId) {
      parts.push("Chain ID " + info.chainId);
    }
    setText("network-info", parts.join(" • "));
  } catch (e) {
    setText("network-info", "Could not load chain info");
  }
}

async function handleCreateWallet() {
  const btn = document.getElementById("btn-create-wallet");
  if (!btn) return;
  btn.disabled = true;
  setStatus("wallet-status", "Creating wallet...", "neutral");
  try {
    const data = await apiPost("/wallet/create", {});
    currentWallet = {
      address: data.address,
      privateKey: data.privateKey
    };
    setText("wallet-address", data.address || "Unknown");
    setText("wallet-private", "Hidden");
    const addrInput = document.getElementById("faucet-address");
    const balInput = document.getElementById("balance-address");
    if (addrInput && !addrInput.value && data.address) {
      addrInput.value = data.address;
    }
    if (balInput && !balInput.value && data.address) {
      balInput.value = data.address;
    }
    const toggle = document.getElementById("btn-toggle-priv");
    const copy = document.getElementById("btn-copy-addr");
    if (toggle) toggle.disabled = false;
    if (copy) copy.disabled = false;
    setStatus("wallet-status", "Wallet created", "success");
  } catch (e) {
    setStatus("wallet-status", e.message || "Failed to create wallet", "error");
  } finally {
    btn.disabled = false;
  }
}

function handleTogglePrivate() {
  const box = document.getElementById("wallet-private");
  const btn = document.getElementById("btn-toggle-priv");
  if (!box || !btn) return;
  if (!currentWallet || !currentWallet.privateKey) {
    box.textContent = "No wallet yet";
    return;
  }
  const showing = box.dataset.showing === "true";
  if (showing) {
    box.textContent = "Hidden";
    box.dataset.showing = "false";
    btn.textContent = "Show";
  } else {
    box.textContent = currentWallet.privateKey;
    box.dataset.showing = "true";
    btn.textContent = "Hide";
  }
}

async function handleCopyAddress() {
  if (!currentWallet || !currentWallet.address) return;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(currentWallet.address);
      setStatus("wallet-status", "Address copied to clipboard", "success");
    } else {
      setStatus("wallet-status", "Clipboard not available", "error");
    }
  } catch (e) {
    setStatus("wallet-status", "Failed to copy address", "error");
  }
}

async function handleFaucet() {
  const addrInput = document.getElementById("faucet-address");
  const amountInput = document.getElementById("faucet-amount");
  const tokenInput = document.getElementById("faucet-token");
  const btn = document.getElementById("btn-faucet");
  if (!addrInput || !amountInput || !tokenInput || !btn) return;
  const address = addrInput.value.trim();
  const amount = amountInput.value.trim();
  const token = tokenInput.value.trim();
  if (!address) {
    setStatus("faucet-status", "Address is required", "error");
    return;
  }
  btn.disabled = true;
  setStatus("faucet-status", "Requesting funds...", "neutral");
  try {
    const body = { address: address };
    if (amount) {
      body.amount = amount;
    }
    const extraHeaders = {};
    if (token) {
      extraHeaders["x-faucet-token"] = token;
    }
    const res = await apiPost("/v1/faucet", body, extraHeaders);
    const hash = res.hash || (res.success && res.hash) || null;
    setStatus("faucet-status", res.message || "Faucet transaction sent" + (hash ? " (" + hash + ")" : ""), "success");
    const balanceAddressInput = document.getElementById("balance-address");
    if (balanceAddressInput && !balanceAddressInput.value) {
      balanceAddressInput.value = address;
    }
    if (balanceAddressInput) {
      await refreshBalance(balanceAddressInput.value.trim());
    }
  } catch (e) {
    setStatus("faucet-status", e.message || "Faucet request failed", "error");
  } finally {
    btn.disabled = false;
  }
}

async function refreshBalance(address) {
  const addr = address && address.trim();
  if (!addr) {
    setStatus("faucet-status", "Address required to check balance", "error");
    return;
  }
  try {
    const data = await apiGet("/v1/account/" + addr);
    setText("balance-value", data.balance != null ? data.balance : "-");
    setText("balance-nonce", data.nonce != null ? data.nonce : "-");
    setStatus("faucet-status", "Balance updated", "success");
  } catch (e) {
    setStatus("faucet-status", e.message || "Failed to load balance", "error");
  }
}

async function handleCheckBalance() {
  const input = document.getElementById("balance-address");
  if (!input) return;
  await refreshBalance(input.value);
}

async function handleSendFromValidator() {
  const recipientInput = document.getElementById("send-recipient");
  const amountInput = document.getElementById("send-amount");
  const tokenInput = document.getElementById("send-token");
  const btn = document.getElementById("btn-send");
  if (!recipientInput || !amountInput || !tokenInput || !btn) return;
  const address = recipientInput.value.trim();
  const amount = amountInput.value.trim();
  const token = tokenInput.value.trim();
  if (!address) {
    setStatus("send-status", "Recipient address is required", "error");
    return;
  }
  if (!amount) {
    setStatus("send-status", "Amount is required", "error");
    return;
  }
  btn.disabled = true;
  setStatus("send-status", "Sending transaction from validator...", "neutral");
  try {
    const body = { address: address, amount: amount };
    const extraHeaders = {};
    if (token) {
      extraHeaders["x-faucet-token"] = token;
    }
    const res = await apiPost("/v1/faucet", body, extraHeaders);
    const hash = res.hash || null;
    if (hash) {
      setText("send-hash", hash);
    }
    setStatus("send-status", res.message || "Transaction broadcasted", "success");
  } catch (e) {
    setStatus("send-status", e.message || "Failed to send transaction", "error");
  } finally {
    btn.disabled = false;
  }
}

async function connectBrowserWallet() {
  const statusId = "stake-status";
  if (typeof window === "undefined" || !window.ethereum) {
    setStatus(statusId, "No browser wallet detected (window.ethereum not found)", "error");
    return;
  }
  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    if (!accounts || !accounts.length) {
      setStatus(statusId, "No accounts returned from wallet", "error");
      return;
    }
    connectedWalletAddress = accounts[0];
    setText("stake-wallet-address", connectedWalletAddress);
    setStatus(statusId, "Wallet connected", "success");
  } catch (e) {
    setStatus(statusId, e && e.message ? e.message : "Failed to connect wallet", "error");
  }
}

function toHexWei(amountStr) {
  const trimmed = (amountStr || "").trim();
  if (!trimmed) return null;
  try {
    const big = BigInt(trimmed);
    if (big < 0n) return null;
    return "0x" + big.toString(16);
  } catch {
    return null;
  }
}

function encodeUnstakeData(amountStr) {
  const trimmed = (amountStr || "").trim();
  if (!trimmed) return null;
  try {
    const big = BigInt(trimmed);
    if (big < 0n) return null;
    let hex = big.toString(16);
    if (hex.length > 64) return null;
    while (hex.length < 64) {
      hex = "0" + hex;
    }
    return "0x02" + hex;
  } catch {
    return null;
  }
}

async function handleStake() {
  const statusId = "stake-status";
  const hashBoxId = "stake-hash";
  const amountInput = document.getElementById("stake-amount");
  if (!amountInput) return;
  if (!window.ethereum) {
    setStatus(statusId, "No browser wallet detected (window.ethereum not found)", "error");
    return;
  }
  if (!connectedWalletAddress) {
    setStatus(statusId, "Connect your wallet first", "error");
    return;
  }
  const valueHex = toHexWei(amountInput.value);
  if (!valueHex) {
    setStatus(statusId, "Enter a valid non-negative amount in wei", "error");
    return;
  }
  setStatus(statusId, "Sending stake transaction...", "neutral");
  try {
    const tx = {
      from: connectedWalletAddress,
      to: "0x0000000000000000000000000000000000000100",
      value: valueHex,
      data: "0x01"
    };
    const txHash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [tx]
    });
    if (txHash) {
      setText(hashBoxId, txHash);
    }
    setStatus(statusId, "Stake transaction sent", "success");
  } catch (e) {
    setStatus(statusId, e && e.message ? e.message : "Failed to send stake transaction", "error");
  }
}

async function handleUnstake() {
  const statusId = "stake-status";
  const hashBoxId = "stake-hash";
  const amountInput = document.getElementById("unstake-amount");
  if (!amountInput) return;
  if (!window.ethereum) {
    setStatus(statusId, "No browser wallet detected (window.ethereum not found)", "error");
    return;
  }
  if (!connectedWalletAddress) {
    setStatus(statusId, "Connect your wallet first", "error");
    return;
  }
  const dataHex = encodeUnstakeData(amountInput.value);
  if (!dataHex) {
    setStatus(statusId, "Enter a valid non-negative unstake amount in wei", "error");
    return;
  }
  setStatus(statusId, "Sending unstake transaction...", "neutral");
  try {
    const tx = {
      from: connectedWalletAddress,
      to: "0x0000000000000000000000000000000000000100",
      value: "0x0",
      data: dataHex
    };
    const txHash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [tx]
    });
    if (txHash) {
      setText(hashBoxId, txHash);
    }
    setStatus(statusId, "Unstake transaction sent", "success");
  } catch (e) {
    setStatus(statusId, e && e.message ? e.message : "Failed to send unstake transaction", "error");
  }
}

function init() {
  const createBtn = document.getElementById("btn-create-wallet");
  const toggleBtn = document.getElementById("btn-toggle-priv");
  const copyBtn = document.getElementById("btn-copy-addr");
  const faucetBtn = document.getElementById("btn-faucet");
  const balanceBtn = document.getElementById("btn-check-balance");
  const sendBtn = document.getElementById("btn-send");
  const connectWalletBtn = document.getElementById("btn-connect-wallet");
  const stakeBtn = document.getElementById("btn-stake");
  const unstakeBtn = document.getElementById("btn-unstake");
  if (createBtn) createBtn.addEventListener("click", handleCreateWallet);
  if (toggleBtn) toggleBtn.addEventListener("click", handleTogglePrivate);
  if (copyBtn) copyBtn.addEventListener("click", handleCopyAddress);
  if (faucetBtn) faucetBtn.addEventListener("click", handleFaucet);
  if (balanceBtn) balanceBtn.addEventListener("click", handleCheckBalance);
  if (sendBtn) sendBtn.addEventListener("click", handleSendFromValidator);
  if (connectWalletBtn) connectWalletBtn.addEventListener("click", connectBrowserWallet);
  if (stakeBtn) stakeBtn.addEventListener("click", handleStake);
  if (unstakeBtn) unstakeBtn.addEventListener("click", handleUnstake);
  loadNetworkInfo();
}

document.addEventListener("DOMContentLoaded", init);
