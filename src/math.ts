import { CLAMM, Utils } from '../artifacts/ts'
import { LiquidityResult, Pool, Position, SingleTokenLiquidity, Tick } from '../artifacts/ts/types'
import { LiquidityScale, PercentageScale, SqrtPriceScale } from './consts'

export const calculateSqrtPrice = async (tickIndex: bigint): Promise<bigint> => {
  return (
    await Utils.tests.calculateSqrtPrice({
      testArgs: { tickIndex }
    })
  ).returns
}

export const getLiquidityByX = async (
  x: bigint,
  lowerTick: bigint,
  upperTick: bigint,
  currentSqrtPrice: bigint,
  roundingUp: boolean
): Promise<SingleTokenLiquidity> => {
  return (
    await Utils.tests.getLiquidityByX({
      testArgs: {
        x,
        lowerTick,
        upperTick,
        currentSqrtPrice,
        roundingUp
      }
    })
  ).returns
}

export const getLiquidityByY = async (
  y: bigint,
  lowerTick: bigint,
  upperTick: bigint,
  currentSqrtPrice: bigint,
  roundingUp: boolean
): Promise<SingleTokenLiquidity> => {
  return (
    await Utils.tests.getLiquidityByY({
      testArgs: {
        y,
        lowerTick,
        upperTick,
        currentSqrtPrice,
        roundingUp
      }
    })
  ).returns
}

export const getLiquidity = async (
  x: bigint,
  y: bigint,
  lowerTick: bigint,
  upperTick: bigint,
  currentSqrtPrice: bigint,
  roundingUp: boolean
): Promise<LiquidityResult> => {
  return (
    await Utils.tests.getLiquidity({
      testArgs: {
        x,
        y,
        lowerTick,
        upperTick,
        currentSqrtPrice,
        roundingUp
      }
    })
  ).returns
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
        sqrtPriceA,
        sqrtPriceB,
        liquidity,
        roundingUp
      }
    })
  ).returns
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
        sqrtPrice,
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
  ).returns
}

export const getMinSqrtPrice = async (tickSpacing: bigint): Promise<bigint> => {
  return (
    await Utils.tests.getMinSqrtPrice({
      testArgs: {
        tickSpacing
      }
    })
  ).returns
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

export const calculateFee = async (
  pool: Pool,
  position: Position,
  lowerTick: Tick,
  upperTick: Tick
): Promise<[bigint, bigint]> => {
  return (
    await Utils.tests.calculateFee({
      testArgs: {
        tickLowerIndex: lowerTick.index,
        tickLowerFeeGrowthOutsideX: lowerTick.feeGrowthOutsideX,
        tickLowerFeeGrowthOutsideY: lowerTick.feeGrowthOutsideY,
        tickUpperIndex: upperTick.index,
        tickUpperFeeGrowthOutsideX: upperTick.feeGrowthOutsideX,
        tickUpperFeeGrowthOutsideY: upperTick.feeGrowthOutsideY,
        tickCurrent: pool.currentTickIndex,
        globalFeeGrowthX: pool.feeGrowthGlobalX,
        globalFeeGrowthY: pool.feeGrowthGlobalY,
        positionFeeGrowthInsideX: position.feeGrowthInsideX,
        positionFeeGrowthInsideY: position.feeGrowthInsideY,
        positionLiquidity: position.liquidity
      }
    })
  ).returns
}

export const calculateTokenAmounts = async (
  pool: Pool,
  position: Position
): Promise<[bigint, bigint, boolean]> => {
  return (
    await CLAMM.tests.calculateAmountDelta({
      testArgs: {
        currentTickIndex: pool.currentTickIndex,
        currentSqrtPrice: pool.sqrtPrice,
        liquidityDelta: position.liquidity,
        liquiditySign: false,
        upperTick: position.upperTickIndex,
        lowerTick: position.lowerTickIndex
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
  return (sqrtPrice * sqrtPrice) / toSqrtPrice(1n)
}

export const priceToSqrtPrice = (price: bigint): bigint => {
  return sqrt(price * toSqrtPrice(1n))
}

export const calculateSqrtPriceAfterSlippage = (
  sqrtPrice: bigint,
  slippage: bigint,
  up: boolean
): bigint => {
  if (slippage === 0n) {
    return sqrtPrice
  }

  const multiplier = toPercentage(1n) + (up ? slippage : -slippage)
  const price = sqrtPriceToPrice(sqrtPrice)
  const priceWithSlippage = price * multiplier * toPercentage(1n)
  const sqrtPriceWithSlippage = priceToSqrtPrice(priceWithSlippage) / toPercentage(1n)

  return sqrtPriceWithSlippage
}

export const toLiquidity = (value: bigint, offset = 0n) => {
  return value * 10n ** (LiquidityScale - offset)
}

export const toSqrtPrice = (value: bigint, offset = 0n) => {
  return value * 10n ** (SqrtPriceScale - offset)
}

export const toPercentage = (value: bigint, offset = 0n) => {
  return value * 10n ** (PercentageScale - offset)
}
