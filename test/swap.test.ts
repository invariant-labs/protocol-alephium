import { DUST_AMOUNT, ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import {
  AddFeeTier,
  CreatePool,
  IncreasePositionLiquidity,
  InitializeEmptyPosition,
  Swap,
  Withdraw
} from '../artifacts/ts'
import {
  balanceOf,
  decodePool,
  decodePosition,
  decodeTick,
  deployInvariant,
  deployTokenFaucet,
  MAP_ENTRY_DEPOSIT
} from '../src/utils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let sender: PrivateKeyWallet

describe('swap tests', () => {
  const protocolFee = 10n ** 10n
  const fee = 6n * 10n ** 9n
  const tickSpacing = 10n

  beforeAll(async () => {
    sender = await getSigner(ONE_ALPH * 1000n, 0)
  })

  test('swap x to y', async () => {
    const liquidityDelta = 1000000n * 10n ** 5n
    const lowerTickIndex = -20n
    const upperTickIndex = 10n

    const amount = 1000000n + 1000n

    const token0 = await deployTokenFaucet(sender, '', '', amount, amount)
    const token1 = await deployTokenFaucet(sender, '', '', amount, amount)

    const [tokenX, tokenY] =
      token0.contractInstance.contractId < token1.contractInstance.contractId
        ? [token0, token1]
        : [token1, token0]

    await Withdraw.execute(sender, {
      initialFields: {
        token: token0.contractInstance.contractId,
        amount: 1000000n
      },
      attoAlphAmount: DUST_AMOUNT * 2n
    })
    await Withdraw.execute(sender, {
      initialFields: {
        token: token1.contractInstance.contractId,
        amount: 1000000n
      },
      attoAlphAmount: DUST_AMOUNT * 2n
    })

    const invariant = await deployInvariant(sender, protocolFee)

    await AddFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: fee,
        tickSpacing: tickSpacing
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT
    })

    await CreatePool.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        fee: fee,
        tickSpacing: tickSpacing,
        initSqrtPrice: 1000000000000000000000000n,
        initTick: 0n
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT * 2n
    })
    await InitializeEmptyPosition.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        fee: fee,
        tickSpacing: tickSpacing,
        lowerTick: lowerTickIndex,
        upperTick: upperTickIndex
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT * 6n
    })
    await IncreasePositionLiquidity.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        approvedTokens0: 1000000n,
        approvedTokens1: 1000000n,
        index: 1n,
        fee: fee,
        tickSpacing: tickSpacing,
        lowerTick: lowerTickIndex,
        upperTick: upperTickIndex,
        liquidityDelta: liquidityDelta,
        slippageLimitLower: 1000000000000000000000000n,
        slippageLimitUpper: 1000000000000000000000000n
      },
      tokens: [
        { id: token0.contractInstance.contractId, amount: 1000000n },
        { id: token1.contractInstance.contractId, amount: 1000000n }
      ]
    })
    const position = await invariant.methods.getPosition({
      args: { owner: sender.address, index: 1n }
    })
    const parsedPosition = decodePosition(position.returns)
    expect(parsedPosition.exist).toBe(true)
    expect(parsedPosition.liquidity).toBe(liquidityDelta)
    expect(parsedPosition.lowerTickIndex).toBe(lowerTickIndex)
    expect(parsedPosition.upperTickIndex).toBe(upperTickIndex)
    expect(parsedPosition.feeGrowthInsideX).toBe(0n)
    expect(parsedPosition.feeGrowthInsideY).toBe(0n)
    expect(parsedPosition.lastBlockNumber).toBeGreaterThan(0n)
    expect(parsedPosition.tokensOwedX).toBe(0n)
    expect(parsedPosition.tokensOwedY).toBe(0n)
    const lowerTick = await invariant.methods.getTick({
      args: {
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        fee: fee,
        tickSpacing: tickSpacing,
        index: lowerTickIndex
      }
    })
    const parsedLowerTick = decodeTick(lowerTick.returns)
    expect(parsedLowerTick.exist).toBe(true)
    expect(parsedLowerTick.sign).toBe(true)
    expect(parsedLowerTick.liquidityChange).toBe(liquidityDelta)
    expect(parsedLowerTick.liquidityGross).toBe(liquidityDelta)
    expect(parsedLowerTick.sqrtPrice).toBe(999000549780000000000000n)
    expect(parsedLowerTick.feeGrowthOutsideX).toBe(0n)
    expect(parsedLowerTick.feeGrowthOutsideY).toBe(0n)
    expect(parsedLowerTick.secondsOutside).toBe(0n)
    const upperTick = await invariant.methods.getTick({
      args: {
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        fee: fee,
        tickSpacing: tickSpacing,
        index: upperTickIndex
      }
    })
    const parsedUpperTick = decodeTick(upperTick.returns)
    expect(parsedUpperTick.exist).toBe(true)
    expect(parsedUpperTick.sign).toBe(false)
    expect(parsedUpperTick.liquidityChange).toBe(liquidityDelta)
    expect(parsedUpperTick.liquidityGross).toBe(liquidityDelta)
    expect(parsedUpperTick.sqrtPrice).toBe(1000500100010000000000000n)
    expect(parsedUpperTick.feeGrowthOutsideX).toBe(0n)
    expect(parsedUpperTick.feeGrowthOutsideY).toBe(0n)
    expect(parsedUpperTick.secondsOutside).toBe(0n)

    {
      const swapper = await getSigner(ONE_ALPH * 1000n, 0)
      const swapAmount = 1000n

      await Withdraw.execute(swapper, {
        initialFields: {
          token: tokenX.contractInstance.contractId,
          amount: swapAmount
        },
        attoAlphAmount: DUST_AMOUNT * 2n
      })

      await Withdraw.execute(swapper, {
        initialFields: {
          token: tokenY.contractInstance.contractId,
          amount: swapAmount
        },
        attoAlphAmount: DUST_AMOUNT * 2n
      })

      const swapperTokenXBalanceBefore = await balanceOf(
        tokenX.contractInstance.contractId,
        swapper.address
      )
      const invariantTokenXBalanceBefore = await balanceOf(
        tokenX.contractInstance.contractId,
        invariant.address
      )
      const invariantTokenYBalanceBefore = await balanceOf(
        tokenY.contractInstance.contractId,
        invariant.address
      )

      expect(swapperTokenXBalanceBefore).toBe(swapAmount)
      expect(invariantTokenXBalanceBefore).toBe(500n)
      expect(invariantTokenYBalanceBefore).toBe(1000n)

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

      const slippage = 15258932000000000000n

      const { amountIn, amountOut, targetSqrtPrice } = (
        await invariant.methods.quote({
          args: {
            token0: tokenX.contractInstance.contractId,
            token1: tokenY.contractInstance.contractId,
            fee: fee,
            tickSpacing: tickSpacing,
            xToY: true,
            amount: swapAmount,
            byAmountIn: true,
            sqrtPriceLimit: slippage
          }
        })
      ).returns

      expect(amountIn).toBe(swapAmount)
      expect(amountOut).toBe(993n)
      expect(targetSqrtPrice).toBe(999006987054867461743028n)

      await Swap.execute(swapper, {
        initialFields: {
          invariant: invariant.contractId,
          token0: tokenX.contractInstance.contractId,
          token1: tokenY.contractInstance.contractId,
          fee: fee,
          tickSpacing: tickSpacing,
          xToY: true,
          amount: swapAmount,
          byAmountIn: true,
          sqrtPriceLimit: slippage
        },
        tokens: [
          { id: tokenX.contractInstance.contractId, amount: swapAmount },
          { id: tokenY.contractInstance.contractId, amount: swapAmount }
        ]
      })

      const swapperTokenXBalanceAfter = await balanceOf(
        tokenX.contractInstance.contractId,
        swapper.address
      )
      const swapperTokenYBalanceAfter = await balanceOf(
        tokenY.contractInstance.contractId,
        swapper.address
      )
      const invariantTokenXBalanceAfter = await balanceOf(
        tokenX.contractInstance.contractId,
        invariant.address
      )
      const invariantTokenYBalanceAfter = await balanceOf(
        tokenY.contractInstance.contractId,
        invariant.address
      )

      expect(swapperTokenXBalanceAfter).toBe(0n)
      expect(swapperTokenYBalanceAfter).toBe(1993n)
      expect(invariantTokenXBalanceAfter).toBe(1500n)
      expect(invariantTokenYBalanceAfter).toBe(7n)

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

      expect(poolAfter.liquidity).toBe(poolBefore.liquidity)
      expect(poolAfter.currentTickIndex).toBe(-20n)
      expect(poolAfter.sqrtPrice).toBe(999006987054867461743028n)
      expect(poolAfter.feeGrowthGlobalX).toBe(50000000000000000000000n)
      expect(poolAfter.feeGrowthGlobalY).toBe(0n)
      expect(poolAfter.feeProtocolTokenX).toBe(1n)
      expect(poolAfter.feeProtocolTokenY).toBe(0n)
    }
  })

  test('swap y to x', async () => {
    const liquidityDelta = 1000000n * 10n ** 5n
    const lowerTickIndex = -10n
    const middleTickIndex = 10n
    const upperTickIndex = 20n

    const amount = 20000000000000n
    const token0 = await deployTokenFaucet(sender, '', '', amount, amount)
    await Withdraw.execute(sender, {
      initialFields: {
        token: token0.contractInstance.contractId,
        amount: 10000000000000n
      },
      attoAlphAmount: DUST_AMOUNT * 2n
    })
    const token1 = await deployTokenFaucet(sender, '', '', amount, amount)
    await Withdraw.execute(sender, {
      initialFields: {
        token: token1.contractInstance.contractId,
        amount: 10000000000000n
      },
      attoAlphAmount: DUST_AMOUNT * 2n
    })

    const [tokenX, tokenY] =
      token0.contractInstance.contractId < token1.contractInstance.contractId
        ? [token0, token1]
        : [token1, token0]

    const invariant = await deployInvariant(sender, protocolFee)

    await AddFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: fee,
        tickSpacing: tickSpacing
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT
    })

    await CreatePool.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        fee: fee,
        tickSpacing: tickSpacing,
        initSqrtPrice: 1000000000000000000000000n,
        initTick: 0n
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT * 2n
    })
    await InitializeEmptyPosition.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        fee: fee,
        tickSpacing: tickSpacing,
        lowerTick: lowerTickIndex,
        upperTick: upperTickIndex
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT * 6n
    })
    {
      const senderBalance0 = await balanceOf(token0.contractInstance.contractId, sender.address)
      const senderBalance1 = await balanceOf(token1.contractInstance.contractId, sender.address)

      await IncreasePositionLiquidity.execute(sender, {
        initialFields: {
          invariant: invariant.contractId,
          token0: token0.contractInstance.contractId,
          token1: token1.contractInstance.contractId,
          approvedTokens0: senderBalance0,
          approvedTokens1: senderBalance1,
          index: 1n,
          fee: fee,
          tickSpacing: tickSpacing,
          lowerTick: lowerTickIndex,
          upperTick: upperTickIndex,
          liquidityDelta: liquidityDelta,
          slippageLimitLower: 1000000000000000000000000n,
          slippageLimitUpper: 1000000000000000000000000n
        },
        tokens: [
          { id: token0.contractInstance.contractId, amount: senderBalance0 },
          { id: token1.contractInstance.contractId, amount: senderBalance1 }
        ]
      })
    }
    await InitializeEmptyPosition.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        fee: fee,
        tickSpacing: tickSpacing,
        lowerTick: middleTickIndex,
        upperTick: upperTickIndex + 20n
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT * 6n
    })
    {
      const senderBalance0 = await balanceOf(token0.contractInstance.contractId, sender.address)
      const senderBalance1 = await balanceOf(token1.contractInstance.contractId, sender.address)

      await IncreasePositionLiquidity.execute(sender, {
        initialFields: {
          invariant: invariant.contractId,
          token0: token0.contractInstance.contractId,
          token1: token1.contractInstance.contractId,
          approvedTokens0: senderBalance0,
          approvedTokens1: senderBalance1,
          index: 2n,
          fee: fee,
          tickSpacing: tickSpacing,
          lowerTick: middleTickIndex,
          upperTick: upperTickIndex + 20n,
          liquidityDelta: liquidityDelta,
          slippageLimitLower: 1000000000000000000000000n,
          slippageLimitUpper: 1000000000000000000000000n
        },
        tokens: [
          { id: token0.contractInstance.contractId, amount: senderBalance0 },
          { id: token1.contractInstance.contractId, amount: senderBalance1 }
        ]
      })
    }
    {
      const swapper = await getSigner(ONE_ALPH * 1000n, 0)
      const swapAmount = 1000n

      await Withdraw.execute(swapper, {
        initialFields: {
          token: tokenX.contractInstance.contractId,
          amount: swapAmount
        },
        attoAlphAmount: DUST_AMOUNT * 2n
      })

      await Withdraw.execute(swapper, {
        initialFields: {
          token: tokenY.contractInstance.contractId,
          amount: swapAmount
        },
        attoAlphAmount: DUST_AMOUNT * 2n
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

      const slippage = 65535383934512647000000000000n

      const { amountIn, amountOut, targetSqrtPrice } = (
        await invariant.methods.quote({
          args: {
            token0: token0.contractInstance.contractId,
            token1: token1.contractInstance.contractId,
            fee: fee,
            tickSpacing: tickSpacing,
            xToY: false,
            amount: swapAmount,
            byAmountIn: true,
            sqrtPriceLimit: slippage
          }
        })
      ).returns

      expect(amountIn).toBe(swapAmount)
      expect(amountOut).toBe(990n)
      expect(targetSqrtPrice).toBe(1000746100010000000000000n)

      await Swap.execute(swapper, {
        initialFields: {
          invariant: invariant.contractId,
          token0: token0.contractInstance.contractId,
          token1: token1.contractInstance.contractId,
          fee: fee,
          tickSpacing: tickSpacing,
          xToY: false,
          amount: swapAmount,
          byAmountIn: true,
          sqrtPriceLimit: slippage
        },
        tokens: [
          { id: tokenX.contractInstance.contractId, amount: swapAmount },
          { id: tokenY.contractInstance.contractId, amount: swapAmount }
        ]
      })

      const swapperTokenXBalanceAfter = await balanceOf(
        tokenX.contractInstance.contractId,
        swapper.address
      )
      const swapperTokenYBalanceAfter = await balanceOf(
        tokenY.contractInstance.contractId,
        swapper.address
      )
      const invariantTokenXBalanceAfter = await balanceOf(
        tokenX.contractInstance.contractId,
        invariant.address
      )
      const invariantTokenYBalanceAfter = await balanceOf(
        tokenY.contractInstance.contractId,
        invariant.address
      )

      expect(swapperTokenXBalanceAfter).toBe(1990n)
      expect(swapperTokenYBalanceAfter).toBe(0n)
      expect(invariantTokenXBalanceAfter).toBe(1509n)
      expect(invariantTokenYBalanceAfter).toBe(1500n)

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
      expect(poolAfter.liquidity - liquidityDelta).toBe(poolBefore.liquidity)
      expect(poolAfter.currentTickIndex).toBe(10n)
      expect(poolAfter.sqrtPrice).toBe(1000746100010000000000000n)
      expect(poolAfter.feeGrowthGlobalX).toBe(0n)
      expect(poolAfter.feeGrowthGlobalY).toBe(40000000000000000000000n)
      expect(poolAfter.feeProtocolTokenX).toBe(0n)
      expect(poolAfter.feeProtocolTokenY).toBe(2n)

      const lowerTick = await invariant.methods.getTick({
        args: {
          token0: token0.contractInstance.contractId,
          token1: token1.contractInstance.contractId,
          fee: fee,
          tickSpacing: tickSpacing,
          index: lowerTickIndex
        }
      })
      const parsedLowerTick = decodeTick(lowerTick.returns)
      expect(parsedLowerTick.exist).toBe(true)
      expect(parsedLowerTick.liquidityChange).toBe(liquidityDelta)
      expect(parsedLowerTick.feeGrowthOutsideY).toBe(0n)
      const middleTick = await invariant.methods.getTick({
        args: {
          token0: token0.contractInstance.contractId,
          token1: token1.contractInstance.contractId,
          fee: fee,
          tickSpacing: tickSpacing,
          index: middleTickIndex
        }
      })
      const parsedMiddleTick = decodeTick(middleTick.returns)
      expect(parsedMiddleTick.exist).toBe(true)
      expect(parsedMiddleTick.liquidityChange).toBe(liquidityDelta)
      expect(parsedMiddleTick.feeGrowthOutsideY).toBe(30000000000000000000000n)

      const upperTick = await invariant.methods.getTick({
        args: {
          token0: token0.contractInstance.contractId,
          token1: token1.contractInstance.contractId,
          fee: fee,
          tickSpacing: tickSpacing,
          index: upperTickIndex
        }
      })
      const parsedUpperTick = decodeTick(upperTick.returns)
      expect(parsedUpperTick.exist).toBe(true)
      expect(parsedUpperTick.liquidityChange).toBe(liquidityDelta)
      expect(parsedUpperTick.feeGrowthOutsideY).toBe(0n)

      const isLowerTickInitialized = (
        await invariant.methods.isTickInitialized({
          args: {
            token0: token0.contractInstance.contractId,
            token1: token1.contractInstance.contractId,
            fee: fee,
            tickSpacing: tickSpacing,
            index: lowerTickIndex
          }
        })
      ).returns
      expect(isLowerTickInitialized).toBe(true)

      const isMiddleTickInitialized = (
        await invariant.methods.isTickInitialized({
          args: {
            token0: token0.contractInstance.contractId,
            token1: token1.contractInstance.contractId,
            fee: fee,
            tickSpacing: tickSpacing,
            index: middleTickIndex
          }
        })
      ).returns
      expect(isMiddleTickInitialized).toBe(true)

      const isUpperTickInitialized = (
        await invariant.methods.isTickInitialized({
          args: {
            token0: token0.contractInstance.contractId,
            token1: token1.contractInstance.contractId,
            fee: fee,
            tickSpacing: tickSpacing,
            index: upperTickIndex
          }
        })
      ).returns
      expect(isUpperTickInitialized).toBe(true)
    }
  })

  test('crossing tick swap x to y', async () => {
    const amount = 1000000n + 1000n
    const token0 = await deployTokenFaucet(sender, '', '', amount, amount)
    await Withdraw.execute(sender, {
      initialFields: {
        token: token0.contractInstance.contractId,
        amount: 1000000n
      },
      attoAlphAmount: DUST_AMOUNT * 2n
    })
    const token1 = await deployTokenFaucet(sender, '', '', amount, amount)
    await Withdraw.execute(sender, {
      initialFields: {
        token: token1.contractInstance.contractId,
        amount: 1000000n
      },
      attoAlphAmount: DUST_AMOUNT * 2n
    })

    const [tokenX, tokenY] =
      token0.contractInstance.contractId < token1.contractInstance.contractId
        ? [token0, token1]
        : [token1, token0]

    const invariant = await deployInvariant(sender, protocolFee)

    await AddFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: fee,
        tickSpacing: tickSpacing
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT
    })

    await CreatePool.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        fee: fee,
        tickSpacing: tickSpacing,
        initSqrtPrice: 1000000000000000000000000n,
        initTick: 0n
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT * 2n
    })

    {
      const liquidityDelta = 1000000n * 10n ** 5n
      const lowerTickIndex = -20n
      const upperTickIndex = 10n

      await InitializeEmptyPosition.execute(sender, {
        initialFields: {
          invariant: invariant.contractId,
          token0: token0.contractInstance.contractId,
          token1: token1.contractInstance.contractId,
          fee: fee,
          tickSpacing: tickSpacing,
          lowerTick: lowerTickIndex,
          upperTick: upperTickIndex
        },
        attoAlphAmount: MAP_ENTRY_DEPOSIT * 6n
      })
      {
        const senderBalance0 = await balanceOf(token0.contractInstance.contractId, sender.address)
        const senderBalance1 = await balanceOf(token1.contractInstance.contractId, sender.address)

        await IncreasePositionLiquidity.execute(sender, {
          initialFields: {
            invariant: invariant.contractId,
            token0: token0.contractInstance.contractId,
            token1: token1.contractInstance.contractId,
            approvedTokens0: senderBalance0,
            approvedTokens1: senderBalance1,
            index: 1n,
            fee: fee,
            tickSpacing: tickSpacing,
            lowerTick: lowerTickIndex,
            upperTick: upperTickIndex,
            liquidityDelta: liquidityDelta,
            slippageLimitLower: 1000000000000000000000000n,
            slippageLimitUpper: 1000000000000000000000000n
          },
          tokens: [
            { id: token0.contractInstance.contractId, amount: senderBalance0 },
            { id: token1.contractInstance.contractId, amount: senderBalance1 }
          ]
        })
      }
      const position = await invariant.methods.getPosition({
        args: { owner: sender.address, index: 1n }
      })
      const parsedPosition = decodePosition(position.returns)
      expect(parsedPosition.exist).toBe(true)
      expect(parsedPosition.liquidity).toBe(liquidityDelta)
      expect(parsedPosition.lowerTickIndex).toBe(lowerTickIndex)
      expect(parsedPosition.upperTickIndex).toBe(upperTickIndex)
      expect(parsedPosition.feeGrowthInsideX).toBe(0n)
      expect(parsedPosition.feeGrowthInsideY).toBe(0n)
      expect(parsedPosition.lastBlockNumber).toBeGreaterThan(0n)
      expect(parsedPosition.tokensOwedX).toBe(0n)
      expect(parsedPosition.tokensOwedY).toBe(0n)
      const lowerTick = await invariant.methods.getTick({
        args: {
          token0: token0.contractInstance.contractId,
          token1: token1.contractInstance.contractId,
          fee: fee,
          tickSpacing: tickSpacing,
          index: lowerTickIndex
        }
      })
      const parsedLowerTick = decodeTick(lowerTick.returns)
      expect(parsedLowerTick.exist).toBe(true)
      expect(parsedLowerTick.sign).toBe(true)
      expect(parsedLowerTick.liquidityChange).toBe(liquidityDelta)
      expect(parsedLowerTick.liquidityGross).toBe(liquidityDelta)
      expect(parsedLowerTick.sqrtPrice).toBe(999000549780000000000000n)
      expect(parsedLowerTick.feeGrowthOutsideX).toBe(0n)
      expect(parsedLowerTick.feeGrowthOutsideY).toBe(0n)
      expect(parsedLowerTick.secondsOutside).toBe(0n)
      const upperTick = await invariant.methods.getTick({
        args: {
          token0: token0.contractInstance.contractId,
          token1: token1.contractInstance.contractId,
          fee: fee,
          tickSpacing: tickSpacing,
          index: upperTickIndex
        }
      })
      const parsedUpperTick = decodeTick(upperTick.returns)
      expect(parsedUpperTick.exist).toBe(true)
      expect(parsedUpperTick.sign).toBe(false)
      expect(parsedUpperTick.liquidityChange).toBe(liquidityDelta)
      expect(parsedUpperTick.liquidityGross).toBe(liquidityDelta)
      expect(parsedUpperTick.sqrtPrice).toBe(1000500100010000000000000n)
      expect(parsedUpperTick.feeGrowthOutsideX).toBe(0n)
      expect(parsedUpperTick.feeGrowthOutsideY).toBe(0n)
      expect(parsedUpperTick.secondsOutside).toBe(0n)
    }

    {
      const liquidityDelta = 1000000n * 10n ** 5n
      const lowerTickIndex = -40n
      const upperTickIndex = -10n
      const index = 2n

      await InitializeEmptyPosition.execute(sender, {
        initialFields: {
          invariant: invariant.contractId,
          token0: token0.contractInstance.contractId,
          token1: token1.contractInstance.contractId,
          fee: fee,
          tickSpacing: tickSpacing,
          lowerTick: lowerTickIndex,
          upperTick: upperTickIndex
        },
        attoAlphAmount: MAP_ENTRY_DEPOSIT * 6n
      })
      {
        const senderBalance0 = await balanceOf(token0.contractInstance.contractId, sender.address)
        const senderBalance1 = await balanceOf(token1.contractInstance.contractId, sender.address)

        await IncreasePositionLiquidity.execute(sender, {
          initialFields: {
            invariant: invariant.contractId,
            token0: token0.contractInstance.contractId,
            token1: token1.contractInstance.contractId,
            approvedTokens0: senderBalance0,
            approvedTokens1: senderBalance1,
            index,
            fee: fee,
            tickSpacing: tickSpacing,
            lowerTick: lowerTickIndex,
            upperTick: upperTickIndex,
            liquidityDelta: liquidityDelta,
            slippageLimitLower: 1000000000000000000000000n,
            slippageLimitUpper: 1000000000000000000000000n
          },
          tokens: [
            { id: token0.contractInstance.contractId, amount: senderBalance0 },
            { id: token1.contractInstance.contractId, amount: senderBalance1 }
          ]
        })
      }
      const position = await invariant.methods.getPosition({
        args: { owner: sender.address, index: 2n }
      })
      const parsedPosition = decodePosition(position.returns)
      expect(parsedPosition.exist).toBe(true)
      expect(parsedPosition.liquidity).toBe(liquidityDelta)
      expect(parsedPosition.lowerTickIndex).toBe(lowerTickIndex)
      expect(parsedPosition.upperTickIndex).toBe(upperTickIndex)
      expect(parsedPosition.feeGrowthInsideX).toBe(0n)
      expect(parsedPosition.feeGrowthInsideY).toBe(0n)
      expect(parsedPosition.lastBlockNumber).toBeGreaterThan(0n)
      expect(parsedPosition.tokensOwedX).toBe(0n)
      expect(parsedPosition.tokensOwedY).toBe(0n)

      const lowerTick = await invariant.methods.getTick({
        args: {
          token0: token0.contractInstance.contractId,
          token1: token1.contractInstance.contractId,
          fee: fee,
          tickSpacing: tickSpacing,
          index: lowerTickIndex
        }
      })

      const parsedLowerTick = decodeTick(lowerTick.returns)
      expect(parsedLowerTick.exist).toBe(true)
      expect(parsedLowerTick.sign).toBe(true)
      expect(parsedLowerTick.liquidityChange).toBe(liquidityDelta)
      expect(parsedLowerTick.liquidityGross).toBe(liquidityDelta)
      expect(parsedLowerTick.sqrtPrice).toBe(998002098461000000000000n)
      expect(parsedLowerTick.feeGrowthOutsideX).toBe(0n)
      expect(parsedLowerTick.feeGrowthOutsideY).toBe(0n)
      expect(parsedLowerTick.secondsOutside).toBe(0n)
      const upperTick = await invariant.methods.getTick({
        args: {
          token0: token0.contractInstance.contractId,
          token1: token1.contractInstance.contractId,
          fee: fee,
          tickSpacing: tickSpacing,
          index: upperTickIndex
        }
      })
      const parsedUpperTick = decodeTick(upperTick.returns)
      expect(parsedUpperTick.exist).toBe(true)
      expect(parsedUpperTick.sign).toBe(false)
      expect(parsedUpperTick.liquidityChange).toBe(liquidityDelta)
      expect(parsedUpperTick.liquidityGross).toBe(liquidityDelta)
      expect(parsedUpperTick.sqrtPrice).toBe(999500149965000000000000n)
      expect(parsedUpperTick.feeGrowthOutsideX).toBe(0n)
      expect(parsedUpperTick.feeGrowthOutsideY).toBe(0n)
      expect(parsedUpperTick.secondsOutside).toBe(0n)
    }

    {
      const swapper = await getSigner(ONE_ALPH * 1000n, 0)
      const swapAmount = 1000n

      await Withdraw.execute(swapper, {
        initialFields: {
          token: tokenX.contractInstance.contractId,
          amount: swapAmount
        },
        attoAlphAmount: DUST_AMOUNT * 2n
      })

      await Withdraw.execute(swapper, {
        initialFields: {
          token: tokenY.contractInstance.contractId,
          amount: swapAmount
        },
        attoAlphAmount: DUST_AMOUNT * 2n
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

      const slippage = 15258932000000000000n

      const { amountIn, amountOut, targetSqrtPrice } = (
        await invariant.methods.quote({
          args: {
            token0: token0.contractInstance.contractId,
            token1: token1.contractInstance.contractId,
            fee: fee,
            tickSpacing: tickSpacing,
            xToY: true,
            amount: swapAmount,
            byAmountIn: true,
            sqrtPriceLimit: slippage
          }
        })
      ).returns

      expect(amountIn).toBe(swapAmount)
      expect(amountOut).toBe(990n)
      expect(targetSqrtPrice).toBe(999254456240199142700995n)

      await Swap.execute(swapper, {
        initialFields: {
          invariant: invariant.contractId,
          token0: token0.contractInstance.contractId,
          token1: token1.contractInstance.contractId,
          fee: fee,
          tickSpacing: tickSpacing,
          xToY: true,
          amount: swapAmount,
          byAmountIn: true,
          sqrtPriceLimit: slippage
        },
        tokens: [
          { id: tokenX.contractInstance.contractId, amount: swapAmount },
          { id: tokenY.contractInstance.contractId, amount: swapAmount }
        ]
      })

      const swapperTokenXBalanceAfter = await balanceOf(
        tokenX.contractInstance.contractId,
        swapper.address
      )
      const swapperTokenYBalanceAfter = await balanceOf(
        tokenY.contractInstance.contractId,
        swapper.address
      )
      const invariantTokenXBalanceAfter = await balanceOf(
        tokenX.contractInstance.contractId,
        invariant.address
      )
      const invariantTokenYBalanceAfter = await balanceOf(
        tokenY.contractInstance.contractId,
        invariant.address
      )

      expect(swapperTokenXBalanceAfter).toBe(0n)
      expect(swapperTokenYBalanceAfter).toBe(1990n)
      expect(invariantTokenXBalanceAfter).toBe(1500n)
      expect(invariantTokenYBalanceAfter).toBe(1509n)

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

      const positionLiquidity = 1000000n * 10n ** 5n
      expect(poolAfter.liquidity - positionLiquidity).toBe(poolBefore.liquidity)
      expect(poolAfter.currentTickIndex).toBe(-20n)
      expect(poolAfter.sqrtPrice).toBe(999254456240199142700995n)
      expect(poolAfter.feeGrowthGlobalX).toBe(40000000000000000000000n)
      expect(poolAfter.feeGrowthGlobalY).toBe(0n)
      expect(poolAfter.feeProtocolTokenX).toBe(2n)
      expect(poolAfter.feeProtocolTokenY).toBe(0n)
    }
  })
})
