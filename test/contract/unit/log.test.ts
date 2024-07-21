import { ONE_ALPH } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { CLAMMInstance } from '../../../artifacts/ts'
import { deployCLAMM } from '../../../src/utils'
import { expectError } from '../../../src/testUtils'
import { DecimalError, GlobalMaxTick, GlobalMinTick } from '../../../src/consts'

describe('log tests', () => {
  let sender: PrivateKeyWallet
  let clamm: CLAMMInstance

  beforeAll(async () => {
    sender = await getSigner(ONE_ALPH * 100000n, 0)
    clamm = await deployCLAMM(sender)
  })

  describe('sqrt price to x32', () => {
    test('min sqrt price -> sqrt(1.0001) ^ MIN_TICK', async () => {
      const minSqrtPriceDecimal = (
        await clamm.view.calculateSqrtPrice({
          args: {
            tickIndex: -221818n
          }
        })
      ).returns
      const result = (
        await clamm.view.sqrtPriceToX32({
          args: {
            val: minSqrtPriceDecimal
          }
        })
      ).returns
      expect(result).toBe(65536n)
    })

    test('max sqrt price -> sqrt(1.0001) ^ MAX_TICK', async () => {
      const maxSqrtPriceDecimal = (
        await clamm.view.calculateSqrtPrice({
          args: {
            tickIndex: 221818n
          }
        })
      ).returns
      const result = (
        await clamm.view.sqrtPriceToX32({
          args: {
            val: maxSqrtPriceDecimal
          }
        })
      ).returns
      expect(result).toBe(281472330729535n)
    })
  })

  describe('log2 iterative approximation x32', () => {
    test('log2 of 1', async () => {
      const sqrtPriceDecimal = 1_000000000000000000000000n
      const sqrtPriceX32 = (
        await clamm.view.sqrtPriceToX32({
          args: {
            val: sqrtPriceDecimal
          }
        })
      ).returns
      const result = (
        await clamm.view.log2IterativeApproximationX32({
          args: {
            sqrtPrice: sqrtPriceX32
          }
        })
      ).returns
      expect(result).toStrictEqual([true, 0n])
    })

    test('log2 > 0 when x > 1', async () => {
      const sqrtPriceDecimal = 879_000000000000000000000000n
      const sqrtPriceX32 = (
        await clamm.view.sqrtPriceToX32({
          args: {
            val: sqrtPriceDecimal
          }
        })
      ).returns
      const result = (
        await clamm.view.log2IterativeApproximationX32({
          args: {
            sqrtPrice: sqrtPriceX32
          }
        })
      ).returns
      expect(result).toStrictEqual([true, 42003464192n])
    })

    test('log2 < 0 when x < 1', async () => {
      const sqrtPriceDecimal = 5900000000000000000000n
      const sqrtPriceX32 = (
        await clamm.view.sqrtPriceToX32({
          args: {
            val: sqrtPriceDecimal
          }
        })
      ).returns
      const result = (
        await clamm.view.log2IterativeApproximationX32({
          args: {
            sqrtPrice: sqrtPriceX32
          }
        })
      ).returns
      expect(result).toStrictEqual([false, 31804489728n])
    })

    test('log2 of max sqrt price', async () => {
      const maxSqrtPrice = (
        await clamm.view.calculateSqrtPrice({
          args: {
            tickIndex: 221818n
          }
        })
      ).returns
      const sqrtPriceX32 = (
        await clamm.view.sqrtPriceToX32({
          args: {
            val: maxSqrtPrice
          }
        })
      ).returns
      const result = (
        await clamm.view.log2IterativeApproximationX32({
          args: {
            sqrtPrice: sqrtPriceX32
          }
        })
      ).returns
      expect(result).toStrictEqual([true, 68719345664n])
    })

    test('log2 of min sqrt price', async () => {
      const maxSqrtPrice = (
        await clamm.view.calculateSqrtPrice({
          args: {
            tickIndex: -221818n
          }
        })
      ).returns
      const sqrtPriceX32 = (
        await clamm.view.sqrtPriceToX32({
          args: {
            val: maxSqrtPrice
          }
        })
      ).returns
      const result = (
        await clamm.view.log2IterativeApproximationX32({
          args: {
            sqrtPrice: sqrtPriceX32
          }
        })
      ).returns
      expect(result).toStrictEqual([false, 68719345664n])
    })

    test('log2 of sqrt(1.0001 ^ (-19_999)) - 1', async () => {
      let sqrtPriceDecimal = (
        await clamm.view.calculateSqrtPrice({
          args: {
            tickIndex: -19999n
          }
        })
      ).returns
      sqrtPriceDecimal -= 1n
      const sqrtPriceX32 = (
        await clamm.view.sqrtPriceToX32({
          args: {
            val: sqrtPriceDecimal
          }
        })
      ).returns
      const result = (
        await clamm.view.log2IterativeApproximationX32({
          args: {
            sqrtPrice: sqrtPriceX32
          }
        })
      ).returns
      expect(result).toStrictEqual([false, 6195642368n])
    })

    test('log2 of sqrt(1.0001 ^ (-19_999)) + 1', async () => {
      let sqrtPriceDecimal = (
        await clamm.view.calculateSqrtPrice({
          args: {
            tickIndex: 19999n
          }
        })
      ).returns
      sqrtPriceDecimal -= 1n
      const sqrtPriceX32 = (
        await clamm.view.sqrtPriceToX32({
          args: {
            val: sqrtPriceDecimal
          }
        })
      ).returns
      const result = (
        await clamm.view.log2IterativeApproximationX32({
          args: {
            sqrtPrice: sqrtPriceX32
          }
        })
      ).returns
      expect(result).toStrictEqual([true, 6195642368n])
    })
  })

  describe('get tick at sqrt price', () => {
    test('around 0 tick / get tick at 1', async () => {
      const sqrtPriceDecimal = 1_000000000000000000000000n
      const result = (
        await clamm.view.getTickAtSqrtPrice({
          args: {
            sqrtPrice: sqrtPriceDecimal,
            tickSpacing: 1n
          }
        })
      ).returns
      expect(result).toBe(0n)
    })

    test('around 0 tick / get tick slightly below 1', async () => {
      const sqrtPriceDecimal = 1_000000000000000000000000n - 1n
      const result = (
        await clamm.view.getTickAtSqrtPrice({
          args: {
            sqrtPrice: sqrtPriceDecimal,
            tickSpacing: 1n
          }
        })
      ).returns
      expect(result).toBe(-1n)
    })

    test('around 0 tick / get tick slightly above 1', async () => {
      const sqrtPriceDecimal = 1_000000000000000000000000n + 1n
      const result = (
        await clamm.view.getTickAtSqrtPrice({
          args: {
            sqrtPrice: sqrtPriceDecimal,
            tickSpacing: 1n
          }
        })
      ).returns
      expect(result).toBe(0n)
    })

    test('around 1 tick / get tick at sqrt(1.0001)', async () => {
      const sqrtPriceDecimal = (
        await clamm.view.calculateSqrtPrice({
          args: { tickIndex: 1n }
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
      expect(result).toBe(1n)
    })

    test('around 1 tick / get tick slightly below sqrt(1.0001)', async () => {
      const sqrtPriceDecimal = (
        await clamm.view.calculateSqrtPrice({
          args: { tickIndex: 1n }
        })
      ).returns
      const result = (
        await clamm.view.getTickAtSqrtPrice({
          args: {
            sqrtPrice: sqrtPriceDecimal - 1n,
            tickSpacing: 1n
          }
        })
      ).returns
      expect(result).toBe(0n)
    })

    test('around 1 tick / get tick slightly above sqrt(1.0001)', async () => {
      const sqrtPriceDecimal = (
        await clamm.view.calculateSqrtPrice({
          args: { tickIndex: 1n }
        })
      ).returns
      const result = (
        await clamm.view.getTickAtSqrtPrice({
          args: {
            sqrtPrice: sqrtPriceDecimal + 1n,
            tickSpacing: 1n
          }
        })
      ).returns
      expect(result).toBe(1n)
    })

    test('around -1 tick / get tick at sqrt(1.0001 ^ (-1))', async () => {
      const sqrtPriceDecimal = (
        await clamm.view.calculateSqrtPrice({
          args: { tickIndex: -1n }
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
      expect(result).toBe(-1n)
    })

    test('around -1 tick / get tick slightly below sqrt(1.0001 ^ (-1))', async () => {
      const sqrtPriceDecimal = (
        await clamm.view.calculateSqrtPrice({
          args: { tickIndex: -1n }
        })
      ).returns
      const result = (
        await clamm.view.getTickAtSqrtPrice({
          args: {
            sqrtPrice: sqrtPriceDecimal - 1n,
            tickSpacing: 1n
          }
        })
      ).returns
      expect(result).toBe(-2n)
    })

    test('around -1 tick / get tick slightly above sqrt(1.0001 ^ (-1))', async () => {
      const sqrtPriceDecimal = (
        await clamm.view.calculateSqrtPrice({
          args: { tickIndex: -1n }
        })
      ).returns
      const result = (
        await clamm.view.getTickAtSqrtPrice({
          args: {
            sqrtPrice: sqrtPriceDecimal + 1n,
            tickSpacing: 1n
          }
        })
      ).returns
      expect(result).toBe(-1n)
    })

    test('around max - 1 tick / get tick at sqrt(1.0001 ^ (MAX_TICK - 1))', async () => {
      const sqrtPriceDecimal = (
        await clamm.view.calculateSqrtPrice({
          args: { tickIndex: 221818n - 1n }
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
      expect(result).toBe(221818n - 1n)
    })

    test('around max - 1 tick / get tick slightly below sqrt(1.0001 ^ (MAX_TICK - 1))', async () => {
      let sqrtPriceDecimal = (
        await clamm.view.calculateSqrtPrice({
          args: { tickIndex: 221818n - 1n }
        })
      ).returns
      sqrtPriceDecimal -= 1n
      const result = (
        await clamm.view.getTickAtSqrtPrice({
          args: {
            sqrtPrice: sqrtPriceDecimal,
            tickSpacing: 1n
          }
        })
      ).returns
      expect(result).toBe(221818n - 2n)
    })

    test('around max - 1 tick / get tick slightly above sqrt(1.0001 ^ (MAX_TICK - 1))', async () => {
      let sqrtPriceDecimal = (
        await clamm.view.calculateSqrtPrice({
          args: { tickIndex: 221818n - 1n }
        })
      ).returns
      sqrtPriceDecimal += 1n
      const result = (
        await clamm.view.getTickAtSqrtPrice({
          args: {
            sqrtPrice: sqrtPriceDecimal,
            tickSpacing: 1n
          }
        })
      ).returns
      expect(result).toBe(221818n - 1n)
    })

    test('around min + 1 tick / get tick at sqrt(1.0001 ^ (MAX_TICK - 1))', async () => {
      const sqrtPriceDecimal = (
        await clamm.view.calculateSqrtPrice({
          args: { tickIndex: -221818n + 1n }
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
      expect(result).toBe(-(221818n - 1n))
    })

    test('around min + 1 tick / get tick slightly below sqrt(1.0001 ^ (MAX_TICK - 1))', async () => {
      let sqrtPriceDecimal = (
        await clamm.view.calculateSqrtPrice({
          args: { tickIndex: -221818n + 1n }
        })
      ).returns
      sqrtPriceDecimal -= 1n
      const result = (
        await clamm.view.getTickAtSqrtPrice({
          args: {
            sqrtPrice: sqrtPriceDecimal,
            tickSpacing: 1n
          }
        })
      ).returns
      expect(result).toBe(-221818n)
    })

    test('around min + 1 tick / get tick slightly above sqrt(1.0001 ^ (MAX_TICK - 1))', async () => {
      let sqrtPriceDecimal = (
        await clamm.view.calculateSqrtPrice({
          args: { tickIndex: -221818n + 1n }
        })
      ).returns
      sqrtPriceDecimal += 1n
      const result = (
        await clamm.view.getTickAtSqrtPrice({
          args: {
            sqrtPrice: sqrtPriceDecimal,
            tickSpacing: 1n
          }
        })
      ).returns
      expect(result).toBe(-(221818n - 1n))
    })

    test('get tick slightly below at max tick', async () => {
      const maxSqrtPrice = 65535383934512647000000000000n
      const sqrtPriceDecimal = maxSqrtPrice - 1n
      const result = (
        await clamm.view.getTickAtSqrtPrice({
          args: {
            sqrtPrice: sqrtPriceDecimal,
            tickSpacing: 1n
          }
        })
      ).returns
      expect(result).toBe(221818n - 1n)
    })

    test('around 19999 tick / get tick at sqrt(1.0001 ^ 19999)', async () => {
      const tickIndex = 19999n
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

    test('around 19999 tick / get tick slightly below sqrt(1.0001^19999)', async () => {
      const tickIndex = 19999n
      let sqrtPriceDecimal = (
        await clamm.view.calculateSqrtPrice({
          args: { tickIndex }
        })
      ).returns
      sqrtPriceDecimal -= 1n
      const result = (
        await clamm.view.getTickAtSqrtPrice({
          args: {
            sqrtPrice: sqrtPriceDecimal,
            tickSpacing: 1n
          }
        })
      ).returns
      expect(result).toBe(tickIndex - 1n)
    })

    test('around 19999 tick / get tick slightly above sqrt(1.0001^19999)', async () => {
      const tickIndex = 19999n
      let sqrtPriceDecimal = (
        await clamm.view.calculateSqrtPrice({
          args: { tickIndex }
        })
      ).returns
      sqrtPriceDecimal += 1n
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
      let sqrtPriceDecimal = (
        await clamm.view.calculateSqrtPrice({
          args: { tickIndex }
        })
      ).returns
      sqrtPriceDecimal -= 1n
      const result = (
        await clamm.view.getTickAtSqrtPrice({
          args: {
            sqrtPrice: sqrtPriceDecimal,
            tickSpacing: 1n
          }
        })
      ).returns
      expect(result).toBe(tickIndex - 1n)
    })

    test('around -19999 tick / get tick slightly above sqrt(1.0001^-19999)', async () => {
      const tickIndex = -19999n
      let sqrtPriceDecimal = (
        await clamm.view.calculateSqrtPrice({
          args: { tickIndex }
        })
      ).returns
      sqrtPriceDecimal += 1n
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

    test('get tick slightly above at min tick', async () => {
      const minSqrtPrice = (
        await clamm.view.calculateSqrtPrice({
          args: { tickIndex: -221818n }
        })
      ).returns
      const sqrtPriceDecimal = minSqrtPrice + 1n
      const result = (
        await clamm.view.getTickAtSqrtPrice({
          args: {
            sqrtPrice: sqrtPriceDecimal,
            tickSpacing: 1n
          }
        })
      ).returns
      expect(result).toBe(-221818n)
    })
  })

  test('calculate sqrt price - domain', async () => {
    const clamm = await deployCLAMM(sender)

    await expectError(
      DecimalError.TickOverBounds,
      clamm.view.calculateSqrtPrice({ args: { tickIndex: GlobalMaxTick + 1n } }),
      clamm
    )
    await expectError(
      DecimalError.TickOverBounds,
      clamm.view.calculateSqrtPrice({ args: { tickIndex: GlobalMinTick - 1n } }),
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
    test('all positive ticks', async () => {
      // for (let i = 0n; i < 221818n; i++) {
      //   const sqrtPriceDecimal = (
      //     await clamm.view.calculateSqrtPrice({
      //       args: { tickIndex: i }
      //     })
      //   ).returns
      //   {
      //     const tick = (
      //       await clamm.view.getTickAtSqrtPrice({
      //         args: {
      //           sqrtPrice: sqrtPriceDecimal,
      //           tickSpacing: 1n
      //         }
      //       })
      //     ).returns
      //     expect(tick).toBe(i)
      //   }
      //   {
      //     const tick = (
      //       await clamm.view.getTickAtSqrtPrice({
      //         args: {
      //           sqrtPrice: sqrtPriceDecimal - 1n,
      //           tickSpacing: 1n
      //         }
      //       })
      //     ).returns
      //     expect(tick).toBe(i - 1n)
      //   }
      //   {
      //     const tick = (
      //       await clamm.view.getTickAtSqrtPrice({
      //         args: {
      //           sqrtPrice: sqrtPriceDecimal + 1n,
      //           tickSpacing: 1n
      //         }
      //       })
      //     ).returns
      //     expect(tick).toBe(i)
      //   }
      // }
    }, 3600000)

    test('all negative ticks', async () => {
      // for (let i = 0n; i < 221818n; i++) {
      //   const sqrtPriceDecimal = (
      //     await clamm.view.calculateSqrtPrice({
      //       args: { tickIndex: -i }
      //     })
      //   ).returns
      //   {
      //     const tick = (
      //       await clamm.view.getTickAtSqrtPrice({
      //         args: {
      //           sqrtPrice: sqrtPriceDecimal,
      //           tickSpacing: 1n
      //         }
      //       })
      //     ).returns
      //     expect(tick).toBe(-i)
      //   }
      //   {
      //     const tick = (
      //       await clamm.view.getTickAtSqrtPrice({
      //         args: {
      //           sqrtPrice: sqrtPriceDecimal - 1n,
      //           tickSpacing: 1n
      //         }
      //       })
      //     ).returns
      //     expect(tick).toBe(-i - 1n)
      //   }
      //   {
      //     const tick = (
      //       await clamm.view.getTickAtSqrtPrice({
      //         args: {
      //           sqrtPrice: sqrtPriceDecimal + 1n,
      //           tickSpacing: 1n
      //         }
      //       })
      //     ).returns
      //     expect(tick).toBe(-i)
      //   }
      // }
    }, 3600000)

    test('all positive ticks, tick spacing greater than 1', async () => {
      // const tickSpacing = 3n
      // for (let i = 0n; i < 221818n; i++) {
      //   const sqrtPriceDecimal = (
      //     await clamm.view.calculateSqrtPrice({
      //       args: { tickIndex: i }
      //     })
      //   ).returns
      //   {
      //     const tick = (
      //       await clamm.view.getTickAtSqrtPrice({
      //         args: {
      //           sqrtPrice: sqrtPriceDecimal,
      //           tickSpacing
      //         }
      //       })
      //     ).returns
      //     const expectedTick = (await clamm.view.alignTickToSpacing({ args: { accurateTick: i, tickSpacing } }))
      //       .returns
      //     expect(tick).toBe(expectedTick)
      //   }
      //   {
      //     const tick = (
      //       await clamm.view.getTickAtSqrtPrice({
      //         args: {
      //           sqrtPrice: sqrtPriceDecimal - 1n,
      //           tickSpacing
      //         }
      //       })
      //     ).returns
      //     const expectedTick = (
      //       await clamm.view.alignTickToSpacing({ args: { accurateTick: i - 1n, tickSpacing } })
      //     ).returns
      //     expect(tick).toBe(expectedTick)
      //   }
      //   {
      //     const tick = (
      //       await clamm.view.getTickAtSqrtPrice({
      //         args: {
      //           sqrtPrice: sqrtPriceDecimal + 1n,
      //           tickSpacing
      //         }
      //       })
      //     ).returns
      //     const expectedTick = (await clamm.view.alignTickToSpacing({ args: { accurateTick: i, tickSpacing } }))
      //       .returns
      //     expect(tick).toBe(expectedTick)
      //   }
      // }
    }, 3600000)

    test('all negative ticks, tick spacing greater than 1', async () => {
      // const tickSpacing = 4n
      // for (let i = 0n; i < 221818n; i++) {
      //   const sqrtPriceDecimal = (
      //     await clamm.view.calculateSqrtPrice({
      //       args: { tickIndex: -i }
      //     })
      //   ).returns
      //   {
      //     const tick = (
      //       await clamm.view.getTickAtSqrtPrice({
      //         args: {
      //           sqrtPrice: sqrtPriceDecimal,
      //           tickSpacing
      //         }
      //       })
      //     ).returns
      //     const expectedTick = (await clamm.view.alignTickToSpacing({ args: { accurateTick: -i, tickSpacing } }))
      //       .returns
      //     expect(tick).toBe(expectedTick)
      //   }
      //   {
      //     const tick = (
      //       await clamm.view.getTickAtSqrtPrice({
      //         args: {
      //           sqrtPrice: sqrtPriceDecimal - 1n,
      //           tickSpacing
      //         }
      //       })
      //     ).returns
      //     const expectedTick = await (
      //       await clamm.view.alignTickToSpacing({ args: { accurateTick: -i - 1n, tickSpacing } })
      //     ).returns
      //     expect(tick).toBe(expectedTick)
      //   }
      //   {
      //     const tick = (
      //       await clamm.view.getTickAtSqrtPrice({
      //         args: {
      //           sqrtPrice: sqrtPriceDecimal + 1n,
      //           tickSpacing
      //         }
      //       })
      //     ).returns
      //     const expectedTick = (await clamm.view.allignTickToSpacing({ args: { accurateTick: -i, tickSpacing } }))
      //       .returns
      //     expect(tick).toBe(expectedTick)
      //   }
      // }
    }, 3600000)
  })
})
