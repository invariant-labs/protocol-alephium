import { CLAMM, Invariant } from '../artifacts/ts'
import {
  MIN_SQRT_PRICE as _MIN_SQRT_PRICE,
  MAX_SQRT_PRICE as _MAX_SQRT_PRICE,
  SQRT_PRICE_DENOMINATOR as _SQRT_PRICE_DENOMINATOR,
  FEE_GROWTH_DENOMINATOR as _FEE_GROWTH_DENOMINATOR,
  LIQUIDITY_DENOMINATOR as _LIQUIDITY_DENOMINATOR,
  TOKEN_AMOUNT_DENOMINATOR as _TOKEN_AMOUNT_DENOMINATOR,
  PERCENTAGE_DENOMINATOR as _PERCENTAGE_DENOMINATOR,
  FIXED_POINT_DENOMINATOR as _FIXED_POINT_DENOMINATOR,
  SQRT_PRICE_SCALE
} from '../artifacts/ts/constants'
import { Network } from './network'
import {
  FeeGrowth,
  FixedPoint,
  Liquidity,
  Options,
  Percentage,
  Price,
  SqrtPrice,
  TokenAmount
} from './types'

export * from '../artifacts/ts/constants'

export const MIN_SQRT_PRICE = _MIN_SQRT_PRICE as SqrtPrice
export const MAX_SQRT_PRICE = _MAX_SQRT_PRICE as SqrtPrice
export const SQRT_PRICE_DENOMINATOR = _SQRT_PRICE_DENOMINATOR as SqrtPrice
export const FEE_GROWTH_DENOMINATOR = _FEE_GROWTH_DENOMINATOR as FeeGrowth
export const LIQUIDITY_DENOMINATOR = _LIQUIDITY_DENOMINATOR as Liquidity
export const TOKEN_AMOUNT_DENOMINATOR = _TOKEN_AMOUNT_DENOMINATOR as TokenAmount
export const PERCENTAGE_DENOMINATOR = _PERCENTAGE_DENOMINATOR as Percentage
export const FIXED_POINT_DENOMINATOR = _FIXED_POINT_DENOMINATOR as FixedPoint

export const { SEARCH_RANGE, CHUNKS_PER_BATCH, HALF_CHUNK_SIZE, CHUNK_SIZE } = Invariant.consts

export const {
  WORD_SIZE,
  LOG2_ONE,
  LOG2_DOUBLE_ONE,
  LOG2_SCALE,
  LOG2_HALF,
  LOG2_ACCURACY,
  LOG2_TWO,
  LOG2_SQRT10001,
  LOG2_NEGATIVE_MAX_LOSE
} = CLAMM.consts

export const PRICE_SCALE = SQRT_PRICE_SCALE
export const PRICE_DENOMINATOR = _SQRT_PRICE_DENOMINATOR as Price

export const MAX_BATCHES_QUERIED = 18n
export const MAX_POOL_KEYS_RETURNED = 117n
export const POSITIONS_ENTRIES_LIMIT = 83n
export const MAX_LIQUIDITY_TICKS_QUERIED = 269n

export enum VMError {
  ArithmeticError = 'ArithmeticError',
  OutOfGas = 'OutOfGas',
  NotEnoughBalance = 'Not enough approved balance for address',
  MaxStoredAssets = 'max token number is 8',
  VMExecutionError = 'VM execution error: Assertion Failed in Contract'
}

export const INVARIANT_ADDRESS = {
  [Network.Devnet]: '',
  [Network.Testnet]: '28g1F1cHPyGxb9XKi4hDjApfUpA6JyndKTLarnwwzys9R',
  [Network.Mainnet]: ''
}
export const BTC_ID = {
  [Network.Devnet]: '',
  [Network.Testnet]: 'd3f5950401749ddca0f335979d71d232d12c98b73e703bd566c864f902e0c300',
  [Network.Mainnet]: ''
}
export const ETH_ID = {
  [Network.Devnet]: '',
  [Network.Testnet]: 'af0745ba55dd9b22699db77a8c6883b111accad3719011baec88f33668194500',
  [Network.Mainnet]: ''
}
export const USDC_ID = {
  [Network.Devnet]: '',
  [Network.Testnet]: 'c33e1d7072d2f90cc3ecb63d8d9fb72094b1d39052f42ca5ed0d22c7579d3400',
  [Network.Mainnet]: ''
}
export const USDT_ID = {
  [Network.Devnet]: '',
  [Network.Testnet]: '0c0ec8cc98ca8db18a1ca334de58741616d643837057c718cf547dd51a6c7b00',
  [Network.Mainnet]: ''
}
export const SOL_ID = {
  [Network.Devnet]: '',
  [Network.Testnet]: '1da0dc0348b3ff8ae3853e73616ddece1f68a7017b04fc610eb560bf9b6f9a00',
  [Network.Mainnet]: ''
}

export const CONFIRMATIONS = 1
export const REQUEST_INTERVAL = 1000
export const DEFAULT_OPTIONS: Options = { waitForTxConfirmation: true }
