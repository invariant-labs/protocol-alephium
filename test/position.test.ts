import { DUST_AMOUNT, ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import {
  AddFeeTier,
  ClaimFee,
  CreatePool,
  IncreasePositionLiquidity,
  InitializeEmptyPosition,
  RemovePosition,
  Swap,
  TransferPosition,
  Withdraw
} from '../artifacts/ts'
import { balanceOf, decodePool, decodePosition, decodeTick, deployInvariant, deployTokenFaucet, MAP_ENTRY_DEPOSIT } from '../src/utils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let sender: PrivateKeyWallet

describe('position tests', () => {
  beforeAll(async () => {
    sender = await getSigner(ONE_ALPH * 1000n, 0)
  })

  test('create position', async () => {
    let initAmount = 1000n
    let amount = 1000n

    const token0 = await deployTokenFaucet(sender, '', '', 0n, initAmount)
    await Withdraw.execute(sender, {
      initialFields: {
        token: token0.contractInstance.contractId,
        amount
      },
      attoAlphAmount: DUST_AMOUNT
    })

    const token1 = await deployTokenFaucet(sender, '', '', 0n, initAmount)
    await Withdraw.execute(sender, {
      initialFields: {
        token: token1.contractInstance.contractId,
        amount
      },
      attoAlphAmount: DUST_AMOUNT
    })

    const invariant = await deployInvariant(sender, 0n)

    await AddFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: 100n,
        tickSpacing: 1n
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT
    })

    await CreatePool.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        fee: 100n,
        tickSpacing: 1n,
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
        fee: 100n,
        tickSpacing: 1n,
        lowerTick: -10n,
        upperTick: 10n
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT * 6n
    })

    const senderToken0BalanceBefore = await balanceOf(token0.contractInstance.contractId, sender.address)
    const senderToken1BalanceBefore = await balanceOf(token1.contractInstance.contractId, sender.address)
    const invariantToken0BalanceBefore = await balanceOf(token0.contractInstance.contractId, invariant.address)
    const invariantToken1BalanceBefore = await balanceOf(token1.contractInstance.contractId, invariant.address)

    expect(senderToken0BalanceBefore).toBe(1000n)
    expect(senderToken1BalanceBefore).toBe(1000n)
    expect(invariantToken0BalanceBefore).toBe(0n)
    expect(invariantToken1BalanceBefore).toBe(0n)

    const lowerTickIndex = -10n
    const upperTickIndex = 10n
    const liquidityDelta = 10000000000n

    await IncreasePositionLiquidity.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        approvedTokens0: amount,
        approvedTokens1: amount,
        index: 1n,
        fee: 100n,
        tickSpacing: 1n,
        lowerTick: lowerTickIndex,
        upperTick: upperTickIndex,
        liquidityDelta,
        slippageLimitLower: 1000000000000000000000000n,
        slippageLimitUpper: 1000000000000000000000000n
      },
      tokens: [
        { id: token0.contractInstance.contractId, amount },
        { id: token1.contractInstance.contractId, amount }
      ]
    })

    const senderToken0BalanceAfter = await balanceOf(token0.contractInstance.contractId, sender.address)
    const senderToken1BalanceAfter = await balanceOf(token1.contractInstance.contractId, sender.address)
    const invariantToken0BalanceAfter = await balanceOf(token0.contractInstance.contractId, invariant.address)
    const invariantToken1BalanceAfter = await balanceOf(token1.contractInstance.contractId, invariant.address)

    expect(senderToken0BalanceAfter).toBe(950n)
    expect(senderToken1BalanceAfter).toBe(950n)
    expect(invariantToken0BalanceAfter).toBe(50n)
    expect(invariantToken1BalanceAfter).toBe(50n)

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
        fee: 100n,
        tickSpacing: 1n,
        index: -10n
      }
    })

    const parsedLowerTick = decodeTick(lowerTick.returns)
    expect(parsedLowerTick.exist).toBe(true)
    expect(parsedLowerTick.sign).toBe(true)
    expect(parsedLowerTick.liquidityChange).toBe(liquidityDelta)
    expect(parsedLowerTick.liquidityGross).toBe(liquidityDelta)
    expect(parsedLowerTick.sqrtPrice).toBe(999500149965000000000000n)
    expect(parsedLowerTick.feeGrowthOutsideX).toBe(0n)
    expect(parsedLowerTick.feeGrowthOutsideY).toBe(0n)
    expect(parsedLowerTick.secondsOutside).toBe(0n)

    const upperTick = await invariant.methods.getTick({
      args: {
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        fee: 100n,
        tickSpacing: 1n,
        index: 10n
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
  })

  test('remove position', async () => {
    let initAmount = 1000n
    let amount = 1000n

    const token0 = await deployTokenFaucet(sender, '', '', 0n, initAmount)
    await Withdraw.execute(sender, {
      initialFields: {
        token: token0.contractInstance.contractId,
        amount
      },
      attoAlphAmount: DUST_AMOUNT * 2n
    })

    const token1 = await deployTokenFaucet(sender, '', '', 0n, initAmount)
    await Withdraw.execute(sender, {
      initialFields: {
        token: token1.contractInstance.contractId,
        amount
      },
      attoAlphAmount: DUST_AMOUNT * 2n
    })

    const invariant = await deployInvariant(sender, 0n)

    await AddFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: 100n,
        tickSpacing: 1n
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT
    })

    await CreatePool.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        fee: 100n,
        tickSpacing: 1n,
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
        fee: 100n,
        tickSpacing: 1n,
        lowerTick: -10n,
        upperTick: 10n
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT * 6n
    })

    const lowerTickIndex = -10n
    const upperTickIndex = 10n
    const liquidityDelta = 10000000000n

    await IncreasePositionLiquidity.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        approvedTokens0: amount,
        approvedTokens1: amount,
        index: 1n,
        fee: 100n,
        tickSpacing: 1n,
        lowerTick: lowerTickIndex,
        upperTick: upperTickIndex,
        liquidityDelta,
        slippageLimitLower: 1000000000000000000000000n,
        slippageLimitUpper: 1000000000000000000000000n
      },
      tokens: [
        { id: token0.contractInstance.contractId, amount },
        { id: token1.contractInstance.contractId, amount }
      ]
    })

    const poolBefore = await invariant.methods.getPool({
      args: {
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        fee: 100n,
        tickSpacing: 1n
      }
    })
    const parsedPoolBefore = decodePool(poolBefore.returns)
    expect(parsedPoolBefore.liquidity).toBe(liquidityDelta)

    const senderToken0BalanceBefore = await balanceOf(token0.contractInstance.contractId, sender.address)
    const senderToken1BalanceBefore = await balanceOf(token1.contractInstance.contractId, sender.address)
    const invariantToken0BalanceBefore = await balanceOf(token0.contractInstance.contractId, invariant.address)
    const invariantToken1BalanceBefore = await balanceOf(token1.contractInstance.contractId, invariant.address)

    expect(senderToken0BalanceBefore).toBe(950n)
    expect(senderToken1BalanceBefore).toBe(950n)
    expect(invariantToken0BalanceBefore).toBe(50n)
    expect(invariantToken1BalanceBefore).toBe(50n)

    await RemovePosition.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        index: 1n
      },
      attoAlphAmount: 0n
    })

    const poolAfter = await invariant.methods.getPool({
      args: {
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        fee: 100n,
        tickSpacing: 1n
      }
    })
    const parsedPoolAfter = decodePool(poolAfter.returns)
    expect(parsedPoolAfter.liquidity).toBe(0n)

    const senderToken0BalanceAfter = await balanceOf(token0.contractInstance.contractId, sender.address)
    const senderToken1BalanceAfter = await balanceOf(token1.contractInstance.contractId, sender.address)
    const invariantToken0BalanceAfter = await balanceOf(token0.contractInstance.contractId, invariant.address)
    const invariantToken1BalanceAfter = await balanceOf(token1.contractInstance.contractId, invariant.address)

    expect(senderToken0BalanceAfter).toBe(999n)
    expect(senderToken1BalanceAfter).toBe(999n)
    expect(invariantToken0BalanceAfter).toBe(1n)
    expect(invariantToken1BalanceAfter).toBe(1n)
  })

  test('claim fee', async () => {
    let amount = 1000000n + 100000n

    const token0 = await deployTokenFaucet(sender, '', '', 0n, amount)
    await Withdraw.execute(sender, {
      initialFields: {
        token: token0.contractInstance.contractId,
        amount: 1000000n
      },
      attoAlphAmount: DUST_AMOUNT * 2n
    })

    const token1 = await deployTokenFaucet(sender, '', '', 0n, amount)
    await Withdraw.execute(sender, {
      initialFields: {
        token: token1.contractInstance.contractId,
        amount: 1000000n
      },
      attoAlphAmount: DUST_AMOUNT * 2n
    })

    const [tokenX, tokenY] =
      token0.contractInstance.contractId < token1.contractInstance.contractId ? [token0, token1] : [token1, token0]

    const invariant = await deployInvariant(sender, 0n)

    const fee = 10000000000n
    const tickSpacing = 1n

    await AddFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee,
        tickSpacing
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT
    })

    await CreatePool.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        fee,
        tickSpacing,
        initSqrtPrice: 1000000000000000000000000n,
        initTick: 0n
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT * 2n
    })

    const lowerTickIndex = -10n
    const upperTickIndex = 10n

    await InitializeEmptyPosition.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        fee,
        tickSpacing,
        lowerTick: lowerTickIndex,
        upperTick: upperTickIndex
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT * 6n
    })

    const liquidityDelta = 100000000000000n

    await IncreasePositionLiquidity.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        approvedTokens0: 1000000n,
        approvedTokens1: 1000000n,
        index: 1n,
        fee,
        tickSpacing,
        lowerTick: lowerTickIndex,
        upperTick: upperTickIndex,
        liquidityDelta,
        slippageLimitLower: 1000000000000000000000000n,
        slippageLimitUpper: 1000000000000000000000000n
      },
      tokens: [
        { id: token0.contractInstance.contractId, amount: 1000000n },
        { id: token1.contractInstance.contractId, amount: 1000000n }
      ]
    })

    await Swap.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        fee,
        tickSpacing,
        xToY: true,
        amount: 100000n,
        byAmountIn: true,
        sqrtPriceLimit: 0n
      },
      tokens: [
        { id: token0.contractInstance.contractId, amount: 100000n },
        { id: token1.contractInstance.contractId, amount: 100000n }
      ]
    })

    const senderTokenXBalanceBefore = await balanceOf(tokenX.contractInstance.contractId, sender.address)
    const senderTokenYBalanceBefore = await balanceOf(tokenY.contractInstance.contractId, sender.address)
    const invariantTokenXBalanceBefore = await balanceOf(tokenX.contractInstance.contractId, invariant.address)
    const invariantTokenYBalanceBefore = await balanceOf(tokenY.contractInstance.contractId, invariant.address)

    expect(senderTokenXBalanceBefore).toBe(400149n)
    expect(senderTokenYBalanceBefore).toBe(599139n)
    expect(invariantTokenXBalanceBefore).toBe(599851n)
    expect(invariantTokenYBalanceBefore).toBe(400861n)

    await ClaimFee.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        index: 1n
      },
      attoAlphAmount: DUST_AMOUNT * 2n
    })

    const senderTokenXBalanceAfter = await balanceOf(tokenX.contractInstance.contractId, sender.address)
    const senderTokenYBalanceAfter = await balanceOf(tokenY.contractInstance.contractId, sender.address)
    const invariantTokenXBalanceAfter = await balanceOf(tokenX.contractInstance.contractId, invariant.address)
    const invariantTokenYBalanceAfter = await balanceOf(tokenY.contractInstance.contractId, invariant.address)

    expect(senderTokenXBalanceAfter).toBe(401149n)
    expect(senderTokenYBalanceAfter).toBe(599139n)
    expect(invariantTokenXBalanceAfter).toBe(598851n)
    expect(invariantTokenYBalanceAfter).toBe(400861n)
  })
  test('transfer position', async () => {
    let initAmount = 1000n
    let amount = 1000n

    const token0 = await deployTokenFaucet(sender, '', '', 0n, initAmount)
    await Withdraw.execute(sender, {
      initialFields: {
        token: token0.contractInstance.contractId,
        amount
      },
      attoAlphAmount: DUST_AMOUNT * 2n
    })

    const token1 = await deployTokenFaucet(sender, '', '', 0n, initAmount)
    await Withdraw.execute(sender, {
      initialFields: {
        token: token1.contractInstance.contractId,
        amount
      },
      attoAlphAmount: DUST_AMOUNT * 2n
    })

    const invariant = await deployInvariant(sender, 0n)

    await AddFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: 100n,
        tickSpacing: 1n
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT
    })

    await CreatePool.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        fee: 100n,
        tickSpacing: 1n,
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
        fee: 100n,
        tickSpacing: 1n,
        lowerTick: -10n,
        upperTick: 10n
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT * 6n
    })

    const senderToken0BalanceBefore = await balanceOf(token0.contractInstance.contractId, sender.address)
    const senderToken1BalanceBefore = await balanceOf(token1.contractInstance.contractId, sender.address)
    const invariantToken0BalanceBefore = await balanceOf(token0.contractInstance.contractId, invariant.address)
    const invariantToken1BalanceBefore = await balanceOf(token1.contractInstance.contractId, invariant.address)

    expect(senderToken0BalanceBefore).toBe(1000n)
    expect(senderToken1BalanceBefore).toBe(1000n)
    expect(invariantToken0BalanceBefore).toBe(0n)
    expect(invariantToken1BalanceBefore).toBe(0n)

    const lowerTickIndex = -10n
    const upperTickIndex = 10n
    const liquidityDelta = 10000000000n

    await IncreasePositionLiquidity.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        approvedTokens0: amount,
        approvedTokens1: amount,
        index: 1n,
        fee: 100n,
        tickSpacing: 1n,
        lowerTick: lowerTickIndex,
        upperTick: upperTickIndex,
        liquidityDelta,
        slippageLimitLower: 1000000000000000000000000n,
        slippageLimitUpper: 1000000000000000000000000n
      },
      tokens: [
        { id: token0.contractInstance.contractId, amount },
        { id: token1.contractInstance.contractId, amount }
      ]
    })

    const senderToken0BalanceAfter = await balanceOf(token0.contractInstance.contractId, sender.address)
    const senderToken1BalanceAfter = await balanceOf(token1.contractInstance.contractId, sender.address)
    const invariantToken0BalanceAfter = await balanceOf(token0.contractInstance.contractId, invariant.address)
    const invariantToken1BalanceAfter = await balanceOf(token1.contractInstance.contractId, invariant.address)

    expect(senderToken0BalanceAfter).toBe(950n)
    expect(senderToken1BalanceAfter).toBe(950n)
    expect(invariantToken0BalanceAfter).toBe(50n)
    expect(invariantToken1BalanceAfter).toBe(50n)

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
    expect(parsedPosition.owner).toBe(sender.address)

    const lowerTick = await invariant.methods.getTick({
      args: {
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        fee: 100n,
        tickSpacing: 1n,
        index: -10n
      }
    })

    const parsedLowerTick = decodeTick(lowerTick.returns)
    expect(parsedLowerTick.exist).toBe(true)
    expect(parsedLowerTick.sign).toBe(true)
    expect(parsedLowerTick.liquidityChange).toBe(liquidityDelta)
    expect(parsedLowerTick.liquidityGross).toBe(liquidityDelta)
    expect(parsedLowerTick.sqrtPrice).toBe(999500149965000000000000n)
    expect(parsedLowerTick.feeGrowthOutsideX).toBe(0n)
    expect(parsedLowerTick.feeGrowthOutsideY).toBe(0n)
    expect(parsedLowerTick.secondsOutside).toBe(0n)

    const upperTick = await invariant.methods.getTick({
      args: {
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        fee: 100n,
        tickSpacing: 1n,
        index: 10n
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

    const recipient = await getSigner(ONE_ALPH * 10n, 0)

    await TransferPosition.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        index: 1n,
        recipient: recipient.address
      },
      attoAlphAmount: DUST_AMOUNT * 2n
    })

    const transferedPosition = decodePosition(
      (
        await invariant.methods.getPosition({
          args: { index: 1n }
        })
      ).returns
    )

    expect(transferedPosition.exist).toBe(true)
    expect(transferedPosition.liquidity).toBe(liquidityDelta)
    expect(transferedPosition.lowerTickIndex).toBe(lowerTickIndex)
    expect(transferedPosition.upperTickIndex).toBe(upperTickIndex)
    expect(transferedPosition.feeGrowthInsideX).toBe(0n)
    expect(transferedPosition.feeGrowthInsideY).toBe(0n)
    expect(transferedPosition.lastBlockNumber).toBeGreaterThan(0n)
    expect(transferedPosition.tokensOwedX).toBe(0n)
    expect(transferedPosition.tokensOwedY).toBe(0n)
    expect(transferedPosition.owner).toBe(recipient.address)
  })
})
