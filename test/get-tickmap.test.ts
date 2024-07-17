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

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

describe('init invariant test', () => {
  const initialFee = 0n
  const [fee] = getBasicFeeTickSpacing()
  const tickSpacing = 1n
  const initSqrtPrice = 10n ** 24n
  const supply = 10n ** 10n
  const lowerTickIndex = GlobalMinTick
  const upperTickIndex = GlobalMaxTick
  let invariant: Invariant
  let deployer: PrivateKeyWallet
  let positionOwner: PrivateKeyWallet
  let tokenX: TokenFaucetInstance
  let tokenY: TokenFaucetInstance
  let feeTier: FeeTier
  let poolKey: PoolKey

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

    const liquidityDelta = toLiquidity(10n)
    const pool = await invariant.getPool(poolKey)
    await invariant.createPosition(
      positionOwner,
      poolKey,
      lowerTickIndex,
      upperTickIndex,
      liquidityDelta,
      supply,
      supply,
      pool.sqrtPrice,
      pool.sqrtPrice
    )
  })

  test('Initialize all batches', async () => {
    const batchSize = 94n * 256n
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
  }, 10000000)
  test('get tickmap slice', async () => {
    const tickmap = await invariant.getFullTickmap(poolKey)
  })
})
