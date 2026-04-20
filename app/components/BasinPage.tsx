'use client';

/**
 * BasinPage — TheBasin community conviction pool UI.
 * Deposit USDC to earn yield from protocol dispute outcomes.
 * Withdraw after 7-day timelock.
 * Shows pool stats, your position, and recent pool activity.
 */

import { useState, useCallback } from 'react';
import {
  useAccount, useChainId, useSwitchChain,
  useReadContract, useWriteContract, useWaitForTransactionReceipt,
} from 'wagmi';
import { base } from 'wagmi/chains';
import { parseUnits } from 'viem';
import {
  BASIN_ADDRESS, USDC_ADDRESS, CONTRACTS_LIVE,
  BASIN_ABI, ERC20_ABI,
  formatUsdc,
} from '@/lib/contracts';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const mono   = "'kataGlyph Stele',Georgia,serif";
const sans   = "'kataGlyph Stele',Georgia,serif";
const serif  = "'kataGlyph Stele',Georgia,serif";
const text1  = '#D8C4A0';
const text2  = 'rgba(216,196,160,0.65)';
const text3  = 'rgba(216,196,160,0.38)';
const bg2    = '#130C07';
const bg3    = '#1C1108';
const border = 'rgba(200,140,60,0.10)';
const terra  = '#D94030';
const blue   = '#7AABCC';
const gold   = '#C9A84C';
const green  = '#5aab7a';
const celadon = '#C8602A';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function SecHead({ label }: { label: string }) {
  return (
    <div style={{
      fontFamily: mono, fontSize: 13, fontWeight: 600, letterSpacing: '0.26em',
      textTransform: 'uppercase', color: 'rgba(216,196,160,0.65)',
      marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
    }}>
      {'// '}{label}
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${border} 0%, transparent 100%)` }} />
    </div>
  );
}

function StatCard({ label, value, sub, color = text1 }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{
      padding: '14px 16px', background: bg2,
      border: `1px solid ${border}`, borderRadius: 2,
    }}>
      <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: text3, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontFamily: mono, fontSize: 20, fontWeight: 700, color, letterSpacing: '-0.01em' }}>
        {value}
      </div>
      {sub && <div style={{ fontFamily: mono, fontSize: 10, color: text3, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function InputRow({
  label, value, onChange, placeholder, max, unit = 'USDC',
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; max?: string; unit?: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: text3, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="number" min="0" step="any" value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1, fontFamily: mono, fontSize: 14, padding: '8px 12px',
            background: bg3, border: `1px solid ${border}`, color: text1,
            borderRadius: 2, outline: 'none',
          }}
        />
        <span style={{ fontFamily: mono, fontSize: 11, color: text3, flexShrink: 0 }}>{unit}</span>
        {max && (
          <button
            onClick={() => onChange(max)}
            style={{
              fontFamily: mono, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
              padding: '4px 8px', background: 'none', border: `1px solid ${border}`,
              color: text3, cursor: 'pointer', borderRadius: 2, flexShrink: 0,
            }}
          >
            max
          </button>
        )}
      </div>
    </div>
  );
}

function TxBtn({
  label, onClick, loading, disabled, variant = 'accent',
}: {
  label: string; onClick: () => void; loading?: boolean;
  disabled?: boolean; variant?: 'accent' | 'neutral' | 'danger';
}) {
  const cols = {
    accent:  { bg: 'rgba(122,171,204,0.10)', border: 'rgba(122,171,204,0.30)', fg: blue },
    neutral: { bg: 'rgba(216,196,160,0.04)', border, fg: text2 },
    danger:  { bg: 'rgba(217,64,48,0.08)',   border: 'rgba(217,64,48,0.28)',   fg: terra },
  };
  const c = cols[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        fontFamily: mono, fontSize: 11, fontWeight: 700, letterSpacing: '0.18em',
        textTransform: 'uppercase', padding: '9px 20px', borderRadius: 2,
        background: c.bg, border: `1px solid ${c.border}`, color: c.fg,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1, transition: 'opacity 0.15s', width: '100%',
      }}
    >
      {loading ? 'waiting…' : label}
    </button>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export default function BasinPage() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const onBase = chainId === base.id;

  const [depositAmt, setDepositAmt]   = useState('');
  const [withdrawPct, setWithdrawPct] = useState('100');
  const [txError, setTxError]         = useState('');
  const [tab, setTab]                 = useState<'deposit' | 'withdraw'>('deposit');

  // ── Reads ────────────────────────────────────────────────────────────────────
  const { data: poolStats, refetch: refetchPool } = useReadContract({
    address: BASIN_ADDRESS,
    abi: BASIN_ABI,
    functionName: 'poolStats',
    query: { enabled: CONTRACTS_LIVE, refetchInterval: 30_000 },
  });

  const { data: myShares, refetch: refetchShares } = useReadContract({
    address: BASIN_ADDRESS,
    abi: BASIN_ABI,
    functionName: 'shares',
    args: address ? [address] : undefined,
    query: { enabled: CONTRACTS_LIVE && Boolean(address) },
  });

  const { data: myPreview, refetch: refetchPreview } = useReadContract({
    address: BASIN_ADDRESS,
    abi: BASIN_ABI,
    functionName: 'previewWithdraw',
    args: address ? [address] : undefined,
    query: { enabled: CONTRACTS_LIVE && Boolean(address) },
  });

  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const { data: usdcAllowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, BASIN_ADDRESS] : undefined,
    query: { enabled: Boolean(address) },
  });

  // ── Writes ───────────────────────────────────────────────────────────────────
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
    onReplaced: () => { refetchPool(); refetchShares(); refetchPreview(); },
  });
  if (txConfirmed) { refetchPool(); refetchShares(); refetchPreview(); refetchAllowance(); }

  const depositRaw = (() => {
    try { return parseUnits(depositAmt || '0', 6); } catch { return 0n; }
  })();

  const sharesToBurn = (() => {
    if (!myShares) return 0n;
    const pct = Math.min(100, Math.max(0, parseFloat(withdrawPct) || 0));
    return (myShares * BigInt(Math.round(pct * 100))) / 10000n;
  })();

  const needsApproval = depositRaw > 0n && (usdcAllowance ?? 0n) < depositRaw;

  const approve = useCallback(() => {
    setTxError('');
    writeContract({ address: USDC_ADDRESS, abi: ERC20_ABI, functionName: 'approve', args: [BASIN_ADDRESS, depositRaw] });
  }, [writeContract, depositRaw]);

  const deposit = useCallback(() => {
    setTxError('');
    writeContract({ address: BASIN_ADDRESS, abi: BASIN_ABI, functionName: 'deposit', args: [depositRaw] });
  }, [writeContract, depositRaw]);

  const withdraw = useCallback(() => {
    setTxError('');
    writeContract({ address: BASIN_ADDRESS, abi: BASIN_ABI, functionName: 'withdraw', args: [sharesToBurn] });
  }, [writeContract, sharesToBurn]);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const totalUsdc     = poolStats?.[0] ?? 0n;
  const idleUsdc      = poolStats?.[1] ?? 0n;
  const deployedUsdc  = poolStats?.[2] ?? 0n;
  const shareSupply   = poolStats?.[3] ?? 0n;
  const sharePrice    = poolStats?.[4] ?? 1_000_000n;

  const deployPct  = totalUsdc > 0n ? Number(deployedUsdc * 100n / totalUsdc) : 0;
  const myUsdcVal  = myPreview?.[0] ?? 0n;
  const timelockEnds = myPreview?.[1] ?? 0n;
  const timelockMet  = myPreview?.[2] ?? false;
  const liquidityOk  = myPreview?.[3] ?? false;

  const timelockDate = timelockEnds > 0n
    ? new Date(Number(timelockEnds) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

  const previewWithdrawAmt = (() => {
    if (!myShares || myShares === 0n) return 0n;
    const pct = Math.min(100, Math.max(0, parseFloat(withdrawPct) || 0));
    return (myUsdcVal * BigInt(Math.round(pct * 100))) / 10000n;
  })();

  const balanceMax = usdcBalance ? formatUsdc(usdcBalance) : '0.00';

  if (!CONTRACTS_LIVE) {
    return (
      <div className="fi" style={{ animationDelay: '0.04s' }}>
        <SecHead label="The Basin" />
        <div style={{
          padding: '40px 0', textAlign: 'center',
          fontFamily: mono, fontSize: 12, letterSpacing: '0.16em', color: text3,
          textTransform: 'uppercase',
        }}>
          contracts not yet deployed · coming to Base mainnet
        </div>
        <div style={{
          padding: '20px 24px', background: bg2, border: `1px solid ${border}`,
          borderRadius: 2, marginTop: 8,
        }}>
          <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 20, color: 'rgba(216,196,160,0.7)', lineHeight: 1.4, marginBottom: 12 }}>
            &ldquo;Capital votes on truth.&rdquo;
          </div>
          <div style={{ fontFamily: sans, fontSize: 15, lineHeight: 1.8, color: text2 }}>
            Deposit USDC into the Basin pool. The pool automatically backs posts from high-trust wallets
            during settlement markets. Win ratio determines your yield. 10% rake on winning positions
            flows to the treasury. 7-day withdrawal timelock enforces long-term alignment.
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[
              ['Min trust to back', '150'],
              ['Per-post cap', '5% of pool / 10 USDC max'],
              ['Max deployment', '80% of pool'],
              ['Timelock', '7 days from last deposit'],
              ['Rake', '10% of losing pool → treasury'],
            ].map(([k, v]) => (
              <div key={k} style={{ fontFamily: mono, fontSize: 11 }}>
                <span style={{ color: text3, letterSpacing: '0.1em' }}>{k}: </span>
                <span style={{ color: gold }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fi" style={{ animationDelay: '0.04s' }}>
      <SecHead label="The Basin" />

      {/* Pool stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 24 }}>
        <StatCard label="Total USDC" value={`$${formatUsdc(totalUsdc)}`} />
        <StatCard
          label="Deployed"
          value={`${deployPct.toFixed(1)}%`}
          sub={`$${formatUsdc(deployedUsdc)} active`}
          color={deployPct > 70 ? gold : text1}
        />
        <StatCard label="Idle" value={`$${formatUsdc(idleUsdc)}`} sub="available to back" color={blue} />
        <StatCard
          label="Share price"
          value={`$${(Number(sharePrice) / 1e6).toFixed(4)}`}
          sub={`${shareSupply > 0n ? formatUsdc(shareSupply) : '0'} shares`}
          color={Number(sharePrice) > 1_000_000 ? green : text1}
        />
      </div>

      {/* Your position */}
      {address && myShares !== undefined && myShares > 0n && (
        <div style={{
          padding: '12px 16px', background: bg2, border: `1px solid ${border}`,
          borderRadius: 2, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: text3, marginBottom: 4 }}>your position</div>
            <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: green }}>${formatUsdc(myUsdcVal)}</div>
          </div>
          <div>
            <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: text3, marginBottom: 4 }}>shares</div>
            <div style={{ fontFamily: mono, fontSize: 14, color: text1 }}>{formatUsdc(myShares)}</div>
          </div>
          <div>
            <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: text3, marginBottom: 4 }}>timelock</div>
            <div style={{ fontFamily: mono, fontSize: 12, color: timelockMet ? green : gold }}>
              {timelockMet ? 'unlocked' : `locks until ${timelockDate}`}
            </div>
          </div>
          {!liquidityOk && (
            <div style={{ fontFamily: mono, fontSize: 11, color: terra, marginLeft: 'auto' }}>
              pool deployed — withdrawal may be delayed
            </div>
          )}
        </div>
      )}

      {/* Deposit / Withdraw tabs */}
      {!address ? (
        <div style={{ fontFamily: mono, fontSize: 12, color: text3, padding: '20px 0', textAlign: 'center', letterSpacing: '0.14em' }}>
          connect wallet to deposit
        </div>
      ) : !onBase ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
          <span style={{ fontFamily: mono, fontSize: 12, color: terra }}>switch to Base mainnet</span>
          <button
            onClick={() => switchChain({ chainId: base.id })}
            style={{
              fontFamily: mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.14em',
              padding: '6px 14px', background: 'rgba(217,64,48,0.10)',
              border: '1px solid rgba(217,64,48,0.30)', color: terra, borderRadius: 2, cursor: 'pointer',
            }}
          >
            Switch network
          </button>
        </div>
      ) : (
        <div style={{ maxWidth: 400 }}>
          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: `1px solid ${border}` }}>
            {(['deposit', 'withdraw'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setTxError(''); }}
                style={{
                  fontFamily: mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.18em',
                  textTransform: 'uppercase', padding: '8px 16px', background: 'none',
                  border: 'none', borderBottom: `2px solid ${tab === t ? celadon : 'transparent'}`,
                  color: tab === t ? celadon : text3, cursor: 'pointer', marginBottom: -1,
                  transition: 'color 0.15s',
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'deposit' && (
            <>
              <InputRow
                label="Amount"
                value={depositAmt}
                onChange={setDepositAmt}
                placeholder="0.00"
                max={balanceMax}
              />
              <div style={{ fontFamily: mono, fontSize: 10, color: text3, marginBottom: 14 }}>
                wallet balance: ${balanceMax} USDC
                {depositRaw > 0n && shareSupply > 0n && (
                  <span style={{ marginLeft: 12, color: blue }}>
                    ≈ {formatUsdc((depositRaw * (shareSupply + 1000n)) / (totalUsdc + 1000n))} shares
                  </span>
                )}
              </div>
              {needsApproval
                ? <TxBtn label="Approve USDC" onClick={approve} loading={isPending} variant="neutral" />
                : <TxBtn label="Deposit to Basin" onClick={deposit} loading={isPending} disabled={depositRaw === 0n} variant="accent" />
              }
              <div style={{ fontFamily: mono, fontSize: 10, color: text3, marginTop: 10, lineHeight: 1.6 }}>
                starts 7-day withdrawal timelock · deposits automatically back trusted posts
              </div>
            </>
          )}

          {tab === 'withdraw' && (
            <>
              {myShares === undefined || myShares === 0n ? (
                <div style={{ fontFamily: mono, fontSize: 12, color: text3, padding: '20px 0' }}>
                  no position to withdraw
                </div>
              ) : (
                <>
                  <InputRow
                    label="Withdraw %"
                    value={withdrawPct}
                    onChange={setWithdrawPct}
                    placeholder="100"
                    max="100"
                    unit="%"
                  />
                  <div style={{ fontFamily: mono, fontSize: 10, color: text3, marginBottom: 14 }}>
                    you receive: <span style={{ color: text1 }}>${formatUsdc(previewWithdrawAmt)} USDC</span>
                    {' · '}{formatUsdc(sharesToBurn)} shares burned
                  </div>
                  {!timelockMet && (
                    <div style={{ fontFamily: mono, fontSize: 11, color: gold, marginBottom: 12 }}>
                      timelock: {timelockDate}
                    </div>
                  )}
                  {!liquidityOk && timelockMet && (
                    <div style={{ fontFamily: mono, fontSize: 11, color: terra, marginBottom: 12 }}>
                      insufficient idle liquidity — pool is deployed
                    </div>
                  )}
                  <TxBtn
                    label="Withdraw USDC"
                    onClick={withdraw}
                    loading={isPending}
                    disabled={!timelockMet || !liquidityOk || sharesToBurn === 0n}
                    variant={timelockMet && liquidityOk ? 'accent' : 'neutral'}
                  />
                </>
              )}
            </>
          )}

          {txError && (
            <div style={{ marginTop: 10, fontFamily: mono, fontSize: 11, color: terra }}>{txError}</div>
          )}
          {txConfirmed && (
            <div style={{ marginTop: 10, fontFamily: mono, fontSize: 11, color: green }}>tx confirmed ✓</div>
          )}
        </div>
      )}
    </div>
  );
}
