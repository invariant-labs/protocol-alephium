import { ONE_ALPH } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { balanceOf, deployInvariant, newFeeTier, newPoolKey } from '../../../src/utils'
import { MAX_SQRT_PRICE, MIN_SQRT_PRICE } from '../../../src/consts'
import {
  feeTierExists,
  getPool,
  getReserveBalances,
  initFeeTier,
  initPool,
  initPosition,
  initSwap,
  initTokensXY,
  quote,
  withdrawTokens
} from '../../../src/testUtils'
import { InvariantInstance, TokenFaucetInstance } from '../../../artifacts/ts'
import { calculateSqrtPrice, getLiquidity, toPercentage } from '../../../src/math'
import { FeeTier, PoolKey, TokenAmount } from '../../../src/types'

let admin: PrivateKeyWallet
let positionOwner: PrivateKeyWallet
let swapper: PrivateKeyWallet
let invariant: InvariantInstance
let tokenX: TokenFaucetInstance
let tokenY: TokenFaucetInstance

describe('multiple swap tests', () => {
  const fee = toPercentage(1n, 3n)
  const tickSpacing = 1n
  const initTick = 0n
  const [lowerTick, upperTick] = [-953n, 953n]
  const approvedAmount = 100n as TokenAmount
  let feeTier: FeeTier
  let poolKey: PoolKey

  const mintSwapper = 100n as TokenAmount

  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
    positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
    swapper = await getSigner(ONE_ALPH * 1000n, 0)
  })

  beforeEach(async () => {
    const protocolFee = toPercentage(1n, 2n)
    invariant = await deployInvariant(admin, protocolFee)

    const mintPosition = (10n ** 10n) as TokenAmount
    ;[tokenX, tokenY] = await initTokensXY(admin, (mintPosition + mintSwapper) as TokenAmount)

    feeTier = newFeeTier(fee, tickSpacing)
    await initFeeTier(invariant, admin, feeTier)
    poolKey = newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    // pool, fee 0.1%
    {
      const [exists] = await feeTierExists(invariant, feeTier)
      expect(exists).toBeTruthy()
      const initSqrtPrice = calculateSqrtPrice(initTick)

      await initPool(invariant, admin, tokenX, tokenY, feeTier, initSqrtPrice, initTick)
    }

    // position w/ liquidity
    {
      await withdrawTokens(positionOwner, [tokenX, mintPosition], [tokenY, mintPosition])

      const pool = await getPool(invariant, poolKey)

      const { l: liquidity } = getLiquidity(
        approvedAmount,
        approvedAmount,
        lowerTick,
        upperTick,
        pool.sqrtPrice,
        true
      )

      await initPosition(
        invariant,
        positionOwner,
        poolKey,
        approvedAmount,
        approvedAmount,
        lowerTick,
        upperTick,
        liquidity,
        pool.sqrtPrice,
        pool.sqrtPrice
      )
    }
  })

  test('x to y', async () => {
    // swaps
    {
      await withdrawTokens(swapper, [tokenX, mintSwapper])
      const swapAmount = 10n as TokenAmount
      const sqrtPriceLimit = MIN_SQRT_PRICE
      for (let n = 0; n < 10; n++) {
        const { targetSqrtPrice } = await quote(
          invariant,
          poolKey,
          true,
          swapAmount,
          true,
          sqrtPriceLimit
        )
        await initSwap(invariant, swapper, poolKey, true, swapAmount, true, targetSqrtPrice)
      }
    }
    // final checks
    {
      const dexBalance = await getReserveBalances(invariant, poolKey)
      expect(dexBalance).toStrictEqual({ x: 200n, y: 20n })

      const swapperBalance = {
        tokenX: await balanceOf(tokenX.contractId, swapper.address),
        tokenY: await balanceOf(tokenY.contractId, swapper.address)
      }
      expect(swapperBalance).toStrictEqual({ tokenX: 0n, tokenY: 80n })

      const pool = await getPool(invariant, poolKey)

      const { l: liquidity } = getLiquidity(
        approvedAmount,
        approvedAmount,
        lowerTick,
        upperTick,
        calculateSqrtPrice(initTick),
        true
      )

      expect(pool).toMatchObject({
        feeGrowthGlobalX: 0n,
        feeGrowthGlobalY: 0n,
        liquidity,
        currentTickIndex: -821n,
        feeProtocolTokenX: 10n,
        feeProtocolTokenY: 0n,
        sqrtPrice: 959805958530842759275220n
      })
    }
  })

  test('y to x', async () => {
    // swaps
    {
      await withdrawTokens(swapper, [tokenY, mintSwapper])
      const swapAmount = 10n as TokenAmount
      const sqrtPriceLimit = MAX_SQRT_PRICE
      for (let n = 0; n < 10; n++) {
        const { targetSqrtPrice } = await quote(
          invariant,
          poolKey,
          false,
          swapAmount,
          true,
          sqrtPriceLimit
        )

        await initSwap(invariant, swapper, poolKey, false, swapAmount, true, targetSqrtPrice)
      }
    }
    // final checks
    {
      const dexBalance = await getReserveBalances(invariant, poolKey)
      expect(dexBalance).toStrictEqual({ x: 20n, y: 200n })

      let swapperBalance = {
        tokenX: await balanceOf(tokenX.contractId, swapper.address),
        tokenY: await balanceOf(tokenY.contractId, swapper.address)
      }
      expect(swapperBalance).toStrictEqual({ tokenX: 80n, tokenY: 0n })

      let pool = await getPool(invariant, poolKey)

      const { l: liquidity } = getLiquidity(
        approvedAmount,
        approvedAmount,
        lowerTick,
        upperTick,
        calculateSqrtPrice(initTick),
        true
      )

      expect(pool).toMatchObject({
        feeGrowthGlobalX: 0n,
        feeGrowthGlobalY: 0n,
        liquidity,
        currentTickIndex: 820n,
        feeProtocolTokenX: 0n,
        feeProtocolTokenY: 10n,
        sqrtPrice: 1041877257701839564633600n
      })
    }
  })
})
