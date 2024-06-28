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

export const calculateAmountDelta = async (pool: Pool, position: Position, sign: boolean) => {
  return await CLAMM.tests.calculateAmountDelta({
    testArgs: {
      currentTickIndex: pool.currentTickIndex,
      currentSqrtPrice: pool.sqrtPrice,
      liquidityDelta: position.liquidity,
      liquiditySign: sign,
      upperTick: position.upperTickIndex,
      lowerTick: position.lowerTickIndex
    }
  })
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
