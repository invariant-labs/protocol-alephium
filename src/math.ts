import { Utils } from '../artifacts/ts'

export const calculateSqrtPrice = async (tickIndex: bigint) => {
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
) => {
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
) => {
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
) => {
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
