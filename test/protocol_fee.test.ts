import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { InvariantInstance, TokenFaucetInstance } from '../artifacts/ts'
import { balanceOf, deployInvariant } from '../src/utils'
import { InvariantError, LiquidityScale, MinSqrtPrice, PercentageScale } from '../src/consts'
import {
  expectError,
  getPool,
  initFeeTier,
  initPool,
  initPositionWithLiquidity,
  initSwap,
  initTokensXY,
  withdrawProtocolFee,
  withdrawTokens
} from '../src/testUtils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let admin: PrivateKeyWallet
let invariant: InvariantInstance
let tokenX: TokenFaucetInstance
let tokenY: TokenFaucetInstance

describe('protocol fee tests', () => {
  const fee = 6n * 10n ** (PercentageScale - 3n)
  const tickSpacing = 10n

  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)

    // 1%
    const protocolFee = 10n ** (PercentageScale - 2n)
    invariant = await deployInvariant(admin, protocolFee)

    const amount = 1000000n + 1000n
    ;[tokenX, tokenY] = await initTokensXY(admin, amount)

    await initFeeTier(invariant, admin, fee, tickSpacing)

    const initSqrtPrice = 10n ** 24n
    await initPool(invariant, admin, tokenX, tokenY, fee, tickSpacing, initSqrtPrice, 0n)

    const positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
    // init basic position
    {
      const withdrawAmount = 1000000n
      await withdrawTokens(positionOwner, [tokenX, withdrawAmount], [tokenY, withdrawAmount])

      const poolBefore = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
      const liquidityDelta = 1000000n * 10n ** LiquidityScale
      const slippageLimit = poolBefore.sqrtPrice
      const [lowerTick, upperTick] = [-20n, 10n]
      await initPositionWithLiquidity(
        invariant,
        positionOwner,
        tokenX,
        withdrawAmount,
        tokenY,
        withdrawAmount,
        fee,
        tickSpacing,
        lowerTick,
        upperTick,
        liquidityDelta,
        1n,
        slippageLimit,
        slippageLimit
      )
      const poolAfter = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
      expect(poolAfter.liquidity).toBe(liquidityDelta)
    }
    // init basic swap
    {
      const poolBefore = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)

      const swapper = await getSigner(ONE_ALPH * 1000n, 0)
      const swapAmount = 1000n
      await withdrawTokens(swapper, [tokenX, swapAmount])

      const swapperTokenXBalanceBefore = await balanceOf(tokenX.contractId, swapper.address)
      expect(swapperTokenXBalanceBefore).toBe(swapAmount)

      const invariantBeforeExpectedBalance = {
        tokenX: await balanceOf(tokenX.contractId, invariant.address),
        tokenY: await balanceOf(tokenY.contractId, invariant.address)
      }
      expect(invariantBeforeExpectedBalance).toMatchObject({ tokenX: 500n, tokenY: 1000n })

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
        MinSqrtPrice
      )

      const swapperAfterExpectedBalance = {
        tokenX: await balanceOf(tokenX.contractId, swapper.address),
        tokenY: await balanceOf(tokenY.contractId, swapper.address)
      }
      expect(swapperAfterExpectedBalance).toMatchObject({ tokenX: 0n, tokenY: 993n })

      const invariantAfterExpectedBalance = {
        tokenX: await balanceOf(tokenX.contractId, invariant.address),
        tokenY: await balanceOf(tokenY.contractId, invariant.address)
      }
      expect(invariantAfterExpectedBalance).toMatchObject({ tokenX: 1500n, tokenY: 7n })

      const poolAfter = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
      const poolExpected = {
        liquidity: poolBefore.liquidity,
        sqrtPrice: 999006987054867461743028n,
        currentTickIndex: -20n,
        feeGrowthGlobalX: 5n * 10n ** 22n,
        feeGrowthGlobalY: 0n,
        feeProtocolTokenX: 1n,
        feeProtocolTokenY: 0n
      }
      expect(poolAfter).toMatchObject(poolExpected)
    }
  })

  test('protocol_fee', async () => {
    const poolBefore = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
    await withdrawProtocolFee(invariant, admin, tokenX, tokenY, fee, tickSpacing)
    const adminParams = {
      balanceX: await balanceOf(tokenX.contractId, admin.address),
      balanceY: await balanceOf(tokenY.contractId, admin.address)
    }
    const adminExpected = {
      balanceX: poolBefore.feeProtocolTokenX,
      balanceY: poolBefore.feeProtocolTokenY
    }
    expect(adminParams).toMatchObject(adminExpected)

    const poolAfter = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
    expect(poolAfter).toMatchObject({ feeProtocolTokenX: 0n, feeProtocolTokenY: 0n })
  })

  test('protocol fee_not_admin', async () => {
    const notAdmin = await getSigner(ONE_ALPH * 1000n, 0)

    expectError(
      InvariantError.NotFeeReceiver,
      invariant,
      withdrawProtocolFee(invariant, notAdmin, tokenX, tokenY, fee, tickSpacing)
    )
  })
})
