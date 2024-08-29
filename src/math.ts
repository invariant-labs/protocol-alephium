import { CLAMM, Utils } from '../artifacts/ts'
import {
  FEE_GROWTH_SCALE,
  FIXED_POINT_SCALE,
  LIQUIDITY_SCALE,
  PERCENTAGE_DENOMINATOR,
  PERCENTAGE_SCALE,
  PRICE_SCALE,
  SQRT_PRICE_DENOMINATOR,
  SQRT_PRICE_SCALE
} from './consts'
import {
  Pool,
  Position,
  Tick,
  LiquidityResult,
  unwrapLiquidityResult,
  SingleTokenLiquidity,
  unwrapSingleTokenLiquidity,
  FixedPoint,
  TokenAmount,
  FeeGrowth,
  Percentage,
  SqrtPrice,
  Liquidity,
  Price
} from './types'

export const calculateSqrtPrice = async (tickIndex: bigint): Promise<SqrtPrice> => {
  return (
    await Utils.tests.calculateSqrtPrice({
      testArgs: { tickIndex }
    })
  ).returns.v as SqrtPrice
}

export const getLiquidityByX = async (
  x: TokenAmount,
  lowerTick: bigint,
  upperTick: bigint,
  currentSqrtPrice: SqrtPrice,
  roundingUp: boolean
): Promise<SingleTokenLiquidity> => {
  return unwrapSingleTokenLiquidity(
    (
      await Utils.tests.getLiquidityByX({
        testArgs: {
          x: { v: x },
          lowerTick,
          upperTick,
          currentSqrtPrice: { v: currentSqrtPrice },
          roundingUp
        }
      })
    ).returns
  )
}

export const getLiquidityByY = async (
  y: TokenAmount,
  lowerTick: bigint,
  upperTick: bigint,
  currentSqrtPrice: SqrtPrice,
  roundingUp: boolean
): Promise<SingleTokenLiquidity> => {
  return unwrapSingleTokenLiquidity(
    (
      await Utils.tests.getLiquidityByY({
        testArgs: {
          y: { v: y },
          lowerTick,
          upperTick,
          currentSqrtPrice: { v: currentSqrtPrice },
          roundingUp
        }
      })
    ).returns
  )
}

export const getLiquidity = async (
  x: TokenAmount,
  y: TokenAmount,
  lowerTick: bigint,
  upperTick: bigint,
  currentSqrtPrice: SqrtPrice,
  roundingUp: boolean
): Promise<LiquidityResult> => {
  return unwrapLiquidityResult(
    (
      await Utils.tests.getLiquidity({
        testArgs: {
          x: { v: x },
          y: { v: y },
          lowerTick,
          upperTick,
          currentSqrtPrice: { v: currentSqrtPrice },
          roundingUp
        }
      })
    ).returns
  )
}

export const getDeltaY = async (
  sqrtPriceA: SqrtPrice,
  sqrtPriceB: SqrtPrice,
  liquidity: Liquidity,
  roundingUp: boolean
): Promise<TokenAmount> => {
  return (
    await CLAMM.tests.getDeltaY({
      testArgs: {
        sqrtPriceA: { v: sqrtPriceA },
        sqrtPriceB: { v: sqrtPriceB },
        liquidity: { v: liquidity },
        roundingUp
      }
    })
  ).returns.v as TokenAmount
}

export const getMaxTick = async (tickSpacing: bigint): Promise<bigint> => {
  return (
    await Utils.tests.getMaxTick({
      testArgs: {
        tickSpacing
      }
    })
  ).returns
}

export const getMinTick = async (tickSpacing: bigint): Promise<bigint> => {
  return (
    await Utils.tests.getMinTick({
      testArgs: {
        tickSpacing
      }
    })
  ).returns
}

export const getMaxChunk = async (tickSpacing: bigint): Promise<bigint> => {
  return (
    await Utils.tests.getMaxChunk({
      testArgs: {
        tickSpacing
      }
    })
  ).returns
}

