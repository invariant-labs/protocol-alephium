import { CLAMM, Utils } from '../artifacts/ts'
import {
  FEE_GROWTH_SCALE,
  LIQUIDITY_SCALE,
  PERCENTAGE_DENOMINATOR,
  PERCENTAGE_SCALE,
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
  unwrapSingleTokenLiquidity
} from './types'

export const calculateSqrtPrice = async (tickIndex: bigint): Promise<bigint> => {
  return (
    await Utils.tests.calculateSqrtPrice({
      testArgs: { tickIndex }
    })
  ).returns.v
}

export const getLiquidityByX = async (
  x: bigint,
  lowerTick: bigint,
  upperTick: bigint,
  currentSqrtPrice: bigint,
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
  y: bigint,
  lowerTick: bigint,
  upperTick: bigint,
  currentSqrtPrice: bigint,
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
  x: bigint,
  y: bigint,
  lowerTick: bigint,
  upperTick: bigint,
  currentSqrtPrice: bigint,
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
  sqrtPriceA: bigint,
  sqrtPriceB: bigint,
  liquidity: bigint,
  roundingUp: boolean
): Promise<bigint> => {
  return (
    await CLAMM.tests.getDeltaY({
      testArgs: {
        sqrtPriceA: { v: sqrtPriceA },
        sqrtPriceB: { v: sqrtPriceB },
        liquidity: { v: liquidity },
        roundingUp
      }
    })
  ).returns.v
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

export const calculateTick = async (sqrtPrice: bigint, tickSpacing: bigint): Promise<bigint> => {
  return (
    await Utils.tests.getTickAtSqrtPrice({
      testArgs: {
        sqrtPrice: { v: sqrtPrice },
        tickSpacing
      }
    })
  ).returns
}

export const getMaxSqrtPrice = async (tickSpacing: bigint): Promise<bigint> => {
  return (
    await Utils.tests.getMaxSqrtPrice({
      testArgs: {
        tickSpacing
      }
    })
  ).returns.v
}

export const getMinSqrtPrice = async (tickSpacing: bigint): Promise<bigint> => {
  return (
    await Utils.tests.getMinSqrtPrice({
      testArgs: {
        tickSpacing
      }
    })
  ).returns.v
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

export async function getTickAtSqrtPrice(sqrtPrice: bigint, tickSpacing: bigint): Promise<bigint> {
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
): Promise<[bigint, bigint]> => {
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

  return [tokensOwedX, tokensOwedY]
}

export const calculateTokenAmounts = async (
  pool: Pool,
  position: Position
): Promise<[bigint, bigint, boolean]> => {
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
  return [amountX, amountY, updateLiquidity]
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

export const sqrtPriceToPrice = (sqrtPrice: bigint): bigint => {
  return (sqrtPrice * sqrtPrice) / SQRT_PRICE_DENOMINATOR
}

export const priceToSqrtPrice = (price: bigint): bigint => {
  return sqrt(price * SQRT_PRICE_DENOMINATOR)
}

export const calculateSqrtPriceAfterSlippage = (
  sqrtPrice: bigint,
  slippage: bigint,
  up: boolean
): bigint => {
  if (slippage === 0n) {
    return sqrtPrice
  }

  const multiplier = PERCENTAGE_DENOMINATOR + (up ? slippage : -slippage)
  const price = sqrtPriceToPrice(sqrtPrice)
  const priceWithSlippage = price * multiplier * PERCENTAGE_DENOMINATOR
  const sqrtPriceWithSlippage = priceToSqrtPrice(priceWithSlippage) / PERCENTAGE_DENOMINATOR

  return sqrtPriceWithSlippage
}

export const toLiquidity = (value: bigint, offset = 0n) => {
  if (offset > LIQUIDITY_SCALE)
    throw new Error(`offset must be less than or equal to ${LIQUIDITY_SCALE}`)
  return value * 10n ** (LIQUIDITY_SCALE - offset)
}

export const toSqrtPrice = (value: bigint, offset = 0n): bigint => {
  if (offset > SQRT_PRICE_SCALE)
    throw new Error(`offset must be less than or equal to ${SQRT_PRICE_SCALE}`)
  return value * 10n ** (SQRT_PRICE_SCALE - offset)
}

export const toPercentage = (value: bigint, offset = 0n): bigint => {
  if (offset > PERCENTAGE_SCALE)
    throw new Error(`offset must be less than or equal to ${PERCENTAGE_SCALE}`)
  return value * 10n ** (PERCENTAGE_SCALE - offset)
}

export const toFeeGrowth = (value: bigint, offset = 0n): bigint => {
  if (offset > FEE_GROWTH_SCALE)
    throw new Error(`offset must be less than or equal to ${FEE_GROWTH_SCALE}`)
  return value * 10n ** (FEE_GROWTH_SCALE - offset)
}
