import { CLAMM, Invariant, Uints } from '../artifacts/ts'

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
  SearchRange,
  InvariantError
} = Invariant.consts

export const { CLAMMError, DecimalError } = CLAMM.consts

export const {
  // broken in Alephium 1.0.1, their conversion uses BigInt(n), loss of precision
  // MaxU256,
  WordSize,
  ArithmeticError
} = Uints.consts

export const MaxU256 =
  115792089237316195423570985008687907853269984665640564039457584007913129639935n

export const MaxSqrtPrice = 65535383934512647000000000000n
export const MinSqrtPrice = 15258932000000000000n
