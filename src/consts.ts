import { CLAMM, Invariant, Reserve, Utils } from '../artifacts/ts'

export const {
  SqrtPriceScale,
  LiquidityScale,
  FeeGrowthScale,
  FixedPointScale,
  PercentageScale,
  TokenAmountScale,
  FixedPointDenominator,
  GlobalMaxTick,
  GlobalMinTick,
  MaxSqrtPrice,
  MinSqrtPrice,
  MaxFeeTiers,
  SearchRange,
  InvariantError,
  ChunksPerBatch,
  ChunkSize
} = Invariant.consts

export const { CLAMMError, DecimalError, WordSize, ArithmeticError } = CLAMM.consts
export const { UtilsError, MaxU256 } = Utils.consts
export const { ReserveError } = Reserve.consts

export const MAX_BATCHES_QUERIED = 18n
export const MAX_POOL_KEYS_QUERIED = 117n

export enum VMError {
  ArithmeticError = 'ArithmeticError',
  OutOfGas = 'OutOfGas',
  MaxStoredAssets = 'max token number is 8'
}
