import { ZERO_ADDRESS } from '@alephium/web3'
import { CLAMM, Invariant } from '../artifacts/ts'
import { Pool, Position } from '../artifacts/ts/types'

const DEFAULT_INVT_INITIAL_FIELDS = {
  config: {
    admin: ZERO_ADDRESS,
    protocolFee: 0n
  },
  clamm: ZERO_ADDRESS,
  feeTierCount: 0n,
  poolKeyCount: 0n
}

export const calculateSqrtPrice = async (tickIndex: bigint) => {
  return (
    await Invariant.tests.calculateSqrtPrice({
      initialFields: DEFAULT_INVT_INITIAL_FIELDS,
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
    await CLAMM.tests.getLiquidityByX({
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
    await CLAMM.tests.getLiquidityByY({
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
    await CLAMM.tests.getLiquidity({
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
