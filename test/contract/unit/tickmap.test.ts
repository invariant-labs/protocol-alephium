import { DUST_AMOUNT, ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { InvariantInstance } from '../../../artifacts/ts'
import { deployTokenFaucet, newFeeTier, newPoolKey } from '../../../src/utils'
import { GLOBAL_MIN_TICK, GLOBAL_MAX_TICK, SEARCH_RANGE } from '../../../src/consts'
import { Percentage, PoolKey, TokenAmount, wrapPoolKey } from '../../../src/types'
import { deployInvariant } from '../../../src/testUtils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let sender: PrivateKeyWallet
let token0Id: string
let token1Id: string

const tickToPosition = async (invariant: InvariantInstance, tick: bigint, tickSpacing: bigint) => {
  return (await invariant.view.tickToPosition({ args: { tick, tickSpacing } })).returns
}

const initializeChunk = async (
  invariant: InvariantInstance,
  caller: PrivateKeyWallet,
  poolKey: PoolKey,
  chunk: bigint
) => {
  return await invariant.transact.initializeChunk({
    signer: caller,
    args: {
      originalCaller: caller.address,
      poolKey: wrapPoolKey(poolKey),
      chunk
    },
    attoAlphAmount: ONE_ALPH
  })
}

const getBit = async (
  invariant: InvariantInstance,
  tick: bigint,
  poolKey: PoolKey
): Promise<boolean> => {
  return (
    await invariant.view.getBit({
      args: { tick, poolKey: wrapPoolKey(poolKey) }
    })
  ).returns
}

const flip = async (
  invariant: InvariantInstance,
  value: boolean,
  tick: bigint,
  poolKey: PoolKey
) => {
  return await invariant.transact.flip({
    signer: sender,
    args: {
      tick,
      poolKey: wrapPoolKey(poolKey),
      value
    },
    attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
  })
}

const prevInitialized = async (
  invariant: InvariantInstance,
  tick: bigint,
  tickSpacing: bigint,
  poolKey: PoolKey
): Promise<[boolean, bigint]> => {
  return (
    await invariant.view.prevInitialized({
      args: { tick, tickSpacing, poolKey: wrapPoolKey(poolKey) }
    })
  ).returns
}

const nextInitialized = async (
  invariant: InvariantInstance,
  tick: bigint,
  tickSpacing: bigint,
  poolKey: PoolKey
): Promise<[boolean, bigint]> => {
  return (
    await invariant.view.nextInitialized({
      args: { tick, tickSpacing, poolKey: wrapPoolKey(poolKey) }
    })
  ).returns
}

const protocolFee = 100n as Percentage
describe('tickmap tests', () => {
  beforeAll(async () => {
    sender = await getSigner(ONE_ALPH * 1000n, 0)
    token0Id = (await deployTokenFaucet(sender, '', '', 0n, 0n as TokenAmount)).contractInstance
      .contractId
    token1Id = (await deployTokenFaucet(sender, '', '', 0n, 0n as TokenAmount)).contractInstance
      .contractId
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
      const feeTier = newFeeTier(0n as Percentage, tickSpacing)
      const poolKey = newPoolKey(token0Id, token1Id, feeTier)

      const [chunkIndex] = await tickToPosition(invariant, tick, tickSpacing)

      await initializeChunk(invariant, sender, poolKey, chunkIndex)

      expect(getBit(invariant, tick, poolKey)).resolves.toBeFalsy()

      await flip(invariant, true, tick, poolKey)

      expect(getBit(invariant, tick, poolKey)).resolves.toBeTruthy()

      await flip(invariant, false, tick, poolKey)

      expect(getBit(invariant, tick, poolKey)).resolves.toBeFalsy()
    }
  })
  test('next initialized chunk - simple', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick = 5n
    const tickSpacing = 1n

    const feeTier = newFeeTier(0n as Percentage, tickSpacing)
    const poolKey = newPoolKey(token0Id, token1Id, feeTier)

    const [chunkIndex] = await tickToPosition(invariant, tick, tickSpacing)

    await initializeChunk(invariant, sender, poolKey, chunkIndex)

    await flip(invariant, true, tick, poolKey)

    const [isSome, index] = await nextInitialized(invariant, 0n, tickSpacing, poolKey)
    expect(isSome).toBeTruthy()
    expect(index).toBe(tick)
  })
  test('next initialized chunk - multiple', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick50 = 50n
    const tick100 = 100n
    const tickSpacing = 10n
    const feeTier = newFeeTier(0n as Percentage, tickSpacing)
    const poolKey = newPoolKey(token0Id, token1Id, feeTier)

    {
      const [chunkIndex] = await tickToPosition(invariant, tick50, tickSpacing)
      await initializeChunk(invariant, sender, poolKey, chunkIndex)

      await flip(invariant, true, tick50, poolKey)
    }
    {
      const [chunkIndex] = await tickToPosition(invariant, tick100, tickSpacing)
      await initializeChunk(invariant, sender, poolKey, chunkIndex)

      await flip(invariant, true, tick100, poolKey)
    }
    {
      const [isSome, index] = await nextInitialized(invariant, 0n, tickSpacing, poolKey)
      expect(isSome).toBeTruthy()
      expect(index).toBe(tick50)
    }
    {
      const [isSome, index] = await nextInitialized(invariant, 50n, tickSpacing, poolKey)
      expect(isSome).toBeTruthy()
      expect(index).toBe(tick100)
    }
  })

  test('next initialized chunk - current is last', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick = 0n
    const tickSpacing = 10n
    const feeTier = newFeeTier(0n as Percentage, tickSpacing)
    const poolKey = newPoolKey(token0Id, token1Id, feeTier)

    const [chunkIndex] = await tickToPosition(invariant, tick, tickSpacing)

    await initializeChunk(invariant, sender, poolKey, chunkIndex)

    await flip(invariant, true, tick, poolKey)

    const [isSome] = await nextInitialized(invariant, tick, tickSpacing, poolKey)
    expect(isSome).toBeFalsy()
  })
  test('next initialized chunk - just below limit', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick = 0n
    const tickSpacing = 1n
    const feeTier = newFeeTier(0n as Percentage, tickSpacing)
    const poolKey = newPoolKey(token0Id, token1Id, feeTier)

    const [chunkIndex] = await tickToPosition(invariant, tick, tickSpacing)

    await initializeChunk(invariant, sender, poolKey, chunkIndex)

    await flip(invariant, true, tick, poolKey)

    const [isSome, index] = await nextInitialized(invariant, -SEARCH_RANGE, tickSpacing, poolKey)
    expect(isSome).toBeTruthy()
    expect(index).toBe(tick)
  })
  test('next initialized chunk - at limit', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick = 0n
    const tickSpacing = 1n
    const feeTier = newFeeTier(0n as Percentage, tickSpacing)
    const poolKey = newPoolKey(token0Id, token1Id, feeTier)

    const [chunkIndex] = await tickToPosition(invariant, tick, tickSpacing)

    await initializeChunk(invariant, sender, poolKey, chunkIndex)

    await flip(invariant, true, tick, poolKey)

    const [isSome] = await nextInitialized(invariant, -SEARCH_RANGE - 1n, tickSpacing, poolKey)
    expect(isSome).toBeFalsy()
  })
  test('next initialized chunk - farther than limit', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick = GLOBAL_MAX_TICK - 10n
    const tickSpacing = 1n
    const feeTier = newFeeTier(0n as Percentage, tickSpacing)
    const poolKey = newPoolKey(token0Id, token1Id, feeTier)

    const [chunkIndex] = await tickToPosition(invariant, tick, tickSpacing)

    await initializeChunk(invariant, sender, poolKey, chunkIndex)

    await flip(invariant, true, tick, poolKey)

    const [isSome] = await nextInitialized(invariant, GLOBAL_MIN_TICK + 1n, tickSpacing, poolKey)
    expect(isSome).toBeFalsy()
  })
  test('next initialized chunk - hitting the limit limit', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick = GLOBAL_MAX_TICK - 25n
    const tickSpacing = 4n
    const feeTier = newFeeTier(0n as Percentage, tickSpacing)
    const poolKey = newPoolKey(token0Id, token1Id, feeTier)

    const [isSome] = await nextInitialized(invariant, tick, tickSpacing, poolKey)
    expect(isSome).toBeFalsy()
  })
  test('next initialized chunk - already at limit', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick = GLOBAL_MAX_TICK - 2n
    const tickSpacing = 4n
    const feeTier = newFeeTier(0n as Percentage, tickSpacing)
    const poolKey = newPoolKey(token0Id, token1Id, feeTier)

    const [isSome] = await nextInitialized(invariant, tick, tickSpacing, poolKey)
    expect(isSome).toBeFalsy()
  })
  test('next initialized chunk - at pos 255', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick = GLOBAL_MAX_TICK - 255n
    const tickSpacing = 1n
    const feeTier = newFeeTier(0n as Percentage, tickSpacing)
    const poolKey = newPoolKey(token0Id, token1Id, feeTier)

    const [chunkIndex] = await tickToPosition(invariant, tick, tickSpacing)

    await initializeChunk(invariant, sender, poolKey, chunkIndex)

    await flip(invariant, true, tick, poolKey)

    const [isSome, index] = await nextInitialized(
      invariant,
      GLOBAL_MAX_TICK - 256n,
      tickSpacing,
      poolKey
    )
    expect(isSome).toBeTruthy()
    expect(index).toBe(tick)
  })
  test('prev initialized - simple', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick = -5n
    const tickSpacing = 1n
    const feeTier = newFeeTier(0n as Percentage, tickSpacing)
    const poolKey = newPoolKey(token0Id, token1Id, feeTier)

    const [chunkIndex] = await tickToPosition(invariant, tick, tickSpacing)

    await initializeChunk(invariant, sender, poolKey, chunkIndex)

    await flip(invariant, true, tick, poolKey)

    const [isSome, index] = await prevInitialized(invariant, 0n, tickSpacing, poolKey)
    expect(isSome).toBeTruthy()
    expect(index).toBe(tick)
  })
  test('prev initialized chunk - multiple', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick50 = -50n
    const tick100 = -100n
    const tickSpacing = 10n
    const feeTier = newFeeTier(0n as Percentage, tickSpacing)
    const poolKey = newPoolKey(token0Id, token1Id, feeTier)
    {
      const [chunkIndex] = await tickToPosition(invariant, tick50, tickSpacing)

      await initializeChunk(invariant, sender, poolKey, chunkIndex)

      await flip(invariant, true, tick50, poolKey)
    }
    {
      const [chunkIndex] = await tickToPosition(invariant, tick100, tickSpacing)

      await initializeChunk(invariant, sender, poolKey, chunkIndex)

      await flip(invariant, true, tick100, poolKey)
    }
    {
      const [isSome, index] = await prevInitialized(invariant, 0n, tickSpacing, poolKey)
      expect(isSome).toBeTruthy()
      expect(index).toBe(tick50)
    }
    {
      const [isSome, index] = await prevInitialized(invariant, -50n, tickSpacing, poolKey)
      expect(isSome).toBeTruthy()
      expect(index).toBe(tick50)
    }
  })
  test('prev initialized chunk - current is last', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick = 0n
    const tickSpacing = 10n
    const feeTier = newFeeTier(0n as Percentage, tickSpacing)
    const poolKey = newPoolKey(token0Id, token1Id, feeTier)

    const [chunkIndex] = await tickToPosition(invariant, tick, tickSpacing)

    await initializeChunk(invariant, sender, poolKey, chunkIndex)

    await flip(invariant, true, tick, poolKey)

    const [isSome, index] = await prevInitialized(invariant, tick, tickSpacing, poolKey)
    expect(isSome).toBeTruthy()
    expect(index).toBe(tick)
  })
  test('prev initialized chunk - next is last', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick = 10n
    const tickSpacing = 10n
    const feeTier = newFeeTier(0n as Percentage, tickSpacing)
    const poolKey = newPoolKey(token0Id, token1Id, feeTier)

    const [chunkIndex] = await tickToPosition(invariant, tick, tickSpacing)

    await initializeChunk(invariant, sender, poolKey, chunkIndex)

    await flip(invariant, true, tick, poolKey)

    const [isSome] = await prevInitialized(invariant, 0n, tickSpacing, poolKey)
    expect(isSome).toBeFalsy()
  })
  test('prev initialized chunk - just below limit', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick = 0n
    const tickSpacing = 1n
    const feeTier = newFeeTier(0n as Percentage, tickSpacing)
    const poolKey = newPoolKey(token0Id, token1Id, feeTier)

    const [chunkIndex] = await tickToPosition(invariant, tick, tickSpacing)

    await initializeChunk(invariant, sender, poolKey, chunkIndex)

    await flip(invariant, true, tick, poolKey)

    const [isSome, index] = await prevInitialized(invariant, SEARCH_RANGE, tickSpacing, poolKey)
    expect(isSome).toBeTruthy()
    expect(index).toBe(tick)
  })
  test('prev initialized chunk - at limit', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick = 0n
    const tickSpacing = 1n
    const feeTier = newFeeTier(0n as Percentage, tickSpacing)
    const poolKey = newPoolKey(token0Id, token1Id, feeTier)

    const [chunkIndex] = await tickToPosition(invariant, tick, tickSpacing)

    await initializeChunk(invariant, sender, poolKey, chunkIndex)

    await flip(invariant, true, tick, poolKey)

    const [isSome] = await prevInitialized(invariant, SEARCH_RANGE + 1n, tickSpacing, poolKey)
    expect(isSome).toBeFalsy()
  })
  test('prev initialized chunk - further than limit', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick = GLOBAL_MIN_TICK + 1n
    const tickSpacing = 1n
    const feeTier = newFeeTier(0n as Percentage, tickSpacing)
    const poolKey = newPoolKey(token0Id, token1Id, feeTier)

    const [chunkIndex] = await tickToPosition(invariant, tick, tickSpacing)

    await initializeChunk(invariant, sender, poolKey, chunkIndex)

    await flip(invariant, true, tick, poolKey)

    const [isSome] = await prevInitialized(invariant, GLOBAL_MAX_TICK - 1n, tickSpacing, poolKey)
    expect(isSome).toBeFalsy()
  })
  test('prev initialized chunk - at pos 255', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick = GLOBAL_MIN_TICK + 255n
    const tickSpacing = 1n
    const feeTier = newFeeTier(0n as Percentage, tickSpacing)
    const poolKey = newPoolKey(token0Id, token1Id, feeTier)

    const [chunkIndex] = await tickToPosition(invariant, tick, tickSpacing)

    await initializeChunk(invariant, sender, poolKey, chunkIndex)

    await flip(invariant, true, tick, poolKey)

    const [isSome, index] = await prevInitialized(
      invariant,
      GLOBAL_MIN_TICK + 320n,
      tickSpacing,
      poolKey
    )
    expect(isSome).toBeTruthy()
    expect(index).toBe(tick)
  })
  test('prev initialized chunk - at pos 0', async () => {
    const invariant = await deployInvariant(sender, protocolFee)
    const tick = GLOBAL_MIN_TICK
    const tickSpacing = 1n
    const feeTier = newFeeTier(0n as Percentage, tickSpacing)
    const poolKey = newPoolKey(token0Id, token1Id, feeTier)

    const [chunkIndex] = await tickToPosition(invariant, tick, tickSpacing)

    await initializeChunk(invariant, sender, poolKey, chunkIndex)

    await flip(invariant, true, tick, poolKey)

    const [isSome, index] = await prevInitialized(
      invariant,
      GLOBAL_MIN_TICK + 255n,
      tickSpacing,
      poolKey
    )
    expect(isSome).toBeTruthy()
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
      expect(result).toBe(SEARCH_RANGE)
    }
    {
      const tick = 0n
      const tickSpacing = 1n
      const up = false
      const result = (await invariant.view.getSearchLimit({ args: { tick, tickSpacing, up } }))
        .returns
      expect(result).toBe(-SEARCH_RANGE)
    }
    {
      const tick = 60n
      const tickSpacing = 12n
      const up = true
      const result = (await invariant.view.getSearchLimit({ args: { tick, tickSpacing, up } }))
        .returns
      const expected = tick + SEARCH_RANGE * tickSpacing
      expect(result).toBe(expected)
    }
    {
      const tick = 60n
      const tickSpacing = 12n
      const up = false
      const result = (await invariant.view.getSearchLimit({ args: { tick, tickSpacing, up } }))
        .returns
      const expected = tick - SEARCH_RANGE * tickSpacing
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
      const expected = GLOBAL_MAX_TICK - 3n
      expect(result).toBe(expected)
    }
  })
  test('test next and prev intialized', async () => {
    // initialized edges
    for (let tickSpacing = 1n; tickSpacing <= 10n; tickSpacing++) {
      const feeTier = newFeeTier(0n as Percentage, tickSpacing)
      const poolKey = newPoolKey(token0Id, token1Id, feeTier)
      const invariant = await deployInvariant(sender, protocolFee)

      const maxIndex = GLOBAL_MAX_TICK - (GLOBAL_MAX_TICK % tickSpacing)
      const minIndex = -maxIndex

      {
        const [chunkIndex] = await tickToPosition(invariant, maxIndex, tickSpacing)

        await initializeChunk(invariant, sender, poolKey, chunkIndex)

        await flip(invariant, true, maxIndex, poolKey)
      }
      {
        const [chunkIndex] = await tickToPosition(invariant, minIndex, tickSpacing)

        await initializeChunk(invariant, sender, poolKey, chunkIndex)

        await flip(invariant, true, minIndex, poolKey)
      }
      const tickEdgeDiff = (SEARCH_RANGE / tickSpacing) * tickSpacing
      {
        const [isSome] = await nextInitialized(
          invariant,
          maxIndex - tickEdgeDiff,
          tickSpacing,
          poolKey
        )
        expect(isSome).toBeTruthy()
      }
      {
        const [isSome] = await prevInitialized(
          invariant,
          minIndex + tickEdgeDiff,
          tickSpacing,
          poolKey
        )
        expect(isSome).toBeTruthy()
      }
    }
    for (let tickSpacing = 1n; tickSpacing <= 10n; tickSpacing++) {
      const feeTier = newFeeTier(0n as Percentage, tickSpacing)
      const poolKey = newPoolKey(token0Id, token1Id, feeTier)
      const invariant = await deployInvariant(sender, protocolFee)

      const maxIndex = GLOBAL_MAX_TICK - (GLOBAL_MAX_TICK % tickSpacing)
      const minIndex = -maxIndex

      const tickEdgeDiff = (SEARCH_RANGE / tickSpacing) * tickSpacing
      {
        const [isSome] = await nextInitialized(
          invariant,
          maxIndex - tickEdgeDiff,
          tickSpacing,
          poolKey
        )
        expect(isSome).toBeFalsy()
      }
      {
        const [isSome] = await prevInitialized(
          invariant,
          minIndex + tickEdgeDiff,
          tickSpacing,
          poolKey
        )
        expect(isSome).toBeFalsy()
      }
    }
  })
})
