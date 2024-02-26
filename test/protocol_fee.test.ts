import { DUST_AMOUNT, ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import {
  AddFeeTier,
  ChangeFeeReceiver,
  CreatePool,
  IncreasePositionLiquidity,
  InitializeEmptyPosition,
  Swap,
  Withdraw,
  WithdrawProtocolFee
} from '../artifacts/ts'
import { balanceOf, decodePool, decodePosition, decodeTick, deployInvariant, deployTokenFaucet } from '../src/utils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let sender: PrivateKeyWallet

describe('protocol fee tests', () => {
  const protocolFee = 10n ** 10n
  const fee = 6n * 10n ** 9n
  const tickSpacing = 10n

  beforeAll(async () => {
    sender = await getSigner(ONE_ALPH * 1000n, 0)
  })

  test('withdraw protocol fee', async () => {
    const liquidityDelta = 1000000n * 10n ** 5n
    const lowerTickIndex = -20n
    const upperTickIndex = 10n

    const amount = 1000000n + 1000n

    const token0 = await deployTokenFaucet(sender, '', '', amount, amount)
    const token1 = await deployTokenFaucet(sender, '', '', amount, amount)

    const [tokenX, tokenY] =
      token0.contractInstance.contractId < token1.contractInstance.contractId ? [token0, token1] : [token1, token0]

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
      attoAlphAmount: ONE_ALPH * 6n + DUST_AMOUNT * 2n
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

      const swapperTokenXBalanceBefore = await balanceOf(tokenX.contractInstance.contractId, swapper.address)
      const invariantTokenXBalanceBefore = await balanceOf(tokenX.contractInstance.contractId, invariant.address)
      const invariantTokenYBalanceBefore = await balanceOf(tokenY.contractInstance.contractId, invariant.address)

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

      const [amountIn, amountOut, targetSqrtPrice] = (
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

      const swapperTokenXBalanceAfter = await balanceOf(tokenX.contractInstance.contractId, swapper.address)
      const swapperTokenYBalanceAfter = await balanceOf(tokenY.contractInstance.contractId, swapper.address)
      const invariantTokenXBalanceAfter = await balanceOf(tokenX.contractInstance.contractId, invariant.address)
      const invariantTokenYBalanceAfter = await balanceOf(tokenY.contractInstance.contractId, invariant.address)

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

    {
      const newFeeReceiver = await getSigner(ONE_ALPH * 10n, 0)

      await ChangeFeeReceiver.execute(sender, {
        initialFields: {
          invariant: invariant.contractId,
          token0: token0.contractInstance.contractId,
          token1: token1.contractInstance.contractId,
          fee: fee,
          tickSpacing: tickSpacing,
          newFeeReceiver: newFeeReceiver.address
        }
      })

      const newFeeReceiverTokenXBalanceBefore = await balanceOf(
        tokenX.contractInstance.contractId,
        newFeeReceiver.address
      )
      const newFeeReceiverTokenYBalanceBefore = await balanceOf(
        tokenY.contractInstance.contractId,
        newFeeReceiver.address
      )
      const invariantTokenXBalanceBefore = await balanceOf(tokenX.contractInstance.contractId, invariant.address)
      const invariantTokenYBalanceBefore = await balanceOf(tokenY.contractInstance.contractId, invariant.address)

      await WithdrawProtocolFee.execute(newFeeReceiver, {
        initialFields: {
          invariant: invariant.contractId,
          token0: token0.contractInstance.contractId,
          token1: token1.contractInstance.contractId,
          fee: fee,
          tickSpacing: tickSpacing
        },
        attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
      })

      const newFeeReceiverTokenXBalanceAfter = await balanceOf(
        tokenX.contractInstance.contractId,
        newFeeReceiver.address
      )
      const newFeeReceiverTokenYBalanceAfter = await balanceOf(
        tokenY.contractInstance.contractId,
        newFeeReceiver.address
      )
      const invariantTokenXBalanceAfter = await balanceOf(tokenX.contractInstance.contractId, invariant.address)
      const invariantTokenYBalanceAfter = await balanceOf(tokenY.contractInstance.contractId, invariant.address)

      expect(newFeeReceiverTokenXBalanceAfter).toBe(newFeeReceiverTokenXBalanceBefore + 1n)
      expect(newFeeReceiverTokenYBalanceAfter).toBe(newFeeReceiverTokenYBalanceBefore)
      expect(invariantTokenXBalanceAfter).toBe(invariantTokenXBalanceBefore - 1n)
      expect(invariantTokenYBalanceAfter).toBe(invariantTokenYBalanceBefore)
    }
  })
})