export const calculateTick = async (sqrtPrice: SqrtPrice, tickSpacing: bigint): Promise<bigint> => {
  return (
    await Utils.tests.getTickAtSqrtPrice({
      testArgs: {
        sqrtPrice: { v: sqrtPrice },
        tickSpacing
      }
    })
  ).returns
}

export const getMaxSqrtPrice = async (tickSpacing: bigint): Promise<SqrtPrice> => {
  return (
    await Utils.tests.getMaxSqrtPrice({
      testArgs: {
        tickSpacing
      }
    })
  ).returns.v as SqrtPrice
}

export const getMinSqrtPrice = async (tickSpacing: bigint): Promise<SqrtPrice> => {
  return (
    await Utils.tests.getMinSqrtPrice({
      testArgs: {
        tickSpacing
      }
    })
  ).returns.v as SqrtPrice
}

export const isTokenX = async (candidate: string, compareTo: string): Promise<boolean> => {
  return (
    await Utils.tests.isTokenX({
      testArgs: {
        candidate,
        compareTo
      }
    })
  ).returns
}

export async function getTickAtSqrtPrice(
  sqrtPrice: SqrtPrice,
  tickSpacing: bigint
): Promise<bigint> {
  return (
    await CLAMM.tests.getTickAtSqrtPrice({
      testArgs: { sqrtPrice: { v: sqrtPrice }, tickSpacing }
    })
  ).returns
}

export const tickToPosition = async (
  tick: bigint,
  tickSpacing: bigint
): Promise<[bigint, bigint]> => {
  const [chunk, bit] = (await Utils.tests.tickToPosition({ testArgs: { tick, tickSpacing } }))
    .returns

  return [chunk, bit]
}

export const calculateFee = async (
  pool: Pool,
  position: Position,
  lowerTick: Tick,
  upperTick: Tick
): Promise<[TokenAmount, TokenAmount]> => {
  const [{ v: tokensOwedX }, { v: tokensOwedY }] = (
    await Utils.tests.calculateFee({
      testArgs: {
        tickLowerIndex: lowerTick.index,
        tickLowerFeeGrowthOutsideX: { v: lowerTick.feeGrowthOutsideX },
        tickLowerFeeGrowthOutsideY: { v: lowerTick.feeGrowthOutsideY },
        tickUpperIndex: upperTick.index,
        tickUpperFeeGrowthOutsideX: { v: upperTick.feeGrowthOutsideX },
        tickUpperFeeGrowthOutsideY: { v: upperTick.feeGrowthOutsideY },
        tickCurrent: pool.currentTickIndex,
        globalFeeGrowthX: { v: pool.feeGrowthGlobalX },
        globalFeeGrowthY: { v: pool.feeGrowthGlobalY },
        positionFeeGrowthInsideX: { v: position.feeGrowthInsideX },
        positionFeeGrowthInsideY: { v: position.feeGrowthInsideY },
        positionLiquidity: { v: position.liquidity }
      }
    })
  ).returns

  return [tokensOwedX as TokenAmount, tokensOwedY as TokenAmount]
}

export const calculateTokenAmounts = async (
  pool: Pool,
  position: Position
): Promise<[TokenAmount, TokenAmount, boolean]> => {
  const [{ v: amountX }, { v: amountY }, updateLiquidity] = (
    await CLAMM.tests.calculateAmountDelta({
      testArgs: {
        currentTickIndex: pool.currentTickIndex,
        currentSqrtPrice: { v: pool.sqrtPrice },
        liquidityDelta: { v: position.liquidity },
        liquiditySign: false,
        upperTick: position.upperTickIndex,
        lowerTick: position.lowerTickIndex
      }
    })
  ).returns
  return [amountX as TokenAmount, amountY as TokenAmount, updateLiquidity]
}

export const bitPositionToTick = async (
  chunk: bigint,
  bit: bigint,
  tickSpacing: bigint
): Promise<bigint> => {
  return (
    await Utils.tests.bitPositionToTick({
      testArgs: {
        chunk,
        bit,
        tickSpacing
      }
    })
  ).returns
}
const sqrt = (value: bigint): bigint => {
  if (value < 0n) {
    throw 'square root of negative numbers is not supported'
  }

  if (value < 2n) {
    return value
  }

  return newtonIteration(value, 1n)
}

