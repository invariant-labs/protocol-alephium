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
export const MAX_POOL_KEYS_QUERIED = 117n
export const MAX_POSITIONS_QUERIED = 83n
export const MAX_LIQUIDITY_TICKS_QUERIED = 269n

export enum VMError {
  ArithmeticError = 'ArithmeticError',
  OutOfGas = 'OutOfGas',
  NotEnoughBalance = 'Not enough approved balance for address',
  MaxStoredAssets = 'max token number is 8'
}
