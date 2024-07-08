import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { balanceOf, deployInvariant, newFeeTier, newPoolKey } from '../src/utils'
import {
  getBasicFeeTickSpacing,
  initBasicPool,
  initBasicPosition,
  initBasicSwap,
  initDexAndTokens
} from '../src/snippets'
import {
  getPool,
  initFeeTier,
  initPosition,
  initSwap,
  initTokensXY,
  quote,
  withdrawTokens
} from '../src/testUtils'
import { LiquidityScale, MinSqrtPrice } from '../src/consts'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

describe('max tick cross spec', () => {
  test('max tick cross', async () => {
    const admin = await getSigner(ONE_ALPH * 1000n, 0)
    const positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
    const swapper = await getSigner(ONE_ALPH * 1000n, 0)

    const [fee, tickSpacing] = getBasicFeeTickSpacing()
    const positionOwnerMint = 1n << 128n
    const swapperMint = 1n << 30n
    const supply = positionOwnerMint + swapperMint

    const invariant = await deployInvariant(admin, 0n)
    const [tokenX, tokenY] = await initTokensXY(admin, supply)
    await withdrawTokens(positionOwner, [tokenX, positionOwnerMint], [tokenY, positionOwnerMint])

    const feeTier = await newFeeTier(fee, tickSpacing)
    await initFeeTier(invariant, admin, feeTier)
    await initBasicPool(invariant, admin, tokenX, tokenY)
    const poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)
    const liquidityDelta = 10000000n * 10n ** LiquidityScale

    const lastInitializedTick = -250n
    const amount = 40300n
    // 40.3k - 8
    // 40.4k - out of gas

    for (let i = lastInitializedTick; i < 0n; i += 10n) {
      const positionOwnerBalanceX = await balanceOf(tokenX.contractId, positionOwner.address)
      const positionOwnerBalanceY = await balanceOf(tokenY.contractId, positionOwner.address)
      const { sqrtPrice: slippageLimit } = await getPool(invariant, poolKey)
      await initPosition(
        invariant,
        positionOwner,
        poolKey,
        positionOwnerBalanceX,
        positionOwnerBalanceY,
        i,
        i + 10n,
        liquidityDelta,
        slippageLimit,
        slippageLimit
      )
    }

    await withdrawTokens(swapper, [tokenX, amount])

    const slippage = MinSqrtPrice

    const { targetSqrtPrice } = await quote(invariant, poolKey, true, amount, true, slippage)

    const poolBefore = await getPool(invariant, poolKey)
    const { gasAmount } = await initSwap(
      invariant,
      swapper,
      poolKey,
      true,
      amount,
      true,
      targetSqrtPrice
    )
    const poolAfter = await getPool(invariant, poolKey)

    const crosses = (poolAfter.currentTickIndex - poolBefore.currentTickIndex) / -10n
    expect(crosses).toBe(8n)
    expect(gasAmount).toBeGreaterThan(500000n)
  }, 100000)
})