const newtonIteration = (n: bigint, x0: bigint): bigint => {
  const x1 = (n / x0 + x0) >> 1n
  if (x0 === x1 || x0 === x1 - 1n) {
    return x0
  }
  return newtonIteration(n, x1)
}

export const sqrtPriceToPrice = (sqrtPrice: SqrtPrice): Price => {
  return ((sqrtPrice * sqrtPrice) / SQRT_PRICE_DENOMINATOR) as Price
}

export const priceToSqrtPrice = (price: Price): SqrtPrice => {
  return sqrt(price * SQRT_PRICE_DENOMINATOR) as SqrtPrice
}

export const calculateSqrtPriceAfterSlippage = (
  sqrtPrice: SqrtPrice,
  slippage: Percentage,
  up: boolean
): SqrtPrice => {
  if (slippage === 0n) {
    return sqrtPrice
  }

  const multiplier = PERCENTAGE_DENOMINATOR + (up ? slippage : -slippage)
  const price = sqrtPriceToPrice(sqrtPrice)
  const priceWithSlippage = (price * multiplier * PERCENTAGE_DENOMINATOR) as Price
  const sqrtPriceWithSlippage = priceToSqrtPrice(priceWithSlippage) / PERCENTAGE_DENOMINATOR

  return sqrtPriceWithSlippage as SqrtPrice
}

export const calculatePriceImpact = (
  startingSqrtPrice: SqrtPrice,
  endingSqrtPrice: SqrtPrice
): Percentage => {
  const startingPrice = startingSqrtPrice * startingSqrtPrice
  const endingPrice = endingSqrtPrice * endingSqrtPrice
  const diff = startingPrice - endingPrice

  const nominator = diff > 0n ? diff : -diff
  const denominator = startingPrice > endingPrice ? startingPrice : endingPrice

  return ((nominator * PERCENTAGE_DENOMINATOR) / denominator) as Percentage
}

export const toLiquidity = (value: bigint, offset = 0n): Liquidity => {
  if (offset > LIQUIDITY_SCALE)
    throw new Error(`offset must be less than or equal to ${LIQUIDITY_SCALE}`)
  return (value * 10n ** (LIQUIDITY_SCALE - offset)) as Liquidity
}

export const toSqrtPrice = (value: bigint, offset = 0n): SqrtPrice => {
  if (offset > SQRT_PRICE_SCALE)
    throw new Error(`offset must be less than or equal to ${SQRT_PRICE_SCALE}`)
  return (value * 10n ** (SQRT_PRICE_SCALE - offset)) as SqrtPrice
}

export const toPrice = (value: bigint, offset = 0n): Price => {
  if (offset > PRICE_SCALE) throw new Error(`offset must be less than or equal to ${PRICE_SCALE}`)
  return (value * 10n ** (PRICE_SCALE - offset)) as Price
}

export const toPercentage = (value: bigint, offset = 0n): Percentage => {
  if (offset > PERCENTAGE_SCALE)
    throw new Error(`offset must be less than or equal to ${PERCENTAGE_SCALE}`)
  return (value * 10n ** (PERCENTAGE_SCALE - offset)) as Percentage
}

export const toFeeGrowth = (value: bigint, offset = 0n): FeeGrowth => {
  if (offset > FEE_GROWTH_SCALE)
    throw new Error(`offset must be less than or equal to ${FEE_GROWTH_SCALE}`)
  return (value * 10n ** (FEE_GROWTH_SCALE - offset)) as FeeGrowth
}

export const toTokenAmount = (value: bigint, decimals: bigint, offset = 0n): TokenAmount => {
  if (offset > decimals) throw new Error(`offset must be less than or equal to ${decimals}`)
  return (value * 10n ** (decimals - offset)) as TokenAmount
}

export const toFixedPoint = (value: bigint, offset = 0n): FixedPoint => {
  if (offset > FIXED_POINT_SCALE)
    throw new Error(`offset must be less than or equal to ${FIXED_POINT_SCALE}`)
  return (value * 10n ** (FIXED_POINT_SCALE - offset)) as FixedPoint
}
