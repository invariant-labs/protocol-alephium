import { DUST_AMOUNT, ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { Flip, InitializeChunk } from '../../../artifacts/ts'

import { deployInvariant, deployTokenFaucet, newFeeTier, newPoolKey } from '../../../src/utils'
import { GLOBAL_MIN_TICK, GLOBAL_MAX_TICK } from '../../../src/consts'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let sender: PrivateKeyWallet
let token0Addr: string
let token1Addr: string

const TICK_SEARCH_RANGE = 256n
const protocolFee = 100n
describe('tickmap tests', () => {
  beforeAll(async () => {
    sender = await getSigner(ONE_ALPH * 1000n, 0)
    token0Addr = (await deployTokenFaucet(sender, '', '', 0n, 0n)).contractInstance.address
    token1Addr = (await deployTokenFaucet(sender, '', '', 0n, 0n)).contractInstance.address
  })

  test('flip bit', async () => {
    const invariant = await deployInvariant(sender, protocolFee)

    const params = [
      { tickSpacing: 1n, tick: 0n },
      { tickSpacing: 1n, tick: 7n },
      { tickSpacing: 1n, tick: GLOBAL_MAX_TICK - 1n },
      { tickSpacing: 1n, tick: GLOBAL_MAX_TICK - 40n },
      { tickSpacing: 100n, tick: 20000n }
    ]
    for (const { tick, tickSpacing } of params) {
      const feeTier = await newFeeTier(0n, tickSpacing)
      const poolKey = await newPoolKey(token0Addr, token1Addr, feeTier)

      const [chunkIndex] = (await invariant.view.tickToPosition({ args: { tick, tickSpacing } }))
        .returns

      await InitializeChunk.execute(sender, {
        initialFields: {
          invariant: invariant.contractId,
          caller: sender.address,
          poolKey,
          chunk: chunkIndex
        },
        attoAlphAmount: ONE_ALPH
      })

      expect(
        (
          await invariant.view.getBit({
            args: { tick, poolKey }
          })
        ).returns
      ).toBe(false)
      await Flip.execute(sender, {
        initialFields: {
          invariant: invariant.contractId,
          value: true,
          tick,
          poolKey
        },
        attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
      })

      expect(
        (
          await invariant.view.getBit({
            args: { tick, poolKey }
          })
        ).returns
      ).toBe(true)

      await Flip.execute(sender, {
        initialFields: {
          invariant: invariant.contractId,
          value: false,
          tick,
          poolKey
        },
        attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
      })

      expect(
        (
          await invariant.view.getBit({
            args: { tick, poolKey }
          })
        ).returns
      ).toBe(false)
    }
  })
  test('next initialized chunk - simple', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick = 5n
    const tickSpacing = 1n

    const feeTier = await newFeeTier(0n, tickSpacing)
    const poolKey = await newPoolKey(token0Addr, token1Addr, feeTier)

    const [chunkIndex] = (await invariant.view.tickToPosition({ args: { tick, tickSpacing } }))
      .returns

    await InitializeChunk.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        caller: sender.address,
        poolKey,
        chunk: chunkIndex
      },
      attoAlphAmount: ONE_ALPH
    })

    await Flip.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        value: true,
        tick,
        poolKey
      },
      attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
    })

    const [isSome, index] = (
      await invariant.view.nextInitialized({ args: { tick: 0n, tickSpacing: 1n, poolKey } })
    ).returns
    expect(isSome).toBe(true)
    expect(index).toBe(tick)
  })
  test('next initialized chunk - multiple', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick50 = 50n
    const tick100 = 100n
    const tickSpacing = 10n
    const feeTier = await newFeeTier(0n, tickSpacing)
    const poolKey = await newPoolKey(token0Addr, token1Addr, feeTier)

    {
      const [chunkIndex] = (
        await invariant.view.tickToPosition({ args: { tick: tick50, tickSpacing } })
      ).returns

      await InitializeChunk.execute(sender, {
        initialFields: {
          invariant: invariant.contractId,
          caller: sender.address,
          poolKey,
          chunk: chunkIndex
        },
        attoAlphAmount: ONE_ALPH
      })

      await Flip.execute(sender, {
        initialFields: {
          invariant: invariant.contractId,
          value: true,
          tick: tick50,
          poolKey
        },
        attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
      })
    }
    {
      const [chunkIndex] = (
        await invariant.view.tickToPosition({ args: { tick: tick100, tickSpacing } })
      ).returns

      await InitializeChunk.execute(sender, {
        initialFields: {
          invariant: invariant.contractId,
          caller: sender.address,
          poolKey,
          chunk: chunkIndex
        },
        attoAlphAmount: ONE_ALPH
      })

      await Flip.execute(sender, {
        initialFields: {
          invariant: invariant.contractId,
          value: true,
          tick: tick100,
          poolKey
        },
        attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
      })
    }
    {
      const [isSome, index] = (
        await invariant.view.nextInitialized({ args: { tick: 0n, tickSpacing: 10n, poolKey } })
      ).returns
      expect(isSome).toBe(true)
      expect(index).toBe(tick50)
    }
    {
      const [isSome, index] = (
        await invariant.view.nextInitialized({ args: { tick: 50n, tickSpacing: 10n, poolKey } })
      ).returns
      expect(isSome).toBe(true)
      expect(index).toBe(tick100)
    }
  })

  test('next initialized chunk - current is last', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick = 0n
    const tickSpacing = 10n
    const feeTier = await newFeeTier(0n, tickSpacing)
    const poolKey = await newPoolKey(token0Addr, token1Addr, feeTier)

    const [chunkIndex] = (await invariant.view.tickToPosition({ args: { tick, tickSpacing } }))
      .returns

    await InitializeChunk.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        caller: sender.address,
        poolKey,
        chunk: chunkIndex
      },
      attoAlphAmount: ONE_ALPH
    })

    await Flip.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        value: true,
        tick,
        poolKey
      },
      attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
    })

    const [isSome, index] = (
      await invariant.view.nextInitialized({ args: { tick, tickSpacing, poolKey } })
    ).returns
    expect(isSome).toBe(false)
  })
  test('next initialized chunk - just below limit', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick = 0n
    const tickSpacing = 1n
    const feeTier = await newFeeTier(0n, tickSpacing)
    const poolKey = await newPoolKey(token0Addr, token1Addr, feeTier)

    const [chunkIndex] = (await invariant.view.tickToPosition({ args: { tick, tickSpacing } }))
      .returns

    await InitializeChunk.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        caller: sender.address,
        poolKey,
        chunk: chunkIndex
      },
      attoAlphAmount: ONE_ALPH
    })

    await Flip.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        value: true,
        tick,
        poolKey
      },
      attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
    })

    const [isSome, index] = (
      await invariant.view.nextInitialized({
        args: { tick: -TICK_SEARCH_RANGE, tickSpacing: 1n, poolKey }
      })
    ).returns
    expect(isSome).toBe(true)
    expect(index).toBe(tick)
  })
  test('next initialized chunk - at limit', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick = 0n
    const tickSpacing = 1n
    const feeTier = await newFeeTier(0n, tickSpacing)
    const poolKey = await newPoolKey(token0Addr, token1Addr, feeTier)

    const [chunkIndex] = (await invariant.view.tickToPosition({ args: { tick, tickSpacing } }))
      .returns

    await InitializeChunk.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        caller: sender.address,
        poolKey,
        chunk: chunkIndex
      },
      attoAlphAmount: ONE_ALPH
    })

    await Flip.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        value: true,
        tick,
        poolKey
      },
      attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
    })

    const [isSome, index] = (
      await invariant.view.nextInitialized({
        args: { tick: -TICK_SEARCH_RANGE - 1n, tickSpacing: 1n, poolKey }
      })
    ).returns
    expect(isSome).toBe(false)
  })
  test('next initialized chunk - farther than limit', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick = GLOBAL_MAX_TICK - 10n
    const tickSpacing = 1n
    const feeTier = await newFeeTier(0n, tickSpacing)
    const poolKey = await newPoolKey(token0Addr, token1Addr, feeTier)

    const [chunkIndex] = (await invariant.view.tickToPosition({ args: { tick, tickSpacing } }))
      .returns

    await InitializeChunk.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        caller: sender.address,
        poolKey,
        chunk: chunkIndex
      },
      attoAlphAmount: ONE_ALPH
    })

    await Flip.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        value: true,
        tick,
        poolKey
      },
      attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
    })

    const [isSome, index] = (
      await invariant.view.nextInitialized({
        args: { tick: GLOBAL_MIN_TICK + 1n, tickSpacing: 1n, poolKey }
      })
    ).returns
    expect(isSome).toBe(false)
  })
  test('next initialized chunk - hitting the limit limit', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick = GLOBAL_MAX_TICK - 22n
    const tickSpacing = 4n
    const feeTier = await newFeeTier(0n, tickSpacing)
    const poolKey = await newPoolKey(token0Addr, token1Addr, feeTier)

    const [isSome, index] = (
      await invariant.view.nextInitialized({ args: { tick, tickSpacing, poolKey } })
    ).returns
    expect(isSome).toBe(false)
  })
  test('next initialized chunk - already at limit', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick = GLOBAL_MAX_TICK - 2n
    const tickSpacing = 4n
    const feeTier = await newFeeTier(0n, tickSpacing)
    const poolKey = await newPoolKey(token0Addr, token1Addr, feeTier)

    const [isSome] = (
      await invariant.view.nextInitialized({ args: { tick, tickSpacing, poolKey } })
    ).returns
    expect(isSome).toBe(false)
  })
  test('next initialized chunk - at pos 255', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick = GLOBAL_MAX_TICK - 255n
    const tickSpacing = 1n
    const feeTier = await newFeeTier(0n, tickSpacing)
    const poolKey = await newPoolKey(token0Addr, token1Addr, feeTier)

    const [chunkIndex] = (await invariant.view.tickToPosition({ args: { tick, tickSpacing } }))
      .returns

    await InitializeChunk.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        caller: sender.address,
        poolKey,
        chunk: chunkIndex
      },
      attoAlphAmount: ONE_ALPH
    })

    await Flip.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        value: true,
        tick,
        poolKey
      },
      attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
    })

    const [isSome, index] = (
      await invariant.view.nextInitialized({
        args: { tick: GLOBAL_MAX_TICK - 256n, tickSpacing, poolKey }
      })
    ).returns
    expect(isSome).toBe(true)
    expect(index).toBe(tick)
  })
  test('prev initialized - simple', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick = -5n
    const tickSpacing = 1n
    const feeTier = await newFeeTier(0n, tickSpacing)
    const poolKey = await newPoolKey(token0Addr, token1Addr, feeTier)

    const [chunkIndex] = (await invariant.view.tickToPosition({ args: { tick, tickSpacing } }))
      .returns

    await InitializeChunk.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        caller: sender.address,
        poolKey,
        chunk: chunkIndex
      },
      attoAlphAmount: ONE_ALPH
    })

    await Flip.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        value: true,
        tick,
        poolKey
      },
      attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
    })

    const [isSome, index] = (
      await invariant.view.prevInitialized({ args: { tick: 0n, tickSpacing, poolKey } })
    ).returns
    expect(isSome).toBe(true)
    expect(index).toBe(tick)
  })
  test('prev initialized chunk - multiple', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick50 = -50n
    const tick100 = -100n
    const tickSpacing = 10n
    const feeTier = await newFeeTier(0n, tickSpacing)
    const poolKey = await newPoolKey(token0Addr, token1Addr, feeTier)
    {
      const [chunkIndex] = (
        await invariant.view.tickToPosition({ args: { tick: tick50, tickSpacing } })
      ).returns

      await InitializeChunk.execute(sender, {
        initialFields: {
          invariant: invariant.contractId,
          caller: sender.address,
          poolKey,
          chunk: chunkIndex
        },
        attoAlphAmount: ONE_ALPH
      })

      await Flip.execute(sender, {
        initialFields: {
          invariant: invariant.contractId,
          value: true,
          tick: tick50,
          poolKey
        },
        attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
      })
    }
    {
      const [chunkIndex] = (
        await invariant.view.tickToPosition({ args: { tick: tick100, tickSpacing } })
      ).returns

      await InitializeChunk.execute(sender, {
        initialFields: {
          invariant: invariant.contractId,
          caller: sender.address,
          poolKey,
          chunk: chunkIndex
        },
        attoAlphAmount: ONE_ALPH
      })

      await Flip.execute(sender, {
        initialFields: {
          invariant: invariant.contractId,
          value: true,
          tick: tick100,
          poolKey
        },
        attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
      })
    }
    {
      const [isSome, index] = (
        await invariant.view.prevInitialized({ args: { tick: 0n, tickSpacing, poolKey } })
      ).returns
      expect(isSome).toBe(true)
      expect(index).toBe(tick50)
    }
    {
      const [isSome, index] = (
        await invariant.view.prevInitialized({ args: { tick: -50n, tickSpacing: 10n, poolKey } })
      ).returns
      expect(isSome).toBe(true)
      expect(index).toBe(tick50)
    }
  })
  test('prev initialized chunk - current is last', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick = 0n
    const tickSpacing = 10n
    const feeTier = await newFeeTier(0n, tickSpacing)
    const poolKey = await newPoolKey(token0Addr, token1Addr, feeTier)

    const [chunkIndex] = (await invariant.view.tickToPosition({ args: { tick, tickSpacing } }))
      .returns

    await InitializeChunk.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        caller: sender.address,
        poolKey,
        chunk: chunkIndex
      },
      attoAlphAmount: ONE_ALPH
    })

    await Flip.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        value: true,
        tick,
        poolKey
      },
      attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
    })

    const [isSome, index] = (
      await invariant.view.prevInitialized({ args: { tick, tickSpacing, poolKey } })
    ).returns
    expect(isSome).toBe(true)
    expect(index).toBe(tick)
  })
  test('prev initialized chunk - next is last', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick = 10n
    const tickSpacing = 10n
    const feeTier = await newFeeTier(0n, tickSpacing)
    const poolKey = await newPoolKey(token0Addr, token1Addr, feeTier)

    const [chunkIndex] = (await invariant.view.tickToPosition({ args: { tick, tickSpacing } }))
      .returns

    await InitializeChunk.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        caller: sender.address,
        poolKey,
        chunk: chunkIndex
      },
      attoAlphAmount: ONE_ALPH
    })

    await Flip.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        value: true,
        tick,
        poolKey
      },
      attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
    })

    const [isSome] = (
      await invariant.view.prevInitialized({ args: { tick: 0n, tickSpacing, poolKey } })
    ).returns
    expect(isSome).toBe(false)
  })
  test('prev initialized chunk - just below limit', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick = 0n
    const tickSpacing = 1n
    const feeTier = await newFeeTier(0n, tickSpacing)
    const poolKey = await newPoolKey(token0Addr, token1Addr, feeTier)

    const [chunkIndex] = (await invariant.view.tickToPosition({ args: { tick, tickSpacing } }))
      .returns

    await InitializeChunk.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        caller: sender.address,
        poolKey,
        chunk: chunkIndex
      },
      attoAlphAmount: ONE_ALPH
    })

    await Flip.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        value: true,
        tick,
        poolKey
      },
      attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
    })

    const [isSome, index] = (
      await invariant.view.prevInitialized({
        args: { tick: TICK_SEARCH_RANGE, tickSpacing, poolKey }
      })
    ).returns

    expect(isSome).toBe(true)
    expect(index).toBe(tick)
  })
  test('prev initialized chunk - at limit', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick = 0n
    const tickSpacing = 1n
    const feeTier = await newFeeTier(0n, tickSpacing)
    const poolKey = await newPoolKey(token0Addr, token1Addr, feeTier)

    const [chunkIndex] = (await invariant.view.tickToPosition({ args: { tick, tickSpacing } }))
      .returns

    await InitializeChunk.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        caller: sender.address,
        poolKey,
        chunk: chunkIndex
      },
      attoAlphAmount: ONE_ALPH
    })

    await Flip.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        value: true,
        tick,
        poolKey
      },
      attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
    })

    const [isSome] = (
      await invariant.view.prevInitialized({
        args: { tick: TICK_SEARCH_RANGE + 1n, tickSpacing, poolKey }
      })
    ).returns
    expect(isSome).toBe(false)
  })
  test('prev initialized chunk - further than limit', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick = GLOBAL_MIN_TICK + 1n
    const tickSpacing = 1n
    const feeTier = await newFeeTier(0n, tickSpacing)
    const poolKey = await newPoolKey(token0Addr, token1Addr, feeTier)

    const [chunkIndex] = (await invariant.view.tickToPosition({ args: { tick, tickSpacing } }))
      .returns

    await InitializeChunk.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        caller: sender.address,
        poolKey,
        chunk: chunkIndex
      },
      attoAlphAmount: ONE_ALPH
    })

    await Flip.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        value: true,
        tick,
        poolKey
      },
      attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
    })

    const [isSome] = (
      await invariant.view.prevInitialized({
        args: { tick: GLOBAL_MAX_TICK - 1n, tickSpacing, poolKey }
      })
    ).returns
    expect(isSome).toBe(false)
  })
  test('prev initialized chunk - at pos 255', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick = GLOBAL_MIN_TICK + 255n
    const tickSpacing = 1n
    const feeTier = await newFeeTier(0n, tickSpacing)
    const poolKey = await newPoolKey(token0Addr, token1Addr, feeTier)

    const [chunkIndex] = (await invariant.view.tickToPosition({ args: { tick, tickSpacing } }))
      .returns

    await InitializeChunk.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        caller: sender.address,
        poolKey,
        chunk: chunkIndex
      },
      attoAlphAmount: ONE_ALPH
    })

    await Flip.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        value: true,
        tick,
        poolKey
      },
      attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
    })

    const [isSome, index] = (
      await invariant.view.prevInitialized({
        args: { tick: GLOBAL_MIN_TICK + 320n, tickSpacing, poolKey }
      })
    ).returns
    expect(isSome).toBe(true)
    expect(index).toBe(tick)
  })
  test('prev initialized chunk - at pos 0', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick = GLOBAL_MIN_TICK
    const tickSpacing = 1n
    const feeTier = await newFeeTier(0n, tickSpacing)
    const poolKey = await newPoolKey(token0Addr, token1Addr, feeTier)

    const [chunkIndex] = (await invariant.view.tickToPosition({ args: { tick, tickSpacing } }))
      .returns

    await InitializeChunk.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        caller: sender.address,
        poolKey,
        chunk: chunkIndex
      },
      attoAlphAmount: ONE_ALPH
    })

    await Flip.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        value: true,
        tick,
        poolKey
      },
      attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
    })

    const [isSome, index] = (
      await invariant.view.prevInitialized({
        args: { tick: GLOBAL_MIN_TICK + 255n, tickSpacing, poolKey }
      })
    ).returns
    expect(isSome).toBe(true)
    expect(index).toBe(tick)
  })
  test('get search limit', async () => {
    const invariant = await deployInvariant(sender, protocolFee)

    {
      const tick = 0n
      const tickSpacing = 1n
      const up = true
      const result = (await invariant.view.getSearchLimit({ args: { tick, tickSpacing, up } }))
        .returns
      expect(result).toBe(TICK_SEARCH_RANGE)
    }
    {
      const tick = 0n
      const tickSpacing = 1n
      const up = false
      const result = (await invariant.view.getSearchLimit({ args: { tick, tickSpacing, up } }))
        .returns
      expect(result).toBe(-TICK_SEARCH_RANGE)
    }
    {
      const tick = 60n
      const tickSpacing = 12n
      const up = true
      const result = (await invariant.view.getSearchLimit({ args: { tick, tickSpacing, up } }))
        .returns
      const expected = tick + TICK_SEARCH_RANGE * tickSpacing
      expect(result).toBe(expected)
    }
    {
      const tick = 60n
      const tickSpacing = 12n
      const up = false
      const result = (await invariant.view.getSearchLimit({ args: { tick, tickSpacing, up } }))
        .returns
      const expected = tick - TICK_SEARCH_RANGE * tickSpacing
      expect(result).toBe(expected)
    }
    {
      const tick = GLOBAL_MAX_TICK - 22n
      const tickSpacing = 5n
      const up = true
      const result = (await invariant.view.getSearchLimit({ args: { tick, tickSpacing, up } }))
        .returns
      const expected = GLOBAL_MAX_TICK - 3n
      expect(result).toBe(expected)
    }
    {
      const tick = GLOBAL_MAX_TICK - 3n
      const tickSpacing = 5n
      const up = true
      const result = (await invariant.view.getSearchLimit({ args: { tick, tickSpacing, up } }))
        .returns
      const expected = tick
      expect(result).toBe(expected)
    }
  })
  test('test next and prev intialized', async () => {
    // initialized edges
    for (let tickSpacing = 1n; tickSpacing <= 10n; tickSpacing++) {
      const feeTier = await newFeeTier(0n, tickSpacing)
      const poolKey = await newPoolKey(token0Addr, token1Addr, feeTier)
      const invariant = await deployInvariant(sender, protocolFee)

      const maxIndex = GLOBAL_MAX_TICK - (GLOBAL_MAX_TICK % tickSpacing)
      const minIndex = -maxIndex

      {
        const [chunkIndex] = (
          await invariant.view.tickToPosition({ args: { tick: maxIndex, tickSpacing } })
        ).returns

        await InitializeChunk.execute(sender, {
          initialFields: {
            invariant: invariant.contractId,
            caller: sender.address,
            poolKey,
            chunk: chunkIndex
          },
          attoAlphAmount: ONE_ALPH
        })

        await Flip.execute(sender, {
          initialFields: {
            invariant: invariant.contractId,
            value: true,
            tick: maxIndex,
            poolKey
          },
          attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
        })
      }
      {
        const [chunkIndex] = (
          await invariant.view.tickToPosition({ args: { tick: minIndex, tickSpacing } })
        ).returns

        await InitializeChunk.execute(sender, {
          initialFields: {
            invariant: invariant.contractId,
            caller: sender.address,
            poolKey,
            chunk: chunkIndex
          },
          attoAlphAmount: ONE_ALPH
        })

        await Flip.execute(sender, {
          initialFields: {
            invariant: invariant.contractId,
            value: true,
            tick: minIndex,
            poolKey
          },
          attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
        })
      }
      const tickEdgeDiff = (TICK_SEARCH_RANGE / tickSpacing) * tickSpacing
      {
        const [isSome] = (
          await invariant.view.nextInitialized({
            args: { tick: maxIndex - tickEdgeDiff, tickSpacing, poolKey }
          })
        ).returns
        expect(isSome).toBe(true)
      }
      {
        const [isSome] = (
          await invariant.view.prevInitialized({
            args: { tick: minIndex + tickEdgeDiff, tickSpacing, poolKey }
          })
        ).returns
        expect(isSome).toBe(true)
      }
    }
    for (let tickSpacing = 1n; tickSpacing <= 10n; tickSpacing++) {
      const feeTier = await newFeeTier(0n, tickSpacing)
      const poolKey = await newPoolKey(token0Addr, token1Addr, feeTier)
      const invariant = await deployInvariant(sender, protocolFee)

      const maxIndex = GLOBAL_MAX_TICK - (GLOBAL_MAX_TICK % tickSpacing)
      const minIndex = -maxIndex

      const tickEdgeDiff = (TICK_SEARCH_RANGE / tickSpacing) * tickSpacing
      {
        const [isSome] = (
          await invariant.view.nextInitialized({
            args: { tick: maxIndex - tickEdgeDiff, tickSpacing, poolKey }
          })
        ).returns
        expect(isSome).toBe(false)
      }
      {
        const [isSome] = (
          await invariant.view.prevInitialized({
            args: { tick: minIndex + tickEdgeDiff, tickSpacing, poolKey }
          })
        ).returns
        expect(isSome).toBe(false)
      }
    }
  }, 175000)
})
