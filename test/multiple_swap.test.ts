import { ONE_ALPH } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { balanceOf, deployInvariant } from '../src/utils'
import { MaxSqrtPrice, MinSqrtPrice, PercentageScale } from '../src/consts'
import {
  feeTierExists,
  getPool,
  initFeeTier,
  initPool,
  initPositionWithLiquidity,
  initSwap,
  initTokensXY,
  quote,
  withdrawTokens
} from '../src/testUtils'
import { InvariantInstance, TokenFaucetInstance } from '../artifacts/ts'
import { calculateSqrtPrice, getLiquidity } from '../src/math'

let admin: PrivateKeyWallet
let positionOwner: PrivateKeyWallet
let swapper: PrivateKeyWallet
let invariant: InvariantInstance
let tokenX: TokenFaucetInstance
let tokenY: TokenFaucetInstance

describe('multiple swap tests', () => {
  const fee = 10n ** (PercentageScale - 3n)
  const tickSpacing = 1n
  const initTick = 0n
  const [lowerTick, upperTick] = [-953n, 953n]
  const approvedAmount = 100n

  const mintSwapper = 100n

  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
    positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
    swapper = await getSigner(ONE_ALPH * 1000n, 0)
  })

  beforeEach(async () => {
    const protocolFee = 10n ** (PercentageScale - 2n)
    invariant = await deployInvariant(admin, protocolFee)

    const mintPosition = 10n ** 10n
    ;[tokenX, tokenY] = await initTokensXY(admin, mintPosition + mintSwapper)

    await initFeeTier(invariant, admin, fee, tickSpacing)

    // pool, fee 0.1%
    {
      const [exists] = await feeTierExists(invariant, { fee, tickSpacing })
      expect(exists).toBeTruthy()
      const initSqrtPrice = await calculateSqrtPrice(initTick)

      await initPool(invariant, admin, tokenX, tokenY, fee, tickSpacing, initSqrtPrice, initTick)
    }

    // position w/ liquidity
    {
      await withdrawTokens(positionOwner, [tokenX, mintPosition], [tokenY, mintPosition])

      const pool = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)

      const { l: liquidity } = await getLiquidity(
        approvedAmount,
        approvedAmount,
        lowerTick,
        upperTick,
        pool.sqrtPrice,
        true
      )

      await initPositionWithLiquidity(
        invariant,
        positionOwner,
        tokenX,
        approvedAmount,
        tokenY,
        approvedAmount,
        fee,
        tickSpacing,
        lowerTick,
        upperTick,
        liquidity,
        1n,
        pool.sqrtPrice,
        pool.sqrtPrice
      )
    }
  })

  test('multiple swap x to y', async () => {
    // swaps
    {
      await withdrawTokens(swapper, [tokenX, mintSwapper])
      const swapAmount = 10n
      const sqrtPriceLimit = MinSqrtPrice
      for (let n = 0; n < 10; n++) {
        const { targetSqrtPrice } = await quote(
          invariant,
          tokenX,
          tokenY,
          fee,
          tickSpacing,
          true,
          swapAmount,
          true,
          sqrtPriceLimit
        )
        await initSwap(
          invariant,
          swapper,
          tokenX,
          tokenY,
          fee,
          tickSpacing,
          true,
          swapAmount,
          true,
          targetSqrtPrice
        )
      }
    }
    // final checks
    {
      const dexBalance = {
        tokenX: await balanceOf(tokenX.contractId, invariant.address),
        tokenY: await balanceOf(tokenY.contractId, invariant.address)
      }
      expect(dexBalance).toStrictEqual({ tokenX: 200n, tokenY: 20n })

      const swapperBalance = {
        tokenX: await balanceOf(tokenX.contractId, swapper.address),
        tokenY: await balanceOf(tokenY.contractId, swapper.address)
      }
      expect(swapperBalance).toStrictEqual({ tokenX: 0n, tokenY: 80n })

      const pool = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)

      const { l: liquidity } = await getLiquidity(
        approvedAmount,
        approvedAmount,
        lowerTick,
        upperTick,
        await calculateSqrtPrice(initTick),
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

  test('multiple swap y to x', async () => {
    // swaps
    {
      await withdrawTokens(swapper, [tokenY, mintSwapper])
      const swapAmount = 10n
      const sqrtPriceLimit = MaxSqrtPrice
      for (let n = 0; n < 10; n++) {
        const { targetSqrtPrice } = await quote(
          invariant,
          tokenX,
          tokenY,
          fee,
          tickSpacing,
          false,
          swapAmount,
          true,
          sqrtPriceLimit
        )

        await initSwap(
          invariant,
          swapper,
          tokenX,
          tokenY,
          fee,
          tickSpacing,
          false,
          swapAmount,
          true,
          targetSqrtPrice
        )
      }
    }
    // final checks
    {
      let dexBalance = {
        tokenX: await balanceOf(tokenX.contractId, invariant.address),
        tokenY: await balanceOf(tokenY.contractId, invariant.address)
      }
      expect(dexBalance).toStrictEqual({ tokenX: 20n, tokenY: 200n })

      let swapperBalance = {
        tokenX: await balanceOf(tokenX.contractId, swapper.address),
        tokenY: await balanceOf(tokenY.contractId, swapper.address)
      }
      expect(swapperBalance).toStrictEqual({ tokenX: 80n, tokenY: 0n })

      let pool = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)

      const { l: liquidity } = await getLiquidity(
        approvedAmount,
        approvedAmount,
        lowerTick,
        upperTick,
        await calculateSqrtPrice(initTick),
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
