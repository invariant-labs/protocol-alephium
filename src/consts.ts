import { FeeTiers, Invariant } from '../artifacts/ts'

export const SQRT_PRICE_SCALE = 24n
export const LIQUIDITY_SCALE = 5n
export const FEE_GROWTH_SCALE = 28n
export const FIXED_POINT_SCALE = 12n
export const PERCENTAGE_SCALE = 12n
export const TOKEN_AMOUNT_SCALE = 0n
export const FIXED_POINT_DENOMINATOR = 10n ** 12n
export const GLOBAL_MAX_TICK = 221818n
export const GLOBAL_MIN_TICK = -221818n
export const MAX_SQRT_PRICE = 65535383934512647000000000000n
export const MIN_SQRT_PRICE = 15258932000000000000n

export const { FeeTiersError } = FeeTiers.consts
export const { InvariantError } = Invariant.consts
