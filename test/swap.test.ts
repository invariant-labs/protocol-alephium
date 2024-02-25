import { DUST_AMOUNT, ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { AddFeeTier, CreatePool, CreatePosition, Init, InitPosition, Invariant, Swap, Withdraw } from '../artifacts/ts'
import { invariantDeployFee, testPrivateKeys } from '../src/consts'
import { decodePool, decodePosition, decodeTick, deployInvariant, deployTokenFaucet } from '../src/utils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let sender = new PrivateKeyWallet({ privateKey: testPrivateKeys[0] })

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

    const amount = 1000000n
    const token0 = await deployTokenFaucet(sender, '', '', amount, amount)
    await Withdraw.execute(sender, {
      initialFields: {
        token: token0.contractInstance.contractId,
        amount
      },
      attoAlphAmount: DUST_AMOUNT * 2n
    })
    const token1 = await deployTokenFaucet(sender, '', '', amount, amount)
    await Withdraw.execute(sender, {
      initialFields: {
        token: token1.contractInstance.contractId,
        amount
      },
      attoAlphAmount: DUST_AMOUNT * 2n
    })

    const invariantResult = await deployInvariant(sender, protocolFee)
    const invariant = Invariant.at(invariantResult.contractInstance.address)
    await Init.execute(sender, {
      initialFields: { invariant: invariant.contractId },
      attoAlphAmount: invariantDeployFee
    })
    await AddFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: fee,
        tickSpacing: tickSpacing
      },
      attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
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
      attoAlphAmount: ONE_ALPH * 2n + DUST_AMOUNT * 2n
    })
    await InitPosition.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        fee: fee,
        tickSpacing: tickSpacing,
        lowerTick: lowerTickIndex,
        upperTick: upperTickIndex
      },
      attoAlphAmount: ONE_ALPH * 6n + DUST_AMOUNT * 2n
    })
    await CreatePosition.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        token0Amount: amount,
        token1Amount: amount,
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
        { id: token0.contractInstance.contractId, amount },
        { id: token1.contractInstance.contractId, amount }
      ]
    })
    const position = await invariant.methods.getPosition({
      args: { index: 1n }
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
      const swapAmount = 1000n

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

      const [amountIn, amountOut, targetSqrtPrice] = (
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
      expect(amountOut).toBe(993n)
      expect(targetSqrtPrice).toBe(999006987054867461743028n)

      await Swap.execute(sender, {
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
        }
      })

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
      expect(poolAfter.currentSqrtPrice).toBe(999006987054867461743028n)
      expect(poolAfter.feeGrowthGlobalX).toBe(50000000000000000000000n)
      expect(poolAfter.feeGrowthGlobalY).toBe(0n)
      expect(poolAfter.feeProtocolTokenX).toBe(1n)
      expect(poolAfter.feeProtocolTokenY).toBe(0n)
    }
  }, 15000)

  test('swap y to x', async () => {
    const liquidityDelta = 1000000n * 10n ** 5n
    const lowerTickIndex = -10n
    const middleTickIndex = 10n
    const upperTickIndex = 20n

    const amount = 1000000n
    const token0 = await deployTokenFaucet(sender, '', '', amount, amount)
    await Withdraw.execute(sender, {
      initialFields: {
        token: token0.contractInstance.contractId,
        amount
      },
      attoAlphAmount: DUST_AMOUNT * 2n
    })
    const token1 = await deployTokenFaucet(sender, '', '', amount, amount)
    await Withdraw.execute(sender, {
      initialFields: {
        token: token1.contractInstance.contractId,
        amount
      },
      attoAlphAmount: DUST_AMOUNT * 2n
    })

    const invariantResult = await deployInvariant(sender, protocolFee)
    const invariant = Invariant.at(invariantResult.contractInstance.address)
    await Init.execute(sender, {
      initialFields: { invariant: invariant.contractId },
      attoAlphAmount: invariantDeployFee
    })
    await AddFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: fee,
        tickSpacing: tickSpacing
      },
      attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
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
      attoAlphAmount: ONE_ALPH * 2n + DUST_AMOUNT * 2n
    })
    await InitPosition.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        fee: fee,
        tickSpacing: tickSpacing,
        lowerTick: lowerTickIndex,
        upperTick: upperTickIndex
      },
      attoAlphAmount: ONE_ALPH * 6n + DUST_AMOUNT * 2n
    })
    await CreatePosition.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        token0Amount: amount,
        token1Amount: amount,
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
        { id: token0.contractInstance.contractId, amount },
        { id: token1.contractInstance.contractId, amount }
      ]
    })
    await InitPosition.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        fee: fee,
        tickSpacing: tickSpacing,
        lowerTick: middleTickIndex,
        upperTick: upperTickIndex + 20n
      },
      attoAlphAmount: ONE_ALPH * 6n + DUST_AMOUNT * 2n
    })
    await CreatePosition.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        token0Amount: amount / 2n,
        token1Amount: amount / 2n,
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
        { id: token0.contractInstance.contractId, amount: amount / 2n },
        { id: token1.contractInstance.contractId, amount: amount / 2n }
      ]
    })
    {
      const swapAmount = 1000n

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

      const [amountIn, amountOut, targetSqrtPrice] = (
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

      await Swap.execute(sender, {
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
        }
      })

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
      expect(poolAfter.currentSqrtPrice).toBe(1000746100010000000000000n)
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
  }, 15000)

  test('crossing tick swap x to y', async () => {
    const amount = 1000000n
    const token0 = await deployTokenFaucet(sender, '', '', amount, amount)
    await Withdraw.execute(sender, {
      initialFields: {
        token: token0.contractInstance.contractId,
        amount
      },
      attoAlphAmount: DUST_AMOUNT * 2n
    })
    const token1 = await deployTokenFaucet(sender, '', '', amount, amount)
    await Withdraw.execute(sender, {
      initialFields: {
        token: token1.contractInstance.contractId,
        amount
      },
      attoAlphAmount: DUST_AMOUNT * 2n
    })

    const invariantResult = await deployInvariant(sender, protocolFee)
    const invariant = Invariant.at(invariantResult.contractInstance.address)
    await Init.execute(sender, {
      initialFields: { invariant: invariant.contractId },
      attoAlphAmount: invariantDeployFee
    })
    await AddFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: fee,
        tickSpacing: tickSpacing
      },
      attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
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
      attoAlphAmount: ONE_ALPH * 2n + DUST_AMOUNT * 2n
    })

    {
      const liquidityDelta = 1000000n * 10n ** 5n
      const lowerTickIndex = -20n
      const upperTickIndex = 10n

      await InitPosition.execute(sender, {
        initialFields: {
          invariant: invariant.contractId,
          token0: token0.contractInstance.contractId,
          token1: token1.contractInstance.contractId,
          fee: fee,
          tickSpacing: tickSpacing,
          lowerTick: lowerTickIndex,
          upperTick: upperTickIndex
        },
        attoAlphAmount: ONE_ALPH * 6n + DUST_AMOUNT * 2n
      })
      await CreatePosition.execute(sender, {
        initialFields: {
          invariant: invariant.contractId,
          token0: token0.contractInstance.contractId,
          token1: token1.contractInstance.contractId,
          token0Amount: amount,
          token1Amount: amount,
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
          { id: token0.contractInstance.contractId, amount },
          { id: token1.contractInstance.contractId, amount }
        ]
      })
      const position = await invariant.methods.getPosition({
        args: { index: 1n }
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

      await InitPosition.execute(sender, {
        initialFields: {
          invariant: invariant.contractId,
          token0: token0.contractInstance.contractId,
          token1: token1.contractInstance.contractId,
          fee: fee,
          tickSpacing: tickSpacing,
          lowerTick: lowerTickIndex,
          upperTick: upperTickIndex
        },
        attoAlphAmount: ONE_ALPH * 6n + DUST_AMOUNT * 2n
      })
      await CreatePosition.execute(sender, {
        initialFields: {
          invariant: invariant.contractId,
          token0: token0.contractInstance.contractId,
          token1: token1.contractInstance.contractId,
          token0Amount: amount / 2n,
          token1Amount: amount / 2n,
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
          { id: token0.contractInstance.contractId, amount: amount / 2n },
          { id: token1.contractInstance.contractId, amount: amount / 2n }
        ]
      })
      const position = await invariant.methods.getPosition({
        args: { index }
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
      const swapAmount = 1000n

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

      const [amountIn, amountOut, targetSqrtPrice] = (
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
      expect(amountOut).toBe(989n)
      expect(targetSqrtPrice).toBe(999254832903522185303508n)

      await Swap.execute(sender, {
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
        }
      })

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
      expect(poolAfter.currentSqrtPrice).toBe(999254832903522185303508n)
      expect(poolAfter.feeGrowthGlobalX).toBe(40000000000000000000000n)
      expect(poolAfter.feeGrowthGlobalY).toBe(0n)
      expect(poolAfter.feeProtocolTokenX).toBe(2n)
      expect(poolAfter.feeProtocolTokenY).toBe(0n)
    }
  }, 15000)
})
