import { CLAMM, Utils } from '../artifacts/ts'
import {
  FeeGrowthScale,
  LiquidityScale,
  PercentageDenominator,
  PercentageScale,
  SqrtPriceDenominator,
  SqrtPriceScale
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

export const calculateFee = async (
  pool: Pool,
  position: Position,
  lowerTick: Tick,
  upperTick: Tick
): Promise<[bigint, bigint]> => {
  const returns = (
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

  return [returns[0].v, returns[1].v]
}

export const calculateTokenAmounts = async (
  pool: Pool,
  position: Position
): Promise<[bigint, bigint, boolean]> => {
  const returns = (
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
  return [returns[0].v, returns[1].v, returns[2]]
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
  return (sqrtPrice * sqrtPrice) / SqrtPriceDenominator
}

export const priceToSqrtPrice = (price: bigint): bigint => {
  return sqrt(price * SqrtPriceDenominator)
}

export const calculateSqrtPriceAfterSlippage = (
  sqrtPrice: bigint,
  slippage: bigint,
  up: boolean
): bigint => {
  if (slippage === 0n) {
    return sqrtPrice
  }

  const multiplier = PercentageDenominator + (up ? slippage : -slippage)
  const price = sqrtPriceToPrice(sqrtPrice)
  const priceWithSlippage = price * multiplier * PercentageDenominator
  const sqrtPriceWithSlippage = priceToSqrtPrice(priceWithSlippage) / PercentageDenominator

  return sqrtPriceWithSlippage
}

export const toLiquidity = (value: bigint, offset = 0n) => {
  if (offset >= LiquidityScale) throw new Error(`offset must be less than ${LiquidityScale}`)
  return value * 10n ** (LiquidityScale - offset)
}

export const toSqrtPrice = (value: bigint, offset = 0n): bigint => {
  if (offset >= SqrtPriceScale) throw new Error(`offset must be less than ${SqrtPriceScale}`)
  return value * 10n ** (SqrtPriceScale - offset)
}

export const toPercentage = (value: bigint, offset = 0n): bigint => {
  if (offset >= PercentageScale) throw new Error(`offset must be less than ${PercentageScale}`)
  return value * 10n ** (PercentageScale - offset)
}

export const toFeeGrowth = (value: bigint, offset = 0n): bigint => {
  if (offset >= FeeGrowthScale) throw new Error(`offset must be less than ${FeeGrowthScale}`)
  return value * 10n ** (FeeGrowthScale - offset)
}
