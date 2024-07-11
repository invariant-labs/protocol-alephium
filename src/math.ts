import { CLAMM, Utils } from '../artifacts/ts'
import { LiquidityResult, Pool, Position, SingleTokenLiquidity, Tick } from '../artifacts/ts/types'

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
