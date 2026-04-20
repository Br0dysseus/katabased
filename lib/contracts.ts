/**
 * kataBased — contract ABIs, addresses, and typed constants.
 * Addresses sourced from env vars — undefined until deployed on Base.
 */

// ─── Addresses ────────────────────────────────────────────────────────────────

export const STAKE_ADDRESS = (process.env.NEXT_PUBLIC_STAKE_ADDRESS  ?? '') as `0x${string}`
export const BASIN_ADDRESS = (process.env.NEXT_PUBLIC_BASIN_ADDRESS  ?? '') as `0x${string}`
// Base mainnet USDC — fallback for local dev
export const USDC_ADDRESS  = (process.env.NEXT_PUBLIC_USDC_ADDRESS   ?? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913') as `0x${string}`

export const CONTRACTS_LIVE = Boolean(STAKE_ADDRESS && BASIN_ADDRESS)

// ─── Constants (mirrors contract) ─────────────────────────────────────────────

export const USDC_DECIMALS     = 6
export const POSTER_STAKE_RAW  = 5_000_000n   // 5 USDC
export const CHALLENGE_STAKE_RAW = 10_000_000n // 10 USDC
export const MIN_BACK_RAW      = 1_000_000n    // 1 USDC

export const POST_STATE = {
  Active:     0,
  Challenged: 1,
  Folded:     2,
  Contested:  3,
  Settled:    4,
  Canon:      5,
} as const
export type PostStateNum = (typeof POST_STATE)[keyof typeof POST_STATE]
export const POST_STATE_LABEL = ['Active', 'Challenged', 'Folded', 'Contested', 'Settled', 'Canon'] as const

export const OUTCOME_LABEL = ['None', 'PosterWon', 'ChallengerWon', 'Tie'] as const

export function formatUsdc(raw: bigint): string {
  const n = Number(raw) / 1e6
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── KataBasedStake ABI ───────────────────────────────────────────────────────

export const STAKE_ABI = [
  // reads
  {
    type: 'function', name: 'getPost', stateMutability: 'view',
    inputs:  [{ name: 'postId', type: 'bytes32' }],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'poster',       type: 'address' },
        { name: 'stakedAt',     type: 'uint256' },
        { name: 'challengeEnd', type: 'uint256' },
        { name: 'state',        type: 'uint8'   },
        { name: 'contentHash',  type: 'bytes32' },
      ],
    }],
  },
  {
    type: 'function', name: 'getChallenge', stateMutability: 'view',
    inputs:  [{ name: 'postId', type: 'bytes32' }],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'challenger',        type: 'address' },
        { name: 'openedAt',          type: 'uint256' },
        { name: 'responseDeadline',  type: 'uint256' },
        { name: 'settlementEnd',     type: 'uint256' },
        { name: 'posterPool',        type: 'uint256' },
        { name: 'challengerPool',    type: 'uint256' },
        { name: 'posterBacking',     type: 'uint256' },
        { name: 'challengerBacking', type: 'uint256' },
        { name: 'outcome',           type: 'uint8'   },
        { name: 'resolved',          type: 'bool'    },
        { name: 'posterClaimed',     type: 'bool'    },
        { name: 'challengerClaimed', type: 'bool'    },
      ],
    }],
  },
  {
    type: 'function', name: 'getBacking', stateMutability: 'view',
    inputs:  [{ name: 'postId', type: 'bytes32' }, { name: 'w', type: 'address' }],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'amount',      type: 'uint256' },
        { name: 'sideIsPoster', type: 'bool'   },
        { name: 'claimed',     type: 'bool'    },
      ],
    }],
  },
  {
    type: 'function', name: 'previewClaim', stateMutability: 'view',
    inputs:  [{ name: 'postId', type: 'bytes32' }, { name: 'claimant', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'getTrustScore', stateMutability: 'view',
    inputs:  [{ name: 'w', type: 'address' }],
    outputs: [{ type: 'int256' }],
  },
  // writes
  { type: 'function', name: 'openChallenge', stateMutability: 'nonpayable', inputs: [{ name: 'postId', type: 'bytes32' }], outputs: [] },
  { type: 'function', name: 'fold',          stateMutability: 'nonpayable', inputs: [{ name: 'postId', type: 'bytes32' }], outputs: [] },
  { type: 'function', name: 'call',          stateMutability: 'nonpayable', inputs: [{ name: 'postId', type: 'bytes32' }], outputs: [] },
  {
    type: 'function', name: 'back', stateMutability: 'nonpayable',
    inputs: [
      { name: 'postId',      type: 'bytes32' },
      { name: 'sideIsPoster', type: 'bool'   },
      { name: 'amount',      type: 'uint256' },
    ],
    outputs: [],
  },
  { type: 'function', name: 'settle',               stateMutability: 'nonpayable', inputs: [{ name: 'postId', type: 'bytes32' }], outputs: [] },
  { type: 'function', name: 'claim',                stateMutability: 'nonpayable', inputs: [{ name: 'postId', type: 'bytes32' }], outputs: [] },
  { type: 'function', name: 'claimCanon',           stateMutability: 'nonpayable', inputs: [{ name: 'postId', type: 'bytes32' }], outputs: [] },
  { type: 'function', name: 'claimResponseTimeout', stateMutability: 'nonpayable', inputs: [{ name: 'postId', type: 'bytes32' }], outputs: [] },
] as const

// ─── TheBasin ABI ─────────────────────────────────────────────────────────────

export const BASIN_ABI = [
  // reads
  {
    type: 'function', name: 'poolStats', stateMutability: 'view', inputs: [],
    outputs: [
      { name: 'totalUsdc',      type: 'uint256' },
      { name: 'idleUsdc',       type: 'uint256' },
      { name: 'deployedUsdc',   type: 'uint256' },
      { name: 'shareSupply',    type: 'uint256' },
      { name: 'sharePriceUsdc', type: 'uint256' },
    ],
  },
  {
    type: 'function', name: 'previewWithdraw', stateMutability: 'view',
    inputs:  [{ name: 'depositor', type: 'address' }],
    outputs: [
      { name: 'usdcOut',           type: 'uint256' },
      { name: 'timelockEnds',      type: 'uint256' },
      { name: 'timelockMet',       type: 'bool'    },
      { name: 'liquidityAvailable', type: 'bool'   },
    ],
  },
  {
    type: 'function', name: 'shares', stateMutability: 'view',
    inputs:  [{ name: '', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'convertToShares', stateMutability: 'view',
    inputs:  [{ name: 'assets', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'isEligible', stateMutability: 'view',
    inputs:  [{ name: 'postId', type: 'bytes32' }],
    outputs: [{ name: 'eligible', type: 'bool' }, { name: 'reason', type: 'string' }],
  },
  // writes
  { type: 'function', name: 'deposit',   stateMutability: 'nonpayable', inputs: [{ name: 'amount',       type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'withdraw',  stateMutability: 'nonpayable', inputs: [{ name: 'sharesToBurn', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'backPost',  stateMutability: 'nonpayable', inputs: [{ name: 'postId',       type: 'bytes32' }], outputs: [] },
  { type: 'function', name: 'claimPost', stateMutability: 'nonpayable', inputs: [{ name: 'postId',       type: 'bytes32' }], outputs: [] },
] as const

// ─── ERC-20 (USDC approve + allowance + balanceOf) ────────────────────────────

export const ERC20_ABI = [
  {
    type: 'function', name: 'approve', stateMutability: 'nonpayable',
    inputs:  [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function', name: 'allowance', stateMutability: 'view',
    inputs:  [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'balanceOf', stateMutability: 'view',
    inputs:  [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const
