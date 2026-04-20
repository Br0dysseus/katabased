'use client';

/**
 * ChallengePanel — on-chain challenge/settlement UI for a single post.
 * Renders inline inside FeedEntry when the post has a chain_post_id.
 * Handles the full KataBasedStake flow:
 *   Active → openChallenge
 *   Challenged → fold / call (poster only)
 *   Contested → back (truth/false) + pool stats
 *   Settled → claim
 *   Canon → badge only
 */

import { useState, useCallback } from 'react';
import {
  useAccount, useChainId, useSwitchChain,
  useReadContract, useWriteContract, useWaitForTransactionReceipt,
} from 'wagmi';
import { base } from 'wagmi/chains';
import { parseUnits } from 'viem';
import {
  STAKE_ADDRESS, USDC_ADDRESS, CONTRACTS_LIVE,
  STAKE_ABI, ERC20_ABI,
  POSTER_STAKE_RAW, CHALLENGE_STAKE_RAW, MIN_BACK_RAW,
  POST_STATE, POST_STATE_LABEL, OUTCOME_LABEL,
  formatUsdc,
} from '@/lib/contracts';

// ─── Design tokens (matches dashboard) ───────────────────────────────────────
const mono   = "'kataGlyph Stele',Georgia,serif";
const sans   = "'kataGlyph Stele',Georgia,serif";
const text1  = '#D8C4A0';
const text2  = 'rgba(216,196,160,0.65)';
const text3  = 'rgba(216,196,160,0.38)';
const border = 'rgba(200,140,60,0.10)';
const terra  = '#D94030';
const blue   = '#7AABCC';
const gold   = '#C9A84C';
const green  = '#5aab7a';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCountdown(ts: bigint): string {
  const secs = Number(ts) - Math.floor(Date.now() / 1000);
  if (secs <= 0) return 'expired';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function StatPill({ label, value, color = text2 }: { label: string; value: string; color?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: mono, fontSize: 11, letterSpacing: '0.06em' }}>
      <span style={{ color: text3 }}>{label}</span>
      <span style={{ color, fontWeight: 600 }}>{value}</span>
    </span>
  );
}

function ActionBtn({
  label, onClick, loading, disabled, variant = 'neutral',
}: {
  label: string; onClick: () => void; loading?: boolean;
  disabled?: boolean; variant?: 'truth' | 'false' | 'danger' | 'neutral' | 'accent';
}) {
  const colors = {
    truth:   { bg: 'rgba(90,171,122,0.12)', border: 'rgba(90,171,122,0.35)', fg: green },
    false:   { bg: 'rgba(217,64,48,0.10)',  border: 'rgba(217,64,48,0.35)',  fg: terra },
    danger:  { bg: 'rgba(217,64,48,0.10)',  border: 'rgba(217,64,48,0.3)',   fg: terra },
    neutral: { bg: 'rgba(216,196,160,0.05)', border: border, fg: text2 },
    accent:  { bg: 'rgba(122,171,204,0.10)', border: 'rgba(122,171,204,0.3)', fg: blue },
  };
  const c = colors[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        fontFamily: mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.14em',
        textTransform: 'uppercase', padding: '5px 12px', borderRadius: 2,
        background: c.bg, border: `1px solid ${c.border}`, color: c.fg,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      {loading ? '...' : label}
    </button>
  );
}

// ─── USDC approval + action flow ─────────────────────────────────────────────

