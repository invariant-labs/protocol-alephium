import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { Invariant } from '../../../src/invariant'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { getBasicFeeTickSpacing } from '../../../src/snippets'
import { TokenFaucetInstance } from '../../../artifacts/ts'
import { initTokensXY, withdrawTokens } from '../../../src/testUtils'
import { balanceOf, newFeeTier, newPoolKey } from '../../../src/utils'
import { GLOBAL_MAX_TICK, GLOBAL_MIN_TICK } from '../../../src'
import { FeeTier, Liquidity, Percentage, PoolKey, TokenAmount } from '../../../src/types'
import { CHUNK_SIZE, CHUNKS_PER_BATCH } from '../../../src/consts'
import { getMaxChunk, getMaxTick, getMinTick, toLiquidity, toSqrtPrice } from '../../../src/math'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let invariant: Invariant
let deployer: PrivateKeyWallet
let positionOwner: PrivateKeyWallet
let tokenX: TokenFaucetInstance
let tokenY: TokenFaucetInstance
let feeTier: FeeTier
let poolKey: PoolKey

describe('query tickmap tests', () => {
  const initialFee = 0n as Percentage
  const [fee] = getBasicFeeTickSpacing()
  const tickSpacing = 1n
  const initSqrtPrice = toSqrtPrice(1n)
  const supply = (10n ** 10n) as TokenAmount
  const lowerTickIndex = GLOBAL_MIN_TICK
  const upperTickIndex = GLOBAL_MAX_TICK
  const ticks = [-221818n, -221817n, -58n, 5n, 221817n, 221818n]

  beforeEach(async () => {
    deployer = await getSigner(ONE_ALPH * 1000n, 0)
    positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
    invariant = await Invariant.deploy(deployer, initialFee)
    ;[tokenX, tokenY] = await initTokensXY(deployer, supply)

    feeTier = newFeeTier(fee, tickSpacing)
    poolKey = newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    await invariant.addFeeTier(deployer, feeTier)
    await invariant.createPool(deployer, poolKey, initSqrtPrice)
    await withdrawTokens(positionOwner, [tokenX, supply], [tokenY, supply])
  })

  test('get all initialized batches', async () => {
    const liquidityDelta = toLiquidity(10n)
    const { sqrtPrice } = await invariant.getPool(poolKey)
    await invariant.createPosition(
      positionOwner,
      poolKey,
      lowerTickIndex,
      upperTickIndex,
      liquidityDelta,
      supply,
      supply,
      sqrtPrice,
      0n as Percentage
    )
    const batchSize = CHUNK_SIZE * CHUNKS_PER_BATCH
    const pool = await invariant.getPool(poolKey)
    for (let i = GLOBAL_MIN_TICK; i <= GLOBAL_MAX_TICK; i += batchSize) {
      {
        const approveX = await balanceOf(tokenX.contractId, positionOwner.address)
        const approveY = await balanceOf(tokenY.contractId, positionOwner.address)
        await invariant.createPosition(
          positionOwner,
          poolKey,
          i,
          i + 1n,
          10n as Liquidity,
          approveX,
          approveY,
          pool.sqrtPrice,
          0n as Percentage
        )
      }
      {
        const approveX = await balanceOf(tokenX.contractId, positionOwner.address)
        const approveY = await balanceOf(tokenY.contractId, positionOwner.address)
        await invariant.createPosition(
          positionOwner,
          poolKey,
          i + 2n,
          i + 3n,
          10n as Liquidity,
          approveX,
          approveY,
          pool.sqrtPrice,
          0n as Percentage
        )
      }
    }

    const tickmap = await invariant.getFullTickmap(poolKey)
    const maxChunk = getMaxChunk(tickSpacing)
    const lastChunkInBatch =
      BigInt(Math.ceil(Number(maxChunk) / Number(CHUNKS_PER_BATCH))) * CHUNKS_PER_BATCH
    expect(tickmap.size).toBe(Number(lastChunkInBatch))
  }, 1000000)

  test('get tickmap', async () => {
    const { sqrtPrice } = await invariant.getPool(poolKey)
    const approveX = await balanceOf(tokenX.contractId, positionOwner.address)
    const approveY = await balanceOf(tokenY.contractId, positionOwner.address)
    await invariant.createPosition(
      positionOwner,
      poolKey,
      ticks[2],
      ticks[3],
      10n as Liquidity,
      approveX,
      approveY,
      sqrtPrice,
      0n as Percentage
    )

    const tickmap = await invariant.getFullTickmap(poolKey)
    for (const [chunkIndex, value] of tickmap.entries()) {
      if (chunkIndex === 866n) {
        expect(value).toBe(0x80000000000000010000000000000000n)
      } else {
        expect(value).toBe(0n)
      }
    }
  })
  test('get tickmap edge tick initialized on tick spacing equal 1', async () => {
    const { sqrtPrice } = await invariant.getPool(poolKey)
    {
      const approveX = await balanceOf(tokenX.contractId, positionOwner.address)
      const approveY = await balanceOf(tokenY.contractId, positionOwner.address)
      await invariant.createPosition(
        positionOwner,
        poolKey,
        ticks[0],
        ticks[1],
        10n as Liquidity,
        approveX,
        approveY,
        sqrtPrice,
        0n as Percentage
      )
    }
    {
      const approveX = await balanceOf(tokenX.contractId, positionOwner.address)
      const approveY = await balanceOf(tokenY.contractId, positionOwner.address)
      await invariant.createPosition(
        positionOwner,
        poolKey,
        ticks[4],
        ticks[5],
        10n as Liquidity,
        approveX,
        approveY,
        sqrtPrice,
        0n as Percentage
      )
    }
    const tickmap = await invariant.getFullTickmap(poolKey)
    const maxChunk = getMaxChunk(tickSpacing)
    expect(tickmap.get(0n)).toBe(0b11n)
    expect(tickmap.get(maxChunk)).toBe(
      0x18000000000000000000000000000000000000000000000000000000000000n
    )
  })
  test('get tickmap edge tick initialized on tick spacing equal 100', async () => {
    const tickSpacing = 100n
    feeTier = newFeeTier(fee, tickSpacing)
    poolKey = newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    await invariant.addFeeTier(deployer, feeTier)
    await invariant.createPool(deployer, poolKey, initSqrtPrice)
    const { sqrtPrice } = await invariant.getPool(poolKey)
    {
      const approveX = await balanceOf(tokenX.contractId, positionOwner.address)
      const approveY = await balanceOf(tokenY.contractId, positionOwner.address)
      await invariant.createPosition(
        positionOwner,
        poolKey,
        getMinTick(tickSpacing),
        getMinTick(tickSpacing) + tickSpacing,
        10n as Liquidity,
        approveX,
        approveY,
        sqrtPrice,
        0n as Percentage
      )
    }
    {
      const approveX = await balanceOf(tokenX.contractId, positionOwner.address)
      const approveY = await balanceOf(tokenY.contractId, positionOwner.address)
      await invariant.createPosition(
        positionOwner,
        poolKey,
        getMaxTick(tickSpacing) - tickSpacing,
        getMaxTick(tickSpacing),
        10n as Liquidity,
        approveX,
        approveY,
        sqrtPrice,
        0n as Percentage
      )
    }
    const tickmap = await invariant.getFullTickmap(poolKey)
    const maxChunk = getMaxChunk(tickSpacing)

    expect(tickmap.get(0n)).toBe(0b11n)
    expect(tickmap.get(maxChunk)).toBe(0x1800000000000000000000n)
  })
})
