import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import {
  getBasicFeeTickSpacing,
  initBasicPool,
  initBasicPosition,
  initDexAndTokens
} from '../src/snippets'
import { balanceOf, newFeeTier, newPoolKey } from '../src/utils'
import { LiquidityScale, MinSqrtPrice } from '../src/consts'
import { getPool, initFeeTier, initPosition, initSwap, withdrawTokens } from '../src/testUtils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let admin: PrivateKeyWallet

describe('cross tests', () => {
  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
  })
  test('cross', async () => {
    const [invariant, tokenX, tokenY] = await initDexAndTokens(admin, 10n ** 23n)
    const feeTier = await newFeeTier(...getBasicFeeTickSpacing())
    await initFeeTier(invariant, admin, feeTier)
    const poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    const positionsOwner = await getSigner(ONE_ALPH * 1000n, 0)
    await initBasicPool(invariant, positionsOwner, tokenX, tokenY)
    await initBasicPosition(invariant, positionsOwner, tokenX, tokenY)

    // cross position
    const liquidityDelta = 1_000_000n * 10n ** LiquidityScale
    {
      // definitely enough for the given liquidity/ticks
      const approvedAmount = liquidityDelta
      await withdrawTokens(positionsOwner, [tokenX, approvedAmount], [tokenY, approvedAmount])
      const [lowerTick, upperTick] = [-40n, -10n]

      const { sqrtPrice: slippageLimit, liquidity: beforeLiquidity } = await getPool(
        invariant,
        poolKey
      )
      await initPosition(
        invariant,
        positionsOwner,
        poolKey,
        approvedAmount,
        approvedAmount,
        lowerTick,
        upperTick,
        liquidityDelta,
        slippageLimit,
        slippageLimit
      )

      const { liquidity } = await getPool(invariant, poolKey)
      expect(liquidity).toBe(beforeLiquidity)
    }
    // cross swap
    {
      const swapper = await getSigner(ONE_ALPH * 1000n, 0)
      const approvedAmount = 1000n
      await withdrawTokens(swapper, [tokenX, approvedAmount])

      {
        const invariantBalance = {
          tokenX: await balanceOf(tokenX.contractId, invariant.address),
          tokenY: await balanceOf(tokenY.contractId, invariant.address)
        }
        expect(invariantBalance).toMatchObject({ tokenX: 500n, tokenY: 2499n })
      }

      const poolBefore = await getPool(invariant, poolKey)
      await initSwap(invariant, swapper, poolKey, true, approvedAmount, true, MinSqrtPrice)

      expect(await getPool(invariant, poolKey)).toMatchObject({
        liquidity: poolBefore.liquidity + liquidityDelta,
        currentTickIndex: -20n,
        sqrtPrice: 999254456240199142700995n,
        feeGrowthGlobalX: 40000000000000000000000n,
        feeGrowthGlobalY: 0n,
        feeProtocolTokenX: 2n,
        feeProtocolTokenY: 0n
      })

      const invariantBalance = {
        tokenX: await balanceOf(tokenX.contractId, invariant.address),
        tokenY: await balanceOf(tokenY.contractId, invariant.address)
      }
      expect(invariantBalance).toMatchObject({ tokenX: 1500n, tokenY: 1509n })

      const swapperBalance = {
        tokenX: await balanceOf(tokenX.contractId, swapper.address),
        tokenY: await balanceOf(tokenY.contractId, swapper.address)
      }
      expect(swapperBalance).toMatchObject({ tokenX: 0n, tokenY: 990n })
    }
  })
})
