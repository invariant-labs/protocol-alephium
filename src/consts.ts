import { Invariant, CLAMM, Uints } from '../artifacts/ts'

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
  SearchRange,
  InvariantError
} = Invariant.consts

export const { CLAMMError } = CLAMM.consts

export const {
  // broken in Alephium 1.0.1, their conversion uses BigInt(n), loss of precision
  // MaxU256,
  WordSize,
  ArithmeticError
} = Uints.consts

export const MaxU256 =
  115792089237316195423570985008687907853269984665640564039457584007913129639935n
