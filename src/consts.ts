import { CLAMM, Invariant } from '../artifacts/ts'
import { SQRT_PRICE_DENOMINATOR, SQRT_PRICE_SCALE } from '../artifacts/ts/constants'

export * from '../artifacts/ts/constants'

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
export const PRICE_DENOMINATOR = SQRT_PRICE_DENOMINATOR

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
