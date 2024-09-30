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
  MaxStoredAssets = 'max token number is 8'
}

export const INVARIANT_ADDRESS = {
  [Network.Devnet]: '',
  [Network.Testnet]: '2326FKQoEWtErAw85891kY1v2qHQJdVCpFArbnQDzrZxK',
  [Network.Mainnet]: ''
}
export const BTC_ID = {
  [Network.Devnet]: '',
  [Network.Testnet]: '7463907d430f8541526537af69e11db174d614ffa931bbf2c95ffe15d2cc6a00',
  [Network.Mainnet]: ''
}
export const ETH_ID = {
  [Network.Devnet]: '',
  [Network.Testnet]: '9c396d6bfb35ff87959801795ffcbb19078d8d04ad84a58af082c5763d070d00',
  [Network.Mainnet]: ''
}
export const USDC_ID = {
  [Network.Devnet]: '',
  [Network.Testnet]: 'bbff7962b2e210e8292e466f5a6a35c2ee24dfb55b1bbaabaa27a1cad1bec100',
  [Network.Mainnet]: ''
}
export const USDT_ID = {
  [Network.Devnet]: '',
  [Network.Testnet]: 'b795aab5d9d5288e1673a6ec7ffc600fc48a7ed9f716704123e60e2b77e7cb00',
  [Network.Mainnet]: ''
}
export const SOL_ID = {
  [Network.Devnet]: '',
  [Network.Testnet]: '2505310840f04d696887aebc8ecc27e5d2e0a389d9e037e17d2ebe0550277200',
  [Network.Mainnet]: ''
}
