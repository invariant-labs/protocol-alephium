import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { Invariant } from '../src/invariant'
import { Network } from '../src/network'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { getBasicFeeTickSpacing } from '../src/snippets'
import { TokenFaucetInstance } from '../artifacts/ts'
import { initTokensXY, toLiquidity, withdrawTokens } from '../src/testUtils'
import { FeeTier, PoolKey } from '../artifacts/ts/types'
import { balanceOf, newFeeTier, newPoolKey } from '../src/utils'
import { GlobalMaxTick, GlobalMinTick } from '../src'
import { ChunkSize, ChunksPerBatch } from '../src/consts'
import { before } from 'node:test'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

describe('init invariant test', () => {
  const initialFee = 0n
  const [fee] = getBasicFeeTickSpacing()
  const tickSpacing = 1n
  const initSqrtPrice = 10n ** 24n
  const supply = 10n ** 10n
  const lowerTickIndex = GlobalMinTick
  const upperTickIndex = GlobalMaxTick
  const ticks = [-221818n, -221817n, -58n, 5n, 221817n, 221818n]
  let invariant: Invariant
  let deployer: PrivateKeyWallet
  let positionOwner: PrivateKeyWallet
  let tokenX: TokenFaucetInstance
  let tokenY: TokenFaucetInstance
  let feeTier: FeeTier
  let poolKey: PoolKey

  beforeAll(async () => {
    deployer = await getSigner(ONE_ALPH * 1000n, 0)
    positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
    invariant = await Invariant.deploy(deployer, Network.Local, initialFee)
    ;[tokenX, tokenY] = await initTokensXY(deployer, supply)
    feeTier = await newFeeTier(fee, tickSpacing)
    poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)
    await invariant.addFeeTier(deployer, feeTier)
    await invariant.createPool(
      deployer,
      tokenX.contractId,
      tokenY.contractId,
      feeTier,
      initSqrtPrice
    )
    await withdrawTokens(positionOwner, [tokenX, supply], [tokenY, supply])
    // const { sqrtPrice } = await invariant.getPool(poolKey)
    // const approveX = await balanceOf(tokenX.contractId, positionOwner.address)
    // const approveY = await balanceOf(tokenY.contractId, positionOwner.address)
    // await invariant.createPosition(
    //   positionOwner,
    //   poolKey,
    //   ticks[2],
    //   ticks[3],
    //   10n,
    //   approveX,
    //   approveY,
    //   sqrtPrice,
    //   sqrtPrice
    // )
  })

  test('get tickmap slice', async () => {
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
      sqrtPrice
    )
    const batchSize = ChunkSize * ChunksPerBatch
    const pool = await invariant.getPool(poolKey)
    for (let i = GlobalMinTick; i <= GlobalMaxTick; i += batchSize) {
      const approveX = await balanceOf(tokenX.contractId, positionOwner.address)
      const approveY = await balanceOf(tokenY.contractId, positionOwner.address)
      await invariant.createPosition(
        positionOwner,
        poolKey,
        i,
        i + 1n,
        10n,
        approveX,
        approveY,
        pool.sqrtPrice,
        pool.sqrtPrice
      )
    }

    {
      await invariant.getFullTickmap(poolKey)
    }
    {
      await invariant.getFullTickmapLegacy(poolKey)
    }
  }, 1000000)

  test('get tickmap', async () => {
    const tickmap = await invariant.getFullTickmap(poolKey)
    console.log(tickmap.bitmap)
    console.log(tickmap.bitmap.get(0n))
    console.log(tickmap.bitmap.get(866n))
    expect(tickmap.bitmap.get(0n)).toBe(3n)
  })
})
