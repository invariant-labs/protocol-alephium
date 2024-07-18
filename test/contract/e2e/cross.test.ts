import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import {
  getBasicFeeTickSpacing,
  initBasicPool,
  initBasicPosition,
  initDexAndTokens
} from '../../../src/snippets'
import { balanceOf, newFeeTier, newPoolKey } from '../../../src/utils'
import { MinSqrtPrice } from '../../../src/consts'
import {
  getPool,
  getReserveBalances,
  getTick,
  initFeeTier,
  initPosition,
  initSwap,
  withdrawTokens
} from '../../../src/testUtils'
import { toLiquidity } from '../../../src/math'

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
    const liquidityDelta = toLiquidity(1_000_000n)
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
        const invariantBalance = await getReserveBalances(invariant, poolKey)
        expect(invariantBalance).toMatchObject({ x: 500n, y: 2499n })
      }

      const poolBefore = await getPool(invariant, poolKey)
      await initSwap(invariant, swapper, poolKey, true, approvedAmount, true, MinSqrtPrice)

      expect(await getPool(invariant, poolKey)).toMatchObject({
        liquidity: poolBefore.liquidity + liquidityDelta,
        currentTickIndex: -20n,
        sqrtPrice: 999254456240199142700995n,
        feeGrowthGlobalX: 4n * 10n ** 22n,
        feeGrowthGlobalY: 0n,
        feeProtocolTokenX: 2n,
        feeProtocolTokenY: 0n
      })

      const invariantBalance = await getReserveBalances(invariant, poolKey)
      expect(invariantBalance).toMatchObject({ x: 1500n, y: 1509n })

      const swapperBalance = {
        tokenX: await balanceOf(tokenX.contractId, swapper.address),
        tokenY: await balanceOf(tokenY.contractId, swapper.address)
      }
      expect(swapperBalance).toMatchObject({ tokenX: 0n, tokenY: 990n })

      const liquidityChange = toLiquidity(1000000n)
      const lowerTick = await getTick(invariant, poolKey, -20n)
      const middleTick = await getTick(invariant, poolKey, -10n)
      const upperTick = await getTick(invariant, poolKey, 10n)

      expect(lowerTick).toMatchObject({ liquidityChange, feeGrowthOutsideX: 0n })
      expect(middleTick).toMatchObject({
        liquidityChange,
        feeGrowthOutsideX: 3n * 10n ** 22n
      })
      expect(upperTick).toMatchObject({ liquidityChange, feeGrowthOutsideX: 0n })
    }
  })
})
