import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { Invariant } from '../../../src/invariant'
import { Network } from '../../../src/network'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { getBasicFeeTickSpacing } from '../../../src/snippets'
import { TokenFaucetInstance } from '../../../artifacts/ts'
import { initTokensXY, withdrawTokens } from '../../../src/testUtils'
import { FeeTier, PoolKey } from '../../../artifacts/ts/types'
import { balanceOf, FixedBigIntArray, newFeeTier, newPoolKey } from '../../../src/utils'
import { GlobalMaxTick, GlobalMinTick } from '../../../src'
import { ChunkSize, ChunksPerBatch } from '../../../src/consts'
import { getMaxChunk, getMaxTick, getMinTick, toLiquidity } from '../../../src/math'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let invariant: Invariant
let deployer: PrivateKeyWallet
let positionOwner: PrivateKeyWallet
let tokenX: TokenFaucetInstance
let tokenY: TokenFaucetInstance
let feeTier: FeeTier
let poolKey: PoolKey

describe('query liquidity ticks tests', () => {
  const initialFee = 0n
  const [fee] = getBasicFeeTickSpacing()
  const tickSpacing = 1n
  const initSqrtPrice = 10n ** 24n
  const supply = 10n ** 10n

  beforeEach(async () => {
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
  })

  test('get liquidity ticks', async () => {
    const { sqrtPrice } = await invariant.getPool(poolKey)
    const [lowerTick, upperTick] = [-20n, -10n]
    const approveX = await balanceOf(tokenX.contractId, positionOwner.address)
    const approveY = await balanceOf(tokenY.contractId, positionOwner.address)
    await invariant.createPosition(
      positionOwner,
      poolKey,
      lowerTick,
      upperTick,
      10n,
      approveX,
      approveY,
      sqrtPrice,
      sqrtPrice
    )
    const ticksAmount = await invariant.getLiquidityTicksAmount(poolKey, lowerTick, upperTick)
    console.log(ticksAmount)
  })
  test('find liquidity ticks gas limit', async () => {
    const { sqrtPrice } = await invariant.getPool(poolKey)

    const pairs = 6
    const ticks = new Array(pairs)
      .fill(null)
      .map((_, index) => [BigInt(index * 2), BigInt(index * 2 + 1)])

    for (const [lowerTick, upperTick] of ticks) {
      const approveX = await balanceOf(tokenX.contractId, positionOwner.address)
      const approveY = await balanceOf(tokenY.contractId, positionOwner.address)
      await invariant.createPosition(
        positionOwner,
        poolKey,
        lowerTick,
        upperTick,
        10n,
        approveX,
        approveY,
        sqrtPrice,
        sqrtPrice
      )
    }

    const flattenTicks = ticks.flat()
    // Querying 12 ticks = 44982
    // Querying 6 ticks = 24517
    // Queryin 1 tick = 24517 / 6 = 4087
    // limit = 5 * 10 ** 6 / 4087 = 1223
    await invariant.getLiquidityTicks(poolKey, flattenTicks as FixedBigIntArray<12>)
  })
})
