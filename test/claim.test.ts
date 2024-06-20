import { DUST_AMOUNT, ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { AddFeeTier, ClaimFee, CreatePool, IncreasePositionLiquidity, InitializeEmptyPosition, Swap, Withdraw } from '../artifacts/ts'
import { balanceOf, decodePool, decodePosition, deployInvariant, deployTokenFaucet, expectError, MAP_ENTRY_DEPOSIT } from '../src/utils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let admin: PrivateKeyWallet
let positionOwner: PrivateKeyWallet

const PercentageScale = 12n

describe('invariant tests', () => {
  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
    positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
  })

  test('claim', async () => {
    // init dex and tokens
    // 1%
    const protocol_fee = 10n ** (PercentageScale - 2n)
    const invariant = await deployInvariant(admin, protocol_fee)

    // 0.6%
    const fee = 6n * 10n ** (PercentageScale - 3n)
    const tickSpacing = 10n
    await AddFeeTier.execute(admin, {
      initialFields: {
        invariant: invariant.contractId,
        fee,
        tickSpacing
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT
    })

    let supply = 10n ** 6n + 1000n
    let amount = 10n ** 6n
    const token0 = await deployTokenFaucet(admin, 'X', 'X', supply, supply)
    const token1 = await deployTokenFaucet(admin, 'Y', 'Y', supply, supply)

    // init basic pool
    await CreatePool.execute(positionOwner, {
      initialFields: {
        invariant: invariant.contractId,
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        fee,
        tickSpacing,
        initSqrtPrice: 10n ** 24n,
        initTick: 0n
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT * 2n
    })

    // init basic position

    await Withdraw.execute(positionOwner, {
      initialFields: {
        token: token0.contractInstance.contractId,
        amount
      },
      attoAlphAmount: DUST_AMOUNT
    })

    await Withdraw.execute(positionOwner, {
      initialFields: {
        token: token1.contractInstance.contractId,
        amount
      },
      attoAlphAmount: DUST_AMOUNT
    })

    const poolBefore = decodePool(
      (
        await invariant.methods.getPool({
          args: {
            token0: token0.contractInstance.contractId,
            token1: token1.contractInstance.contractId,
            fee: fee,
            tickSpacing: tickSpacing
          }
        })
      ).returns
    )

    const lowerTick = -20n
    const upperTick = 10n
    const liquidity = 1000000n * 10n ** 5n
    const slippageLimit = poolBefore.sqrtPrice

    await InitializeEmptyPosition.execute(positionOwner, {
      initialFields: {
        invariant: invariant.contractId,
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        fee,
        tickSpacing,
        lowerTick,
        upperTick,
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT * 6n
    })

    await IncreasePositionLiquidity.execute(positionOwner, {
      initialFields: {
        invariant: invariant.contractId,
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        approvedTokens0: amount,
        approvedTokens1: amount,
        index: 1n,
        fee,
        tickSpacing,
        lowerTick: lowerTick,
        upperTick: upperTick,
        liquidityDelta: liquidity,
        slippageLimitLower: slippageLimit,
        slippageLimitUpper: slippageLimit
      },
      tokens: [
        { id: token0.contractInstance.contractId, amount },
        { id: token1.contractInstance.contractId, amount }
      ]
    })

    // init basic swap
    {
      const [tokenX, tokenY] =
        token0.contractInstance.contractId < token1.contractInstance.contractId ? [token0, token1] : [token1, token0]

      const swapper = await getSigner(ONE_ALPH * 1000n, 0)
      const swapAmount = 1000n

      await Withdraw.execute(swapper, {
        initialFields: {
          token: tokenX.contractInstance.contractId,
          amount: swapAmount
        },
        attoAlphAmount: DUST_AMOUNT
      })

      await Withdraw.execute(swapper, {
        initialFields: {
          token: tokenY.contractInstance.contractId,
          amount: swapAmount
        },
        attoAlphAmount: DUST_AMOUNT
      })

      const swapperTokenXBalanceBefore = await balanceOf(tokenX.contractInstance.contractId, swapper.address)
      const invariantTokenXBalanceBefore = await balanceOf(tokenX.contractInstance.contractId, invariant.address)
      const invariantTokenYBalanceBefore = await balanceOf(tokenY.contractInstance.contractId, invariant.address)

      expect(swapperTokenXBalanceBefore).toBe(swapAmount)
      expect(invariantTokenXBalanceBefore).toBe(500n)
      expect(invariantTokenYBalanceBefore).toBe(1000n)

      await Swap.execute(swapper, {
        initialFields: {
          invariant: invariant.contractId,
          token0: tokenX.contractInstance.contractId,
          token1: tokenY.contractInstance.contractId,
          fee,
          tickSpacing,
          xToY: true,
          amount: swapAmount,
          byAmountIn: true,
          sqrtPriceLimit: 15258932000000000000n
        },
        tokens: [
          { id: tokenX.contractInstance.contractId, amount: swapAmount },
          { id: tokenY.contractInstance.contractId, amount: swapAmount }
        ]
      })

      const swapperTokenXBalanceAfter = await balanceOf(tokenX.contractInstance.contractId, swapper.address)
      expect(swapperTokenXBalanceAfter).toBe(0n)
    }

    const positionOwnerToken0BalanceBefore = await balanceOf(token0.contractInstance.contractId, positionOwner.address)
    const positionOwnerToken1BalanceBefore = await balanceOf(token1.contractInstance.contractId, positionOwner.address)
    const invariantToken0BalanceBefore = await balanceOf(token0.contractInstance.contractId, invariant.address)
    const invariantToken1BalanceBefore = await balanceOf(token1.contractInstance.contractId, invariant.address)

    await ClaimFee.execute(positionOwner, {
      initialFields: {
        invariant: invariant.contractId,
        index: 1n
      },
      attoAlphAmount: DUST_AMOUNT
    })

    const positionOwnerToken0BalanceAfter = await balanceOf(token0.contractInstance.contractId, positionOwner.address)
    const positionOwnerToken1BalanceAfter = await balanceOf(token1.contractInstance.contractId, positionOwner.address)
    const invariantToken0BalanceAfter = await balanceOf(token0.contractInstance.contractId, invariant.address)
    const invariantToken1BalanceAfter = await balanceOf(token1.contractInstance.contractId, invariant.address)
    const expectedTokensClaimed = 5n

    // balance of the token we claimed changed
    expect(positionOwnerToken0BalanceAfter - expectedTokensClaimed).toBe(positionOwnerToken0BalanceBefore)
    expect(invariantToken0BalanceAfter + expectedTokensClaimed).toBe(invariantToken0BalanceBefore)

    // and the other one's not
    expect(invariantToken1BalanceAfter).toBe(invariantToken1BalanceBefore)
    expect(positionOwnerToken1BalanceAfter).toBe(positionOwnerToken1BalanceBefore)

    const poolAfter = decodePool(
      (
        await invariant.methods.getPool({
          args: {
            token0: token0.contractInstance.contractId,
            token1: token1.contractInstance.contractId,
            fee: fee,
            tickSpacing: tickSpacing
          }
        })
      ).returns
    )

    const positionAfter = decodePosition(
      (
        await invariant.methods.getPosition({
          args: {
            index: 1n
          }
        })
      ).returns
    )

    expect(positionAfter.feeGrowthInsideX).toBe(poolAfter.feeGrowthGlobalX)
    expect(positionAfter.tokensOwedX).toBe(0n)

  })

  test('claim_not_owner', async () => {
    // init dex and tokens
    // 1%
    const protocol_fee = 10n ** (PercentageScale - 2n)
    const invariant = await deployInvariant(admin, protocol_fee)

    // 0.6%
    const fee = 6n * 10n ** (PercentageScale - 3n)
    const tickSpacing = 10n
    await AddFeeTier.execute(admin, {
      initialFields: {
        invariant: invariant.contractId,
        fee,
        tickSpacing
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT
    })

    let supply = 10n ** 6n + 1000n
    let amount = 10n ** 6n
    const token0 = await deployTokenFaucet(admin, 'X', 'X', supply, supply)
    const token1 = await deployTokenFaucet(admin, 'Y', 'Y', supply, supply)

    // init basic pool
    await CreatePool.execute(positionOwner, {
      initialFields: {
        invariant: invariant.contractId,
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        fee,
        tickSpacing,
        initSqrtPrice: 10n ** 24n,
        initTick: 0n
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT * 2n
    })

    // init basic position

    await Withdraw.execute(positionOwner, {
      initialFields: {
        token: token0.contractInstance.contractId,
        amount
      },
      attoAlphAmount: DUST_AMOUNT
    })

    await Withdraw.execute(positionOwner, {
      initialFields: {
        token: token1.contractInstance.contractId,
        amount
      },
      attoAlphAmount: DUST_AMOUNT
    })

    const poolBefore = decodePool(
      (
        await invariant.methods.getPool({
          args: {
            token0: token0.contractInstance.contractId,
            token1: token1.contractInstance.contractId,
            fee: fee,
            tickSpacing: tickSpacing
          }
        })
      ).returns
    )

    const lowerTick = -20n
    const upperTick = 10n
    const liquidity = 1000000n * 10n ** 5n
    const slippageLimit = poolBefore.sqrtPrice

    await InitializeEmptyPosition.execute(positionOwner, {
      initialFields: {
        invariant: invariant.contractId,
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        fee,
        tickSpacing,
        lowerTick,
        upperTick,
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT * 6n
    })

    await IncreasePositionLiquidity.execute(positionOwner, {
      initialFields: {
        invariant: invariant.contractId,
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        approvedTokens0: amount,
        approvedTokens1: amount,
        index: 1n,
        fee,
        tickSpacing,
        lowerTick: lowerTick,
        upperTick: upperTick,
        liquidityDelta: liquidity,
        slippageLimitLower: slippageLimit,
        slippageLimitUpper: slippageLimit
      },
      tokens: [
        { id: token0.contractInstance.contractId, amount },
        { id: token1.contractInstance.contractId, amount }
      ]
    })

    // init basic swap
    {
      const [tokenX, tokenY] =
        token0.contractInstance.contractId < token1.contractInstance.contractId ? [token0, token1] : [token1, token0]

      const swapper = await getSigner(ONE_ALPH * 1000n, 0)
      const swapAmount = 1000n

      await Withdraw.execute(swapper, {
        initialFields: {
          token: tokenX.contractInstance.contractId,
          amount: swapAmount
        },
        attoAlphAmount: DUST_AMOUNT
      })

      await Withdraw.execute(swapper, {
        initialFields: {
          token: tokenY.contractInstance.contractId,
          amount: swapAmount
        },
        attoAlphAmount: DUST_AMOUNT
      })

      const swapperTokenXBalanceBefore = await balanceOf(tokenX.contractInstance.contractId, swapper.address)
      const invariantTokenXBalanceBefore = await balanceOf(tokenX.contractInstance.contractId, invariant.address)
      const invariantTokenYBalanceBefore = await balanceOf(tokenY.contractInstance.contractId, invariant.address)

      expect(swapperTokenXBalanceBefore).toBe(swapAmount)
      expect(invariantTokenXBalanceBefore).toBe(500n)
      expect(invariantTokenYBalanceBefore).toBe(1000n)

      await Swap.execute(swapper, {
        initialFields: {
          invariant: invariant.contractId,
          token0: tokenX.contractInstance.contractId,
          token1: tokenY.contractInstance.contractId,
          fee,
          tickSpacing,
          xToY: true,
          amount: swapAmount,
          byAmountIn: true,
          sqrtPriceLimit: 15258932000000000000n
        },
        tokens: [
          { id: tokenX.contractInstance.contractId, amount: swapAmount },
          { id: tokenY.contractInstance.contractId, amount: swapAmount }
        ]
      })

      const swapperTokenXBalanceAfter = await balanceOf(tokenX.contractInstance.contractId, swapper.address)
      expect(swapperTokenXBalanceAfter).toBe(0n)

      expectError(ClaimFee.execute(swapper, {
        initialFields: {
          invariant: invariant.contractId,
          index: 1n
        },
        attoAlphAmount: DUST_AMOUNT
      }))
    }
  })
})
