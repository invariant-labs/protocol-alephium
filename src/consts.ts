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
  // MaxSqrtPrice,
  // MinSqrtPrice,
  MaxFeeTiers,
  SearchRange,
  InvariantError,
  ChunksPerBatch,
  ChunkSize
} = Invariant.consts

export const { CLAMMError, DecimalError, WordSize, ArithmeticError } = CLAMM.consts
export const { UtilsError } = Utils.consts
export const { ReserveError } = Reserve.consts

export const MaxU256 =
  115792089237316195423570985008687907853269984665640564039457584007913129639935n

export const MaxSqrtPrice = 65535383934512647000000000000n
export const MinSqrtPrice = 15258932000000000000n
export const MAX_BATCHES_QUERIED = 18n

export enum VMError {
  ArithmeticError = 'ArithmeticError',
  OutOfGas = 'OutOfGas',
  MaxStoredAssets = 'max token number is 8'
}