function useApproveAndWrite(spender: `0x${string}`, amount: bigint) {
  const { address } = useAccount();
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, spender] : undefined,
    query: { enabled: Boolean(address) },
  });

  const { writeContract: writeApprove, data: approveTxHash, isPending: approvePending } = useWriteContract();
  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({ hash: approveTxHash });

  const needsApproval = allowance !== undefined && allowance < amount;

  const approve = useCallback(() => {
    writeApprove({ address: USDC_ADDRESS, abi: ERC20_ABI, functionName: 'approve', args: [spender, amount] });
  }, [writeApprove, spender, amount]);

  return { needsApproval, approve, approvePending, approveConfirmed, refetchAllowance };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ChallengePanel({ postId }: { postId: `0x${string}` }) {
  const { address } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const onBase = chainId === base.id;

  const [expanded, setExpanded]   = useState(false);
  const [backAmt,  setBackAmt]    = useState('5');
  const [txError,  setTxError]    = useState('');
  const [lastAction, setLastAction] = useState('');

  // ── Contract reads ──────────────────────────────────────────────────────────
  const { data: post, refetch: refetchPost } = useReadContract({
    address: STAKE_ADDRESS,
    abi: STAKE_ABI,
    functionName: 'getPost',
    args: [postId],
    query: { enabled: CONTRACTS_LIVE && expanded },
  });

  const { data: challenge, refetch: refetchChallenge } = useReadContract({
    address: STAKE_ADDRESS,
    abi: STAKE_ABI,
    functionName: 'getChallenge',
    args: [postId],
    query: { enabled: CONTRACTS_LIVE && expanded && post?.state !== undefined },
  });

  const { data: myBacking } = useReadContract({
    address: STAKE_ADDRESS,
    abi: STAKE_ABI,
    functionName: 'getBacking',
    args: address ? [postId, address] : undefined,
    query: { enabled: CONTRACTS_LIVE && expanded && Boolean(address) },
  });

  const { data: myClaimable } = useReadContract({
    address: STAKE_ADDRESS,
    abi: STAKE_ABI,
    functionName: 'previewClaim',
    args: address ? [postId, address] : undefined,
    query: { enabled: CONTRACTS_LIVE && expanded && Boolean(address) && post?.state === POST_STATE.Settled },
  });

  // ── Writes ──────────────────────────────────────────────────────────────────
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
    onReplaced: () => { refetchPost(); refetchChallenge(); },
  });

  const backAmountRaw = (() => {
    try { return parseUnits(backAmt || '0', 6); } catch { return 0n; }
  })();

  const stakeNeeded = (() => {
    if (!post) return 0n;
    if (post.state === POST_STATE.Active) return CHALLENGE_STAKE_RAW;
    if (post.state === POST_STATE.Challenged && address === post.poster) return CHALLENGE_STAKE_RAW; // call
    if (post.state === POST_STATE.Contested) return backAmountRaw > MIN_BACK_RAW ? backAmountRaw : MIN_BACK_RAW;
    return 0n;
  })();

  const { needsApproval, approve, approvePending, approveConfirmed, refetchAllowance } =
    useApproveAndWrite(STAKE_ADDRESS, stakeNeeded);

  // Refetch after approval confirmed
  if (approveConfirmed) refetchAllowance();
  if (txConfirmed) { refetchPost(); refetchChallenge(); }

  const write = (fn: string, args: unknown[]) => {
    setTxError('');
    setLastAction(fn);
    // biome-ignore lint: dynamic ABI dispatch
    (writeContract as (cfg: object) => void)({
      address: STAKE_ADDRESS,
      abi: STAKE_ABI,
      functionName: fn,
      args,
    });
  };

  // ── Derived state ────────────────────────────────────────────────────────────
  if (!CONTRACTS_LIVE) return null;

  const now = BigInt(Math.floor(Date.now() / 1000));
  const state      = post?.state ?? POST_STATE.Active;
  const stateLabel = POST_STATE_LABEL[state] ?? 'Unknown';
  const isPoster   = address && post?.poster && address.toLowerCase() === post.poster.toLowerCase();

  const stateColor: Record<number, string> = {
    [POST_STATE.Active]:     gold,
    [POST_STATE.Challenged]: terra,
    [POST_STATE.Contested]:  blue,
    [POST_STATE.Settled]:    text3,
    [POST_STATE.Folded]:     text3,
    [POST_STATE.Canon]:      green,
  };

  const totalTruth = challenge
    ? (challenge.posterPool + challenge.posterBacking)
    : 0n;
  const totalFalse = challenge
    ? (challenge.challengerPool + challenge.challengerBacking)
    : 0n;
  const totalPot   = totalTruth + totalFalse;
  const truthPct   = totalPot > 0n ? Number(totalTruth * 100n / totalPot) : 50;

  const canChallenge = state === POST_STATE.Active && challenge && now < post!.challengeEnd && !isPoster;
  const canFold      = state === POST_STATE.Challenged && isPoster && challenge && !challenge.resolved;
  const canCall      = canFold && now <= challenge!.responseDeadline;
  const canTimeout   = state === POST_STATE.Challenged && challenge && now > challenge.responseDeadline && !challenge.resolved;
  const canBack      = state === POST_STATE.Contested && challenge && now < challenge.settlementEnd;
  const canSettle    = state === POST_STATE.Contested && challenge && now >= challenge.settlementEnd && !challenge.resolved;
  const canClaim     = challenge?.resolved && myClaimable !== undefined && myClaimable > 0n;
  const canCanon     = state === POST_STATE.Active && post && now >= post.challengeEnd;

  const loading = isPending || approvePending;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ marginTop: 10 }}>
      {/* Toggle button */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          fontFamily: mono, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          color: stateColor[state] ?? text3,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          transition: 'opacity 0.15s',
        }}
      >
        <span style={{ opacity: 0.6 }}>{expanded ? '▾' : '▸'}</span>
        on-chain
        {post && <span style={{ opacity: 0.7 }}>· {stateLabel.toLowerCase()}</span>}
      </button>

      {expanded && (
        <div style={{
          marginTop: 10, padding: '12px 14px',
          background: 'rgba(216,196,160,0.02)',
          border: `1px solid ${border}`,
          borderRadius: 2,
        }}>
          {!address ? (
            <div style={{ fontFamily: mono, fontSize: 11, color: text3 }}>connect wallet to interact</div>
          ) : !onBase ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: mono, fontSize: 11, color: terra }}>switch to Base to interact</span>
              <ActionBtn label="Switch" onClick={() => switchChain({ chainId: base.id })} variant="danger" />
            </div>
          ) : !post ? (
            <div style={{ fontFamily: mono, fontSize: 11, color: text3 }}>loading on-chain state…</div>
          ) : (
            <>
              {/* State + timing */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                <span style={{
                  fontFamily: mono, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
                  padding: '2px 8px', borderRadius: 2,
                  background: `${stateColor[state]}18`, color: stateColor[state],
                  fontWeight: 700,
                }}>
                  {stateLabel}
                </span>

                {state === POST_STATE.Active && (
                  <StatPill label="challenge window" value={fmtCountdown(post.challengeEnd)} color={gold} />
                )}
                {state === POST_STATE.Challenged && challenge && (
                  <StatPill label="response deadline" value={fmtCountdown(challenge.responseDeadline)} color={terra} />
                )}
                {state === POST_STATE.Contested && challenge && (
                  <StatPill label="settlement closes" value={fmtCountdown(challenge.settlementEnd)} color={blue} />
                )}
                {state === POST_STATE.Settled && challenge && (
                  <StatPill label="outcome" value={OUTCOME_LABEL[challenge.outcome]} color={text1} />
                )}
              </div>

              {/* Pool bar (Contested only) */}
              {state === POST_STATE.Contested && totalPot > 0n && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <StatPill label="truth" value={`$${formatUsdc(totalTruth)}`} color={green} />
                    <StatPill label="false" value={`$${formatUsdc(totalFalse)}`} color={terra} />
                  </div>
                  <div style={{ height: 3, width: '100%', display: 'flex', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${truthPct}%`, background: green, transition: 'width 0.4s' }} />
                    <div style={{ flex: 1, background: terra }} />
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: text3, marginTop: 4 }}>
                    total pot: ${formatUsdc(totalPot)}
                  </div>
                </div>
              )}

              {/* My backing (Contested) */}
              {state === POST_STATE.Contested && myBacking && myBacking.amount > 0n && (
                <div style={{ marginBottom: 8, fontFamily: mono, fontSize: 11, color: text2 }}>
                  your stake: ${formatUsdc(myBacking.amount)} on {myBacking.sideIsPoster ? 'truth' : 'false'} side
                </div>
              )}

              {/* My claimable (Settled) */}
              {canClaim && myClaimable && (
                <div style={{ marginBottom: 8, fontFamily: mono, fontSize: 11, color: green }}>
                  claimable: ${formatUsdc(myClaimable)}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>

                {/* Challenge */}
                {canChallenge && (
                  needsApproval
                    ? <ActionBtn label="Approve USDC (10)" onClick={approve} loading={approvePending} variant="accent" />
                    : <ActionBtn label="Challenge (10 USDC)" onClick={() => write('openChallenge', [postId])} loading={loading && lastAction === 'openChallenge'} variant="false" />
                )}

                {/* Fold / Call */}
                {canFold && <ActionBtn label="Fold (concede)" onClick={() => write('fold', [postId])} loading={loading && lastAction === 'fold'} variant="danger" />}
                {canCall && (
                  needsApproval
                    ? <ActionBtn label="Approve USDC (10)" onClick={approve} loading={approvePending} variant="accent" />
                    : <ActionBtn label="Call (match 10 USDC)" onClick={() => write('call', [postId])} loading={loading && lastAction === 'call'} variant="truth" />
                )}

                {/* Response timeout */}
                {canTimeout && (
                  <ActionBtn label="Claim timeout" onClick={() => write('claimResponseTimeout', [postId])} loading={loading && lastAction === 'claimResponseTimeout'} variant="neutral" />
                )}

                {/* Back */}
                {canBack && (
                  <>
                    <input
                      type="number" min="1" step="1" value={backAmt}
                      onChange={e => setBackAmt(e.target.value)}
                      placeholder="USDC"
                      style={{
                        width: 64, fontFamily: mono, fontSize: 11, padding: '4px 8px',
                        background: 'rgba(216,196,160,0.04)', border: `1px solid ${border}`,
                        color: text1, borderRadius: 2, outline: 'none',
                      }}
                    />
                    {needsApproval
                      ? <ActionBtn label="Approve USDC" onClick={approve} loading={approvePending} variant="accent" />
                      : <>
                          <ActionBtn label="Back Truth" onClick={() => write('back', [postId, true,  backAmountRaw])} loading={loading && lastAction === 'back'} variant="truth" />
                          <ActionBtn label="Back False" onClick={() => write('back', [postId, false, backAmountRaw])} loading={loading && lastAction === 'back'} variant="false" />
                        </>
                    }
                  </>
                )}

                {/* Settle */}
                {canSettle && (
                  <ActionBtn label="Settle" onClick={() => write('settle', [postId])} loading={loading && lastAction === 'settle'} variant="neutral" />
                )}

                {/* Claim */}
                {canClaim && (
                  <ActionBtn label="Claim payout" onClick={() => write('claim', [postId])} loading={loading && lastAction === 'claim'} variant="truth" />
                )}

                {/* Canon */}
                {canCanon && (
                  <ActionBtn label="Claim canon" onClick={() => write('claimCanon', [postId])} loading={loading && lastAction === 'claimCanon'} variant="accent" />
                )}
              </div>

              {txError && (
                <div style={{ marginTop: 8, fontFamily: mono, fontSize: 11, color: terra }}>{txError}</div>
              )}
              {txConfirmed && (
                <div style={{ marginTop: 8, fontFamily: mono, fontSize: 11, color: green }}>tx confirmed ✓</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
