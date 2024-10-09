import { ONE_ALPH } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { CLAMMInstance } from '../../../artifacts/ts'
import { deployCLAMM } from '../../../src/testUtils'
import { calculateSqrtPrice, expectError, getTickAtSqrtPrice } from '../../../src/testUtils'
import {
  DecimalError,
  GLOBAL_MAX_TICK,
  GLOBAL_MIN_TICK,
  MAX_SQRT_PRICE,
  MIN_SQRT_PRICE
} from '../../../src/consts'
import { SqrtPrice } from '../../../src/types'
import { toSqrtPrice } from '../../../src/math'

const sqrtPriceToX64 = async (clamm: CLAMMInstance, val: bigint): Promise<bigint> => {
  return (
    await clamm.view.sqrtPriceToX64({
      args: {
        val: { v: val }
      }
    })
  ).returns
}

const log2IterativeApproximationX64 = async (
  clamm: CLAMMInstance,
  sqrtPriceX64: bigint
): Promise<[boolean, bigint]> => {
  return (
    await clamm.view.log2IterativeApproximationX64({
      args: {
        sqrtPriceX64
      }
    })
  ).returns
}

describe('log tests', () => {
  let sender: PrivateKeyWallet
  let clamm: CLAMMInstance

  beforeAll(async () => {
    sender = await getSigner(ONE_ALPH * 100000n, 0)
    clamm = await deployCLAMM(sender)
  })

  describe('sqrt price to x64', () => {
    test('min sqrt price -> sqrt(1.0001) ^ MIN_TICK', async () => {
      const minSqrtPriceDecimal = await calculateSqrtPrice(clamm, GLOBAL_MIN_TICK)
      const result = await sqrtPriceToX64(clamm, minSqrtPriceDecimal)
      expect(result).toBe(23727339n)
    })

    test('max sqrt price -> sqrt(1.0001) ^ MAX_TICK', async () => {
      const maxSqrtPriceDecimal = await calculateSqrtPrice(clamm, GLOBAL_MAX_TICK)
      const result = await sqrtPriceToX64(clamm, maxSqrtPriceDecimal)
      expect(result).toBe(14341362215642069715256648712895n)
    })
  })

  describe('log2 iterative approximation x64', () => {
    test('log2 of 1', async () => {
      const sqrtPriceDecimal = 1_000000000000000000000000n
      const sqrtPriceX64 = await sqrtPriceToX64(clamm, sqrtPriceDecimal)
      const result = await log2IterativeApproximationX64(clamm, sqrtPriceX64)
      expect(result).toStrictEqual([true, 0n])
    })

    test('log2 > 0 when x > 1', async () => {
      const sqrtPriceDecimal = 879_000000000000000000000000n
      const sqrtPriceX64 = await sqrtPriceToX64(clamm, sqrtPriceDecimal)
      const result = await log2IterativeApproximationX64(clamm, sqrtPriceX64)
      expect(result).toStrictEqual([true, 180403980057034096640n])
    })

    test('log2 < 0 when x < 1', async () => {
      const sqrtPriceDecimal = 5900000000000000000000n
      const sqrtPriceX64 = await sqrtPriceToX64(clamm, sqrtPriceDecimal)
      const result = await log2IterativeApproximationX64(clamm, sqrtPriceX64)
      expect(result).toStrictEqual([false, 136599418782046486528n])
    })

    test('log2 of max sqrt price', async () => {
      const maxSqrtPrice = await calculateSqrtPrice(clamm, GLOBAL_MAX_TICK)
      const sqrtPriceX64 = await sqrtPriceToX64(clamm, maxSqrtPrice)
      const result = await log2IterativeApproximationX64(clamm, sqrtPriceX64)
      expect(result).toStrictEqual([true, 728645524035954540544n])
    })

    test('log2 of min sqrt price', async () => {
      const maxSqrtPrice = await calculateSqrtPrice(clamm, GLOBAL_MIN_TICK)
      const sqrtPriceX64 = await sqrtPriceToX64(clamm, maxSqrtPrice)
      const result = await log2IterativeApproximationX64(clamm, sqrtPriceX64)
      expect(result).toStrictEqual([false, 728645523220022951936n])
    })

    test('log2 of sqrt(1.0001 ^ (-19_999)) - 1', async () => {
      let sqrtPriceDecimal = ((await calculateSqrtPrice(clamm, -19999n)) - 1n) as SqrtPrice
      const sqrtPriceX64 = await sqrtPriceToX64(clamm, sqrtPriceDecimal)
      const result = await log2IterativeApproximationX64(clamm, sqrtPriceX64)
      expect(result).toStrictEqual([false, 26610365048300503040n])
    })

    test('log2 of sqrt(1.0001 ^ (-19_999)) + 1', async () => {
      let sqrtPriceDecimal = ((await calculateSqrtPrice(clamm, 19999n)) - 1n) as SqrtPrice
      const sqrtPriceX64 = await sqrtPriceToX64(clamm, sqrtPriceDecimal)
      const result = await log2IterativeApproximationX64(clamm, sqrtPriceX64)
      expect(result).toStrictEqual([true, 26610365048300503040n])
    })
  })

  describe('get tick at sqrt price', () => {
    test('around 0 tick / get tick at 1', async () => {
      const sqrtPriceDecimal = toSqrtPrice(1n)
      const result = await getTickAtSqrtPrice(clamm, sqrtPriceDecimal, 1n)
      expect(result).toBe(0n)
    })

    test('around 0 tick / get tick slightly below 1', async () => {
      const sqrtPriceDecimal = (1_000000000000000000000000n - 1n) as SqrtPrice
      const result = await getTickAtSqrtPrice(clamm, sqrtPriceDecimal, 1n)
      expect(result).toBe(-1n)
    })

    test('around 0 tick / get tick slightly above 1', async () => {
      const sqrtPriceDecimal = (1_000000000000000000000000n + 1n) as SqrtPrice
      const result = await getTickAtSqrtPrice(clamm, sqrtPriceDecimal, 1n)
      expect(result).toBe(0n)
    })

    test('around 1 tick / get tick at sqrt(1.0001)', async () => {
      const sqrtPriceDecimal = await calculateSqrtPrice(clamm, 1n)
      const result = await getTickAtSqrtPrice(clamm, sqrtPriceDecimal, 1n)
      expect(result).toBe(1n)
    })

    test('around 1 tick / get tick slightly below sqrt(1.0001)', async () => {
      const sqrtPriceDecimal = ((await calculateSqrtPrice(clamm, 1n)) - 1n) as SqrtPrice
      const result = await getTickAtSqrtPrice(clamm, sqrtPriceDecimal, 1n)
      expect(result).toBe(0n)
    })

    test('around 1 tick / get tick slightly above sqrt(1.0001)', async () => {
      const sqrtPriceDecimal = ((await calculateSqrtPrice(clamm, 1n)) + 1n) as SqrtPrice
      const result = await getTickAtSqrtPrice(clamm, sqrtPriceDecimal, 1n)
      expect(result).toBe(1n)
    })

    test('around -1 tick / get tick at sqrt(1.0001 ^ (-1))', async () => {
      const sqrtPriceDecimal = await calculateSqrtPrice(clamm, -1n)
      const result = await getTickAtSqrtPrice(clamm, sqrtPriceDecimal, 1n)
      expect(result).toBe(-1n)
    })

    test('around -1 tick / get tick slightly below sqrt(1.0001 ^ (-1))', async () => {
      const sqrtPriceDecimal = ((await calculateSqrtPrice(clamm, -1n)) - 1n) as SqrtPrice
      const result = await getTickAtSqrtPrice(clamm, sqrtPriceDecimal, 1n)
      expect(result).toBe(-2n)
    })

    test('around -1 tick / get tick slightly above sqrt(1.0001 ^ (-1))', async () => {
      const sqrtPriceDecimal = ((await calculateSqrtPrice(clamm, -1n)) + 1n) as SqrtPrice
      const result = await getTickAtSqrtPrice(clamm, sqrtPriceDecimal, 1n)
      expect(result).toBe(-1n)
    })

    test('around max - 1 tick / get tick at sqrt(1.0001 ^ (MAX_TICK - 1))', async () => {
      const sqrtPriceDecimal = await calculateSqrtPrice(clamm, GLOBAL_MAX_TICK - 1n)
      const result = await getTickAtSqrtPrice(clamm, sqrtPriceDecimal, 1n)
      expect(result).toBe(GLOBAL_MAX_TICK - 1n)
    })

    test('around max - 1 tick / get tick slightly below sqrt(1.0001 ^ (MAX_TICK - 1))', async () => {
      let sqrtPriceDecimal = ((await calculateSqrtPrice(clamm, GLOBAL_MAX_TICK - 1n)) -
        1n) as SqrtPrice
      const result = await getTickAtSqrtPrice(clamm, sqrtPriceDecimal, 1n)
      expect(result).toBe(GLOBAL_MAX_TICK - 2n)
    })

    test('around max - 1 tick / get tick slightly above sqrt(1.0001 ^ (MAX_TICK - 1))', async () => {
      let sqrtPriceDecimal = ((await calculateSqrtPrice(clamm, GLOBAL_MAX_TICK - 1n)) +
        1n) as SqrtPrice
      const result = await getTickAtSqrtPrice(clamm, sqrtPriceDecimal, 1n)
      expect(result).toBe(GLOBAL_MAX_TICK - 1n)
    })

    test('around min + 1 tick / get tick at sqrt(1.0001 ^ (MAX_TICK - 1))', async () => {
      const sqrtPriceDecimal = await calculateSqrtPrice(clamm, GLOBAL_MIN_TICK + 1n)
      const result = await getTickAtSqrtPrice(clamm, sqrtPriceDecimal, 1n)
      expect(result).toBe(GLOBAL_MIN_TICK + 1n)
    })

    test('around min + 1 tick / get tick slightly below sqrt(1.0001 ^ (MAX_TICK - 1))', async () => {
      let sqrtPriceDecimal = ((await calculateSqrtPrice(clamm, GLOBAL_MIN_TICK + 1n)) -
        1n) as SqrtPrice
      const result = await getTickAtSqrtPrice(clamm, sqrtPriceDecimal, 1n)
      expect(result).toBe(GLOBAL_MIN_TICK)
    })

    test('around min + 1 tick / get tick slightly above sqrt(1.0001 ^ (MAX_TICK - 1))', async () => {
      let sqrtPriceDecimal = ((await calculateSqrtPrice(clamm, GLOBAL_MIN_TICK + 1n)) +
        1n) as SqrtPrice
      const result = await getTickAtSqrtPrice(clamm, sqrtPriceDecimal, 1n)
      expect(result).toBe(GLOBAL_MIN_TICK + 1n)
    })

    test('get tick slightly below at max tick', async () => {
      const sqrtPriceDecimal = (MAX_SQRT_PRICE - 1n) as SqrtPrice
      const result = await getTickAtSqrtPrice(clamm, sqrtPriceDecimal, 1n)
      expect(result).toBe(GLOBAL_MAX_TICK - 1n)
    })

    test('around 19999 tick / get tick at sqrt(1.0001 ^ 19999)', async () => {
      const tickIndex = 19999n
      const sqrtPriceDecimal = await calculateSqrtPrice(clamm, tickIndex)
      const result = await getTickAtSqrtPrice(clamm, sqrtPriceDecimal, 1n)
      expect(result).toBe(tickIndex)
    })

    test('around 19999 tick / get tick slightly below sqrt(1.0001^19999)', async () => {
      const tickIndex = 19999n
      let sqrtPriceDecimal = ((await calculateSqrtPrice(clamm, tickIndex)) - 1n) as SqrtPrice
      const result = await getTickAtSqrtPrice(clamm, sqrtPriceDecimal, 1n)
      expect(result).toBe(tickIndex - 1n)
    })

    test('around 19999 tick / get tick slightly above sqrt(1.0001^19999)', async () => {
      const tickIndex = 19999n
      let sqrtPriceDecimal = ((await calculateSqrtPrice(clamm, tickIndex)) + 1n) as SqrtPrice
      const result = await getTickAtSqrtPrice(clamm, sqrtPriceDecimal, 1n)
      expect(result).toBe(tickIndex)
    })

    test('around -19999 tick / get tick at sqrt(1.0001 ^ -19999)', async () => {
      const tickIndex = -19999n
      const sqrtPriceDecimal = (
        await clamm.view.calculateSqrtPrice({
          args: { tickIndex }
        })
      ).returns
      const result = (
        await clamm.view.getTickAtSqrtPrice({
          args: {
            sqrtPrice: sqrtPriceDecimal,
            tickSpacing: 1n
          }
        })
      ).returns
      expect(result).toBe(tickIndex)
    })

    test('around -19999 tick / get tick slightly below sqrt(1.0001^-19999)', async () => {
      const tickIndex = -19999n
      let sqrtPriceDecimal = ((await calculateSqrtPrice(clamm, tickIndex)) - 1n) as SqrtPrice
      const result = await getTickAtSqrtPrice(clamm, sqrtPriceDecimal, 1n)
      expect(result).toBe(tickIndex - 1n)
    })

    test('around -19999 tick / get tick slightly above sqrt(1.0001^-19999)', async () => {
      const tickIndex = -19999n
      let sqrtPriceDecimal = ((await calculateSqrtPrice(clamm, tickIndex)) + 1n) as SqrtPrice
      const result = await getTickAtSqrtPrice(clamm, sqrtPriceDecimal, 1n)
      expect(result).toBe(tickIndex)
    })

    test('get tick slightly above at min tick', async () => {
      const sqrtPriceDecimal = (MIN_SQRT_PRICE + 1n) as SqrtPrice
      const result = await getTickAtSqrtPrice(clamm, sqrtPriceDecimal, 1n)
      expect(result).toBe(GLOBAL_MIN_TICK)
    })
  })

  test('calculate sqrt price - domain', async () => {
    const clamm = await deployCLAMM(sender)

    await expectError(
      DecimalError.TickOverBounds,
      clamm.view.calculateSqrtPrice({ args: { tickIndex: GLOBAL_MAX_TICK + 1n } }),
      clamm
    )
    await expectError(
      DecimalError.TickOverBounds,
      clamm.view.calculateSqrtPrice({ args: { tickIndex: GLOBAL_MIN_TICK - 1n } }),
      clamm
    )
  })

  describe('align tick with spacing', () => {
    test('zero', async () => {
      const accurateTick = 0n
      const tickSpacing = 3n

      const result = (
        await clamm.view.alignTickToSpacing({
          args: {
            accurateTick,
            tickSpacing
          }
        })
      ).returns
      expect(result).toBe(0n)
    })

    test('positive', async () => {
      const accurateTick = 14n
      const tickSpacing = 10n

      const result = (
        await clamm.view.alignTickToSpacing({
          args: {
            accurateTick,
            tickSpacing
          }
        })
      ).returns
      expect(result).toBe(10n)
    })

    test('positive at tick', async () => {
      const accurateTick = 20n
      const tickSpacing = 10n

      const result = (
        await clamm.view.alignTickToSpacing({
          args: {
            accurateTick,
            tickSpacing
          }
        })
      ).returns
      expect(result).toBe(20n)
    })

    test('negative', async () => {
      const accurateTick = -14n
      const tickSpacing = 10n

      const result = (
        await clamm.view.alignTickToSpacing({
          args: {
            accurateTick,
            tickSpacing
          }
        })
      ).returns
      expect(result).toBe(-20n)
    })

    test('negative at tick', async () => {
      const accurateTick = -120n
      const tickSpacing = 3n

      const result = (
        await clamm.view.alignTickToSpacing({
          args: {
            accurateTick,
            tickSpacing
          }
        })
      ).returns
      expect(result).toBe(-120n)
    })
  })

  describe('all ticks', () => {
    test.skip('all positive ticks', async () => {
      const oneProgressPercent = GLOBAL_MAX_TICK / 100n
      let lastPercent = 0n

      for (let i = 0n; i < GLOBAL_MAX_TICK; i++) {
        if (lastPercent < i / oneProgressPercent) {
          lastPercent = i / oneProgressPercent
          console.log(`[all positive ticks] \n${lastPercent}% completed`)
        }

        const sqrtPriceDecimal = await calculateSqrtPrice(clamm, i)
        {
          const tick = await getTickAtSqrtPrice(clamm, sqrtPriceDecimal, 1n)
          expect(tick).toBe(i)
        }
        {
          const tick = await getTickAtSqrtPrice(clamm, (sqrtPriceDecimal - 1n) as SqrtPrice, 1n)
          expect(tick).toBe(i - 1n)
        }
        {
          const tick = await getTickAtSqrtPrice(clamm, (sqrtPriceDecimal + 1n) as SqrtPrice, 1n)
          expect(tick).toBe(i)
        }
      }
    }, 36000000)

    test.skip('all negative ticks', async () => {
      const oneProgressPercent = GLOBAL_MAX_TICK / 100n
      let lastPercent = 0n

      for (let i = 0n; i < GLOBAL_MAX_TICK; i++) {
        if (lastPercent < i / oneProgressPercent) {
          lastPercent = i / oneProgressPercent
          console.log(`[all negative ticks] \n${lastPercent}% completed`)
        }

        const sqrtPriceDecimal = await calculateSqrtPrice(clamm, -i)
        {
          const tick = await getTickAtSqrtPrice(clamm, sqrtPriceDecimal, 1n)
          expect(tick).toBe(-i)
        }
        {
          const tick = await getTickAtSqrtPrice(clamm, (sqrtPriceDecimal - 1n) as SqrtPrice, 1n)
          expect(tick).toBe(-i - 1n)
        }
        {
          const tick = await getTickAtSqrtPrice(clamm, (sqrtPriceDecimal + 1n) as SqrtPrice, 1n)
          expect(tick).toBe(-i)
        }
      }
    }, 36000000)

    test.skip('all positive ticks, tick spacing greater than 1', async () => {
      const oneProgressPercent = GLOBAL_MAX_TICK / 100n
      let lastPercent = 0n

      const tickSpacing = 3n
      for (let i = 0n; i < GLOBAL_MAX_TICK; i++) {
        if (lastPercent < i / oneProgressPercent) {
          lastPercent = i / oneProgressPercent
          console.log(
            `[all positive ticks, tick spacing greater than 1] \n${lastPercent}% completed`
          )
        }

        const sqrtPriceDecimal = await calculateSqrtPrice(clamm, i)
        {
          const tick = await getTickAtSqrtPrice(clamm, sqrtPriceDecimal, tickSpacing)
          const expectedTick = (
            await clamm.view.alignTickToSpacing({ args: { accurateTick: i, tickSpacing } })
          ).returns
          expect(tick).toBe(expectedTick)
        }
        {
          const tick = await getTickAtSqrtPrice(
            clamm,
            (sqrtPriceDecimal - 1n) as SqrtPrice,
            tickSpacing
          )
          const expectedTick = (
            await clamm.view.alignTickToSpacing({ args: { accurateTick: i - 1n, tickSpacing } })
          ).returns
          expect(tick).toBe(expectedTick)
        }
        {
          const tick = await getTickAtSqrtPrice(
            clamm,
            (sqrtPriceDecimal + 1n) as SqrtPrice,
            tickSpacing
          )
          const expectedTick = (
            await clamm.view.alignTickToSpacing({ args: { accurateTick: i, tickSpacing } })
          ).returns
          expect(tick).toBe(expectedTick)
        }
      }
    }, 36000000)

    test.skip('all negative ticks, tick spacing greater than 1', async () => {
      const oneProgressPercent = GLOBAL_MAX_TICK / 100n
      let lastPercent = 0n

      const tickSpacing = 4n
      for (let i = 0n; i < GLOBAL_MAX_TICK; i++) {
        if (lastPercent < i / oneProgressPercent) {
          lastPercent = i / oneProgressPercent
          console.log(
            `[all negative ticks, tick spacing greater than 1] \n${lastPercent}% completed`
          )
        }

        const sqrtPriceDecimal = await calculateSqrtPrice(clamm, -i)
        {
          const tick = await getTickAtSqrtPrice(clamm, sqrtPriceDecimal, tickSpacing)
          const expectedTick = (
            await clamm.view.alignTickToSpacing({ args: { accurateTick: -i, tickSpacing } })
          ).returns
          expect(tick).toBe(expectedTick)
        }
        {
          const tick = await getTickAtSqrtPrice(
            clamm,
            (sqrtPriceDecimal - 1n) as SqrtPrice,
            tickSpacing
          )
          const expectedTick = await (
            await clamm.view.alignTickToSpacing({ args: { accurateTick: -i - 1n, tickSpacing } })
          ).returns
          expect(tick).toBe(expectedTick)
        }
        {
          const tick = await getTickAtSqrtPrice(
            clamm,
            (sqrtPriceDecimal + 1n) as SqrtPrice,
            tickSpacing
          )
          const expectedTick = (
            await clamm.view.alignTickToSpacing({ args: { accurateTick: -i, tickSpacing } })
          ).returns
          expect(tick).toBe(expectedTick)
        }
      }
    }, 36000000)
  })
})
