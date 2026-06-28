"use client";

/**
 * BalanceBreakdown
 *
 * Addresses issue #8: "UX Improvement: Clearer Cross-Chain Balance Breakdown"
 *
 * Adds:
 * 1. Per-chain USDC breakdown with visual bar charts
 * 2. Tooltip explaining how Gateway abstracts liquidity
 * 3. Visual indicator distinguishing Gateway (spendable) vs wallet (per-chain) balances
 * 4. Pending/in-motion balance states aligned with Unified Balance Kit patterns
 */

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChainBalance } from "@/lib/chain-config";
import { Info, Zap, Wallet } from "lucide-react";

// ─── Chain display helpers ──────────────────────────────────────────────────
const CHAIN_LABELS: Record<string, string> = {
  arcTestnet: "Arc Testnet",
  baseSepolia: "Base Sepolia",
  avalancheFuji: "Avalanche Fuji",
};

const CHAIN_COLORS: Record<string, string> = {
  arcTestnet: "bg-blue-500",
  baseSepolia: "bg-indigo-500",
  avalancheFuji: "bg-red-500",
};

function chainLabel(chain: string): string {
  return CHAIN_LABELS[chain] ?? chain;
}

function chainColor(chain: string): string {
  return CHAIN_COLORS[chain] ?? "bg-gray-400";
}

// ─── Props ──────────────────────────────────────────────────────────────────
interface BalanceBreakdownProps {
  gatewayBalance: number;
  walletBalance: number;
  chainBalances: ChainBalance[];
  /**
   * Optional: amount currently in transit (burn submitted, mint pending).
   * Surfaces a "funds in motion" indicator when > 0.
   */
  pendingBalance?: number;
}

// ─── Component ──────────────────────────────────────────────────────────────
export function BalanceBreakdown({
  gatewayBalance,
  walletBalance,
  chainBalances,
  pendingBalance = 0,
}: BalanceBreakdownProps) {
  const total = gatewayBalance + walletBalance;
  const gatewayPct = total > 0 ? (gatewayBalance / total) * 100 : 0;
  const walletPct = total > 0 ? (walletBalance / total) * 100 : 0;

  const chainsWithBalance = chainBalances.filter((cb) => cb.balance > 0);
  const chainTotal = chainsWithBalance.reduce((acc, cb) => acc + cb.balance, 0);

  return (
    <TooltipProvider>
      <div className="space-y-4">

        {/* ── Unified Balance Header ─────────────────────────────────── */}
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Unified USDC Balance
          </p>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              <p className="font-semibold mb-1">How Gateway works</p>
              <p>
                The Arc Gateway abstracts liquidity across chains into a single
                unified balance. USDC deposited from any supported chain becomes
                spendable on all chains — no manual bridging required.
              </p>
              <p className="mt-1 text-muted-foreground">
                <strong>Gateway balance</strong> = instantly spendable
                cross-chain.
                <br />
                <strong>Wallet balance</strong> = held per-chain, not yet
                deposited.
              </p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* ── Visual bar ────────────────────────────────────────────── */}
        <div className="w-full h-2 rounded-full bg-muted flex overflow-hidden">
          <div
            className="bg-blue-500 h-full transition-all"
            style={{ width: `${gatewayPct}%` }}
            title={`Gateway: ${gatewayBalance.toFixed(6)} USDC`}
          />
          <div
            className="bg-slate-400 h-full transition-all"
            style={{ width: `${walletPct}%` }}
            title={`Wallet: ${walletBalance.toFixed(6)} USDC`}
          />
        </div>

        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
            Gateway (spendable)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-slate-400" />
            Wallet (per-chain)
          </span>
        </div>

        {/* ── Gateway balance card ───────────────────────────────────── */}
        <div className="rounded-lg border bg-card p-3 space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Zap className="h-4 w-4 text-blue-500" />
              Arc Gateway
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  Funds deposited here are accessible instantly on any supported
                  chain. This is your cross-chain spendable balance.
                </TooltipContent>
              </Tooltip>
            </div>
            <span className="text-sm font-mono font-semibold">
              {gatewayBalance.toLocaleString("en-US", {
                minimumFractionDigits: 6,
                maximumFractionDigits: 6,
              })}{" "}
              USDC
            </span>
          </div>
          <p className="text-xs text-muted-foreground pl-6">
            Spendable across Arc Testnet, Base Sepolia, Avalanche Fuji
          </p>
        </div>

        {/* ── Pending / in-motion indicator ─────────────────────────── */}
        {pendingBalance > 0 && (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500" />
              </span>
              Funds in motion
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  A cross-chain transfer is in progress. The burn has been
                  submitted on the source chain; the mint on the destination
                  chain is pending attestation (typically confirmed within
                  seconds on Arc).
                </TooltipContent>
              </Tooltip>
            </div>
            <span className="text-sm font-mono text-yellow-600 dark:text-yellow-400">
              {pendingBalance.toLocaleString("en-US", {
                minimumFractionDigits: 6,
                maximumFractionDigits: 6,
              })}{" "}
              USDC
            </span>
          </div>
        )}

        {/* ── Per-chain wallet breakdown ─────────────────────────────── */}
        <div className="rounded-lg border bg-card p-3 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            Per-chain wallet balances
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                USDC held in your wallet on each chain, not yet deposited to
                Gateway. Deposit to make it cross-chain spendable.
              </TooltipContent>
            </Tooltip>
          </div>

          {chainsWithBalance.length === 0 ? (
            <p className="text-xs text-muted-foreground pl-6">
              No wallet balances found. Deposit USDC to get started.
            </p>
          ) : (
            <div className="space-y-2 pl-6">
              {chainsWithBalance.map((cb, idx) => {
                const pct = chainTotal > 0 ? (cb.balance / chainTotal) * 100 : 0;
                return (
                  <div key={`${cb.chain}-${idx}`} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        {chainLabel(cb.chain)}
                      </span>
                      <span className="font-mono">
                        {cb.balance.toFixed(6)} USDC
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${chainColor(cb.chain)}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </TooltipProvider>
  );
}