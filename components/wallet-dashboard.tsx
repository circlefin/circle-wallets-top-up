/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

"use client";

import { Button } from "@/components/ui/button";
import { useAccount, useConnections } from "wagmi";
import { ConnectWallet } from "@/components/connect-wallet";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { ChainBalance } from "@/lib/chain-config";
import { AlertCircleIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator"
import { TransactionHistory } from "@/components/transaction-history";
import { toast } from "sonner";
import { Copy, RefreshCw, Info, ArrowLeftRight } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CHAIN_NAMES } from "@/lib/chain-config";

type SupportedChain = "arcTestnet" | "baseSepolia" | "avalancheFuji";

export function WalletDashboard() {
  const [isMounted, setIsMounted] = useState(false);

  const [hasCircleWallet, setHasCircleWallet] = useState(false);
  const [circleWalletAddresses, setCircleWalletAddresses] = useState<string[]>([]);
  const [isCheckingCircleWallet, setIsCheckingCircleWallet] = useState(true);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const initializeWallets = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Initialize EOA wallets for Gateway signing
        try {
          await fetch("/api/gateway/init-eoa-wallets", { method: "POST" });
        } catch (error) {
          console.error("Failed to initialize EOA wallets:", error);
        }

        // Check for Circle Wallet (exclude EOA signer wallets from UI)
        const { data, error } = await supabase
          .from("wallets")
          .select("wallet_address, type")
          .eq("user_id", user.id)
          .neq("type", "gateway_signer"); // Exclude EOA signer wallets

        if (data && data.length > 0 && !error) {
          setHasCircleWallet(true);
          setCircleWalletAddresses(data.map(w => w.wallet_address));
        } else {
          setHasCircleWallet(false);
          setCircleWalletAddresses([]);
        }
      }
      setIsCheckingCircleWallet(false);
    };
    initializeWallets();
  }, []);

  const { isConnected, isConnecting } = useAccount();
  const connections = useConnections();

  // Create a unified list of all wallet addresses (from wagmi and Circle)
  const allWalletAddresses = useMemo(() => {
    const wagmiAddresses = connections.map((conn) => conn.accounts).flat();
    return Array.from(new Set([...wagmiAddresses, ...circleWalletAddresses]));
  }, [connections, circleWalletAddresses]);

  // Helper function to format address suffix
  const formatAddressSuffix = (address: string) => {
    if (!address || address.length < 10) return "";
    return `(${address.slice(0, 5)}...${address.slice(-4)})`;
  };

  // Helper function to copy address to clipboard
  const copyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      toast.success("Address Copied", {
        description: "Wallet address copied to clipboard",
      });
    } catch (err) {
      toast.error("Copy Failed", {
        description: "Failed to copy address to clipboard",
      });
    }
  };

  // Helper function to validate amount for deposit (positive number only)
  const isValidDepositAmount = (amount: string): boolean => {
    if (!amount) return false;
    const num = parseFloat(amount);
    return !isNaN(num) && num > 0;
  };

  // Helper function to validate amount for transfer (positive number and sufficient gateway balance)
  const isValidTransferAmount = (amount: string): boolean => {
    if (!amount) return false;
    const num = parseFloat(amount);
    return !isNaN(num) && num > 0 && num <= gatewayBalance;
  };
  const [totalBalance, setTotalBalance] = useState<number | null>(null);
  const [gatewayBalance, setGatewayBalance] = useState<number>(0);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [chainBalances, setChainBalances] = useState<ChainBalance[]>([]);
  const [gatewayChainBalances, setGatewayChainBalances] = useState<ChainBalance[]>([]);
  const [balanceLoading, setBalanceLoading] = useState(true);

  // Deposit state
  const [depositAmount, setDepositAmount] = useState("");
  const [depositLoading, setDepositLoading] = useState(false);

  // Transfer state
  const [sourceChain] = useState<SupportedChain>("arcTestnet");
  const [destinationChain, setDestinationChain] = useState<SupportedChain>("baseSepolia");
  const [transferAmount, setTransferAmount] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);

  // Refetchable balance function
  const fetchBalances = async (showLoadingState = true) => {
    // Wait until the initial wallet check is complete
    if (isCheckingCircleWallet) return;

    if (allWalletAddresses.length === 0) {
      setBalanceLoading(false);
      setTotalBalance(null);
      setGatewayBalance(0);
      setWalletBalance(0);
      setChainBalances([]);
      return;
    }

    if (showLoadingState) {
      setBalanceLoading(true);
    }

    try {
      const response = await fetch("/api/gateway/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses: allWalletAddresses }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }

      const data = await response.json();

      let totalGateway = 0;
      let totalWallet = 0;
      const allGatewayBalances: ChainBalance[] = [];
      const allChainBalances: ChainBalance[] = [];

      data.balances.forEach((b: any) => {
        totalGateway += b.gatewayTotal || 0;
        totalWallet += b.walletTotal || 0;

        if (b.gatewayBalances) {
          allGatewayBalances.push(...b.gatewayBalances);
        }
        if (b.chainBalances) {
          allChainBalances.push(...b.chainBalances);
        }
      });

      setTotalBalance(data.totalUnified);
      setGatewayBalance(totalGateway);
      setWalletBalance(totalWallet);
      setChainBalances(allChainBalances);
      setGatewayChainBalances(allGatewayBalances);
    } catch (err: any) {
      toast.error("Balance Update Failed", {
        description: `Failed to fetch balances: ${err.message}`,
      });
    } finally {
      if (showLoadingState) {
        setBalanceLoading(false);
      }
    }
  };

  // Fetch balances whenever the unified list of addresses changes
  useEffect(() => {
    fetchBalances();
  }, [allWalletAddresses, isCheckingCircleWallet]);

  // Auto-refresh balances every 30 seconds
  useEffect(() => {
    if (allWalletAddresses.length === 0) return;

    const interval = setInterval(() => {
      fetchBalances(false); // Don't show loading state for auto-refresh
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [allWalletAddresses]);

  const handleDeposit = async () => {
    if (!depositAmount) {
      toast.error("Invalid Amount", {
        description: "Please provide an amount to deposit.",
      });
      return;
    }
    if (!hasCircleWallet) {
      toast.error("Missing Credentials", {
        description: "Please provide a private key for your connected wallet.",
      });
      return;
    }

    setDepositLoading(true);
    
    // Show initial progress toast
    const progressToast = toast.loading("Initiating Deposit...", {
      description: "Approving USDC and preparing transaction",
    });
    
    try {
      const payload: any = {
        chain: "arcTestnet",
        amount: depositAmount,
      };

      // Update progress for API call
      toast.loading("Processing Deposit...", {
        id: progressToast,
        description: "Sending transaction to the network",
      });

      const response = await fetch("/api/gateway/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Deposit failed");
      }
      const data = await response.json();

      toast.success("Deposit Successful", {
        id: progressToast,
        description: `Transaction Hash: ${data.txHash}`,
      });

      setDepositAmount("");
      
      // Instantly refresh balance
      await fetchBalances(false);
    } catch (err: any) {
      toast.error("Deposit Failed", {
        description: err.message || "An error occurred during deposit",
      });
    } finally {
      setDepositLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferAmount) {
      toast.error("Invalid Amount", {
        description: "Please provide an amount to transfer.",
      });
      return;
    }
    if (!hasCircleWallet) {
      toast.error("Missing Credentials", {
        description: "Please provide a private key for your connected wallet.",
      });
      return;
    }
    // Same-chain transfers are allowed (withdrawal from Gateway to wallet)
    // Cross-chain transfers will go through Gateway's burn/mint process

    setTransferLoading(true);
    
    // Show initial progress toast
    const progressToast = toast.loading("Initiating Transfer...", {
      description: "Creating burn intent and submitting for attestation",
    });
    
    try {
      const payload: any = {
        sourceChain,
        destinationChain,
        amount: transferAmount,
        recipientAddress: recipientAddress || undefined,
      };

      // Update progress for API call
      toast.loading("Processing Transfer...", {
        id: progressToast,
        description: "Minting USDC on destination chain",
      });

      const response = await fetch("/api/gateway/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = await response.json();
        const errorMessage = error.error || "Transfer failed";

        // Handle insufficient gas error with wallet details
        if (errorMessage === "INSUFFICIENT_GAS" && error.walletAddress) {
          const chainNames: Record<SupportedChain, string> = {
            arcTestnet: "Arc Testnet",
            avalancheFuji: "Avalanche Fuji",
            baseSepolia: "Base Sepolia",
          };
          const nativeTokens: Record<SupportedChain, string> = {
            arcTestnet: "ARC",
            avalancheFuji: "AVAX",
            baseSepolia: "ETH",
          };
          const chainName = chainNames[destinationChain];
          const nativeToken = nativeTokens[destinationChain];
          
          // Dismiss the loading toast
          toast.dismiss(progressToast);
          
          // Show detailed error with copy button for wallet address
          toast.error("Insufficient Gas", {
            description: (
              <div className="space-y-2">
                <p>Your EOA wallet needs {nativeToken} on {chainName} to execute the mint.</p>
                <div className="flex items-center gap-2 bg-muted p-2 rounded text-xs font-mono">
                  <span className="flex-1 truncate">{error.walletAddress}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 p-0"
                    onClick={() => copyAddress(error.walletAddress)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-xs">Send {nativeToken} to this address and try again.</p>
              </div>
            ),
            duration: 10000, // Show for 10 seconds
          });
          return; // Exit early, don't throw
        }
        
        if (errorMessage.includes("insufficient funds for transfer") ||
          errorMessage.includes("exceeds the balance of the account")) {
          const chainNames: Record<SupportedChain, string> = {
            arcTestnet: "Arc Testnet",
            avalancheFuji: "Avalanche Fuji",
            baseSepolia: "Base Sepolia",
          };
          const nativeTokens: Record<SupportedChain, string> = {
            arcTestnet: "ARC",
            avalancheFuji: "AVAX",
            baseSepolia: "ETH",
          };
          const chainName = chainNames[destinationChain];
          const nativeToken = nativeTokens[destinationChain];
          throw new Error(
            `Insufficient gas funds: You need ${nativeToken} on ${chainName} to pay for the minting transaction.`
          );
        } else if (errorMessage.includes("Insufficient balance") || errorMessage.includes("insufficient balance")) {
          throw new Error("Insufficient Gateway balance: You don't have enough USDC in your Gateway balance for this transfer.");
        } else if (errorMessage.includes("Invalid address") || errorMessage.includes("invalid recipient")) {
          throw new Error("Invalid address: Please check the recipient address and try again.");
        } else if (errorMessage.includes("Gateway API error")) {
          const apiErrorMatch = errorMessage.match(/Gateway API error: \d+ - (.+)/);
          if (apiErrorMatch) {
            throw new Error(`Transfer failed: ${apiErrorMatch[1]}`);
          }
          throw new Error(errorMessage);
        } else {
          throw new Error(errorMessage);
        }
      }
      const data = await response.json();

      const successMessage = data.isSameChain 
        ? `Withdrawal Transaction Hash: ${data.withdrawTxHash}`
        : `Mint Transaction Hash: ${data.mintTxHash}`;
      
      toast.success("Transfer Successful", {
        id: progressToast,
        description: successMessage,
      });

      setTransferAmount("");
      setRecipientAddress("");
      
      // Instantly refresh balance
      await fetchBalances(false);
    } catch (err: any) {
      toast.error("Transfer Failed", {
        description: err?.message || "An unexpected error occurred. Please try again.",
      });
    } finally {
      setTransferLoading(false);
    }
  };

  // This prevents the server (disconnected) and client (connected) mismatch
  const userHasWallet = (isMounted && isConnected) || hasCircleWallet;

  return (
    <>
      {/* Disconnected State View */}
      <div className={userHasWallet ? 'hidden' : 'block'}>
        <Card>
          <CardHeader>
            <CardTitle>Wallet Setup</CardTitle>
            <CardDescription>
              Connect your wallet to begin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ConnectWallet />
          </CardContent>
        </Card>
      </div>

      {/* Connected State View */}
      <div className={userHasWallet ? 'block' : 'hidden'}>
        <div className="space-y-6">
          {/* Top Row: Wallet and Balances */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Wallet Setup</CardTitle>
                <CardDescription>
                  Manage your connected wallets.
                  {!hasCircleWallet && " Provide a private key to sign transactions."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ConnectWallet />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>USDC Balance Overview</CardTitle>
                    <CardDescription>
                      Your combined balance across all wallets and chains.
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchBalances()}
                    disabled={balanceLoading}
                  >
                    <RefreshCw className={`h-4 w-4 ${balanceLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {balanceLoading || isConnecting ? (
                  <div className="space-y-4">
                    <Skeleton className="h-8 w-[200px]" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : totalBalance !== null ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        Arc Gateway Balance
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground/70" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[280px]">
                              <p>Gateway provides a unified USDC balance across multiple chains. You can deposit on any chain and transfer to any other - Gateway handles the cross-chain routing automatically.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </p>
                      <p className="text-2xl font-bold">
                        {gatewayBalance.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 })} USDC
                      </p>
                      {gatewayChainBalances.filter(cb => cb.balance > 0).length > 0 && (
                        <ul className="text-xs space-y-1 mt-1 text-muted-foreground">
                          {gatewayChainBalances.filter(cb => cb.balance > 0).map((cb, idx) => (
                            <li
                              key={`gateway-${idx}-${cb.chain}-${cb.balance}`}
                              className="flex justify-between items-center gap-2"
                            >
                              <span className="capitalize">
                                {CHAIN_NAMES[cb.chain as keyof typeof CHAIN_NAMES] || cb.chain}
                              </span>
                              <span className="font-mono">
                                {cb.balance.toFixed(6)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <Separator className="my-4" />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Wallet Balance
                      </p>
                      <p className="text-2xl font-bold">
                        {walletBalance.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 })} USDC
                      </p>
                    </div>
                    {chainBalances.filter(cb => cb.balance > 0).length > 0 ? (
                      <ul className="text-xs space-y-1 mt-[-8px] text-muted-foreground">
                        {chainBalances.filter(cb => cb.balance > 0).map((cb, idx) => (
                          <li
                            key={`wallet-${idx}-${cb.chain}-${cb.balance}`}
                            className="flex justify-between items-center gap-2"
                          >
                            <span className="capitalize flex items-center gap-2">
                              {cb.chain} 
                              <span className="text-[10px] text-muted-foreground">{formatAddressSuffix(cb.address)}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0"
                                onClick={() => copyAddress(cb.address)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </span>
                            <span className="font-mono">
                              {cb.balance.toFixed(6)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        No wallet balance on any chain
                      </p>
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          {/* Actions Card with Tabs */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
              <CardDescription>
                Manage your unified balance by depositing or transferring funds.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="deposit">
                <TabsList className="w-full">
                  <TabsTrigger value="deposit">Deposit</TabsTrigger>
                  <TabsTrigger value="transfer">Transfer</TabsTrigger>
                </TabsList>

                <TabsContent value="deposit" className="pt-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="deposit-amount">Amount (USDC)</Label>
                      <Input
                        id="deposit-amount"
                        type="number"
                        step="0.01"
                        placeholder="10.00"
                        className="w-full"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        disabled={depositLoading}
                      />
                    </div>
                    <Button
                      onClick={handleDeposit}
                      disabled={depositLoading || !hasCircleWallet || !isValidDepositAmount(depositAmount)}
                      className="w-full"
                    >
                      {depositLoading ? "Processing..." : "Deposit"}
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="transfer" className="pt-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="destination-chain">To</Label>
                      <Select
                        value={destinationChain}
                        onValueChange={(value) =>
                          setDestinationChain(value as SupportedChain)
                        }
                        disabled={transferLoading}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select destination chain" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="arcTestnet">Arc Testnet</SelectItem>
                          <SelectItem value="baseSepolia">Base Sepolia</SelectItem>
                          <SelectItem value="avalancheFuji">Avalanche Fuji</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {sourceChain !== destinationChain && (
                      <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-800 dark:bg-blue-950">
                        <ArrowLeftRight className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          Cross-chain transfer: Gateway will route USDC from{" "}
                          <span className="font-medium">{CHAIN_NAMES[sourceChain]}</span> to{" "}
                          <span className="font-medium">{CHAIN_NAMES[destinationChain]}</span> via burn/mint.
                        </p>
                      </div>
                    )}
                    <Alert>
                      <AlertCircleIcon className="h-4 w-4" />
                      <AlertTitle>Gas Fees Required</AlertTitle>
                      <AlertDescription>
                        You need native tokens on the destination chain to pay for gas fees when minting.
                      </AlertDescription>
                    </Alert>
                    <div className="space-y-2">
                      <Label htmlFor="transfer-amount-gateway">Amount (USDC)</Label>
                      <Input
                        id="transfer-amount-gateway"
                        type="number"
                        step="0.01"
                        placeholder="5.00"
                        className="w-full"
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)}
                        disabled={transferLoading}
                      />
                      {transferAmount && parseFloat(transferAmount) > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Available: {gatewayBalance.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 })} USDC
                          {parseFloat(transferAmount) > gatewayBalance && (
                            <span className="text-red-500"> (Insufficient balance)</span>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="recipient-address">
                        Recipient Address (optional)
                      </Label>
                      <Input
                        id="recipient-address"
                        type="text"
                        placeholder="Defaults to your connected wallet"
                        className="w-full"
                        value={recipientAddress}
                        onChange={(e) => setRecipientAddress(e.target.value)}
                        disabled={transferLoading}
                      />
                    </div>
                    <Button
                      onClick={handleTransfer}
                      disabled={transferLoading || !hasCircleWallet || !isValidTransferAmount(transferAmount)}
                      className="w-full"
                    >
                      {transferLoading ? "Processing..." : "Transfer"}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* --- Funding Help Section --- */}
          <Card>
            <CardHeader>
              <CardTitle>Need Testnet USDC?</CardTitle>
              <CardDescription>
                Get funds to test cross-chain transfers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert>
                  <AlertCircleIcon className="h-4 w-4" />
                  <AlertTitle>Circle Faucet</AlertTitle>
                  <AlertDescription>
                    Visit the <a href="https://faucet.circle.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Circle Faucet</a> to get testnet USDC on Arc, Base Sepolia, and Avalanche Fuji.
                  </AlertDescription>
                </Alert>
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium mb-2">Quick Steps:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Get your Circle Wallet address from the "Connected Wallets" section</li>
                    <li>Visit the Circle Faucet and enter your wallet address</li>
                    <li>Select the desired testnet and request USDC</li>
                    <li>Wait for the transaction to confirm, then deposit to Gateway</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* --- Transaction History Table --- */}
          <TransactionHistory />
        </div>
      </div>
    </>
  );
}
