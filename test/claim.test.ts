import { DUST_AMOUNT, ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { ClaimFee } from '../artifacts/ts'
import { balanceOf, deployInvariant } from '../src/utils'
import { InvariantError, LiquidityScale, MinSqrtPrice, PercentageScale } from '../src/consts'
import {
  getPool,
  initPool,
  initFeeTier,
  initPositionWithLiquidity,
  initTokensXY,
  withdrawTokens,
  initSwap,
  getPosition,
  expectError
} from '../src/testUtils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let admin: PrivateKeyWallet
let positionOwner: PrivateKeyWallet

describe('invariant tests', () => {
  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
    positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
  })

  test('claim', async () => {
    // init dex and tokens
    // 1%
    const protocolFee = 10n ** (PercentageScale - 2n)
    const invariant = await deployInvariant(admin, protocolFee)

    // 0.6%
    const fee = 6n * 10n ** (PercentageScale - 3n)
    const tickSpacing = 10n
    await initFeeTier(invariant, admin, fee, tickSpacing)

    let supply = 10n ** 6n + 1000n
    let amount = 10n ** 6n
    const [tokenX, tokenY] = await initTokensXY(admin, supply)
    await withdrawTokens(positionOwner, [tokenX, amount], [tokenY, amount])

    await initPool(invariant, positionOwner, tokenX, tokenY, fee, tickSpacing, 10n ** 24n, 0n)
    const poolBefore = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)

    const lowerTick = -20n
    const upperTick = 10n
    const liquidity = 1000000n * 10n ** LiquidityScale
    const slippageLimit = poolBefore.sqrtPrice

    await initPositionWithLiquidity(
      invariant,
      positionOwner,
      tokenX,
      amount,
      tokenY,
      amount,
      fee,
      tickSpacing,
      lowerTick,
      upperTick,
      liquidity,
      1n,
      slippageLimit,
      slippageLimit
    )

    {
      const swapper = await getSigner(ONE_ALPH * 1000n, 0)
      const swapAmount = 1000n
      await withdrawTokens(swapper, [tokenX, swapAmount], [tokenY, swapAmount])

      const swapperTokenXBalanceBefore = await balanceOf(tokenX.contractId, swapper.address)
      const invariantTokenXBalanceBefore = await balanceOf(tokenX.contractId, invariant.address)
      const invariantTokenYBalanceBefore = await balanceOf(tokenY.contractId, invariant.address)

      expect(swapperTokenXBalanceBefore).toBe(swapAmount)
      expect(invariantTokenXBalanceBefore).toBe(500n)
      expect(invariantTokenYBalanceBefore).toBe(1000n)

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

      const swapperTokenXBalanceAfter = await balanceOf(tokenX.contractId, swapper.address)
      expect(swapperTokenXBalanceAfter).toBe(0n)
    }

    const positionOwnerToken0BalanceBefore = await balanceOf(
      tokenX.contractId,
      positionOwner.address
    )
    const positionOwnerToken1BalanceBefore = await balanceOf(
      tokenY.contractId,
      positionOwner.address
    )
    const invariantToken0BalanceBefore = await balanceOf(tokenX.contractId, invariant.address)
    const invariantToken1BalanceBefore = await balanceOf(tokenY.contractId, invariant.address)

    await ClaimFee.execute(positionOwner, {
      initialFields: {
        invariant: invariant.contractId,
        index: 1n
      },
      attoAlphAmount: DUST_AMOUNT
    })

    const positionOwnerToken0BalanceAfter = await balanceOf(
      tokenX.contractId,
      positionOwner.address
    )
    const positionOwnerToken1BalanceAfter = await balanceOf(
      tokenY.contractId,
      positionOwner.address
    )
    const invariantToken0BalanceAfter = await balanceOf(tokenX.contractId, invariant.address)
    const invariantToken1BalanceAfter = await balanceOf(tokenY.contractId, invariant.address)
    const expectedTokensClaimed = 5n

    // balance of the token we claimed changed
    expect(positionOwnerToken0BalanceAfter - expectedTokensClaimed).toBe(
      positionOwnerToken0BalanceBefore
    )
    expect(invariantToken0BalanceAfter + expectedTokensClaimed).toBe(invariantToken0BalanceBefore)

    // and the other one's not
    expect(invariantToken1BalanceAfter).toBe(invariantToken1BalanceBefore)
    expect(positionOwnerToken1BalanceAfter).toBe(positionOwnerToken1BalanceBefore)

    const poolAfter = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)

    const positionAfter = await getPosition(invariant, positionOwner.address, 1n)

    expect(positionAfter.feeGrowthInsideX).toBe(poolAfter.feeGrowthGlobalX)
    expect(positionAfter.tokensOwedX).toBe(0n)
  })

  test('claim_not_owner', async () => {
    // init dex and tokens
    // 1%
    const protocolFee = 10n ** (PercentageScale - 2n)
    const invariant = await deployInvariant(admin, protocolFee)

    // 0.6%
    const fee = 6n * 10n ** (PercentageScale - 3n)
    const tickSpacing = 10n
    await initFeeTier(invariant, admin, fee, tickSpacing)

    let supply = 10n ** 6n + 1000n
    let amount = 10n ** 6n
    const [tokenX, tokenY] = await initTokensXY(admin, supply)
    await withdrawTokens(positionOwner, [tokenX, amount], [tokenY, amount])

    await initPool(invariant, positionOwner, tokenX, tokenY, fee, tickSpacing, 10n ** 24n, 0n)
    const poolBefore = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)

    const lowerTick = -20n
    const upperTick = 10n
    const liquidity = 1000000n * 10n ** LiquidityScale
    const slippageLimit = poolBefore.sqrtPrice

    await initPositionWithLiquidity(
      invariant,
      positionOwner,
      tokenX,
      amount,
      tokenY,
      amount,
      fee,
      tickSpacing,
      lowerTick,
      upperTick,
      liquidity,
      1n,
      slippageLimit,
      slippageLimit
    )

    const swapper = await getSigner(ONE_ALPH * 1000n, 0)
    const swapAmount = 1000n
    await withdrawTokens(swapper, [tokenX, swapAmount], [tokenY, swapAmount])

    const swapperTokenXBalanceBefore = await balanceOf(tokenX.contractId, swapper.address)
    const invariantTokenXBalanceBefore = await balanceOf(tokenX.contractId, invariant.address)
    const invariantTokenYBalanceBefore = await balanceOf(tokenY.contractId, invariant.address)

    expect(swapperTokenXBalanceBefore).toBe(swapAmount)
    expect(invariantTokenXBalanceBefore).toBe(500n)
    expect(invariantTokenYBalanceBefore).toBe(1000n)

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

    const swapperTokenXBalanceAfter = await balanceOf(tokenX.contractId, swapper.address)
    expect(swapperTokenXBalanceAfter).toBe(0n)

    expectError(
      InvariantError.PositionDoesNotExist,
      invariant,
      ClaimFee.execute(swapper, {
        initialFields: {
          invariant: invariant.contractId,
          index: 1n
        },
        attoAlphAmount: DUST_AMOUNT
      })
    )
  })
})
