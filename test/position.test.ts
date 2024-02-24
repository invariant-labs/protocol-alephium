import { DUST_AMOUNT, ONE_ALPH, ZERO_ADDRESS, web3 } from '@alephium/web3'
import { getSigner, testAddress } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import {
  AddFeeTier,
  ClaimFee,
  CreatePool,
  CreatePosition,
  Init,
  InitPosition,
  Invariant,
  RemovePosition,
  Swap,
  Withdraw
} from '../artifacts/ts'
import { invariantDeployFee, testPrivateKeys } from '../src/consts'
import { balanceOf, decodePosition, decodeTick, deployInvariant, deployTokenFaucet } from '../src/utils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let sender = new PrivateKeyWallet({ privateKey: testPrivateKeys[0] })

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

    const invariantResult = await deployInvariant(sender, 0n)

    const invariant = Invariant.at(invariantResult.contractInstance.address)

    await Init.execute(sender, {
      initialFields: { invariant: invariant.contractId },
      attoAlphAmount: invariantDeployFee
    })

    await AddFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: 100n,
        tickSpacing: 1n
      },
      attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
    })

    await CreatePool.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0Id: token0.contractInstance.contractId,
        token1Id: token1.contractInstance.contractId,
        token0: ZERO_ADDRESS,
        token1: testAddress,
        fee: 100n,
        tickSpacing: 1n,
        initSqrtPrice: 1000000000000000000000000n,
        initTick: 0n
      },
      attoAlphAmount: ONE_ALPH * 2n + DUST_AMOUNT * 2n
    })

    await InitPosition.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: ZERO_ADDRESS,
        token1: testAddress,
        fee: 100n,
        tickSpacing: 1n,
        lowerTick: -10n,
        upperTick: 10n
      },
      attoAlphAmount: ONE_ALPH * 6n + DUST_AMOUNT * 2n
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

    await CreatePosition.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0Id: token0.contractInstance.contractId,
        token1Id: token1.contractInstance.contractId,
        token0Amount: amount,
        token1Amount: amount,
        index: 1n,
        token0: ZERO_ADDRESS,
        token1: testAddress,
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
      args: { token0: ZERO_ADDRESS, token1: testAddress, fee: 100n, tickSpacing: 1n, index: -10n }
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
      args: { token0: ZERO_ADDRESS, token1: testAddress, fee: 100n, tickSpacing: 1n, index: 10n }
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

    const invariantResult = await deployInvariant(sender, 0n)

    const invariant = Invariant.at(invariantResult.contractInstance.address)

    await Init.execute(sender, {
      initialFields: { invariant: invariant.contractId },
      attoAlphAmount: invariantDeployFee
    })

    await AddFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: 100n,
        tickSpacing: 1n
      },
      attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
    })

    await CreatePool.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0Id: token0.contractInstance.contractId,
        token1Id: token1.contractInstance.contractId,
        token0: ZERO_ADDRESS,
        token1: testAddress,
        fee: 100n,
        tickSpacing: 1n,
        initSqrtPrice: 1000000000000000000000000n,
        initTick: 0n
      },
      attoAlphAmount: ONE_ALPH * 2n + DUST_AMOUNT * 2n
    })

    await InitPosition.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: ZERO_ADDRESS,
        token1: testAddress,
        fee: 100n,
        tickSpacing: 1n,
        lowerTick: -10n,
        upperTick: 10n
      },
      attoAlphAmount: ONE_ALPH * 6n + DUST_AMOUNT * 2n
    })

    const lowerTickIndex = -10n
    const upperTickIndex = 10n
    const liquidityDelta = 10000000000n

    await CreatePosition.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0Id: token0.contractInstance.contractId,
        token1Id: token1.contractInstance.contractId,
        token0Amount: amount,
        token1Amount: amount,
        index: 1n,
        token0: ZERO_ADDRESS,
        token1: testAddress,
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
      attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
    })

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
    let amount = 1000000n

    const token0 = await deployTokenFaucet(sender, '', '', 0n, amount)
    await Withdraw.execute(sender, {
      initialFields: {
        token: token0.contractInstance.contractId,
        amount
      },
      attoAlphAmount: DUST_AMOUNT * 2n
    })

    const token1 = await deployTokenFaucet(sender, '', '', 0n, amount)
    await Withdraw.execute(sender, {
      initialFields: {
        token: token1.contractInstance.contractId,
        amount
      },
      attoAlphAmount: DUST_AMOUNT * 2n
    })

    const invariantResult = await deployInvariant(sender, 0n)

    const invariant = Invariant.at(invariantResult.contractInstance.address)

    await Init.execute(sender, {
      initialFields: { invariant: invariant.contractId },
      attoAlphAmount: invariantDeployFee
    })

    const fee = 10000000000n
    const tickSpacing = 1n

    await AddFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee,
        tickSpacing
      },
      attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
    })

    await CreatePool.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0Id: token0.contractInstance.contractId,
        token1Id: token1.contractInstance.contractId,
        token0: ZERO_ADDRESS,
        token1: testAddress,
        fee,
        tickSpacing,
        initSqrtPrice: 1000000000000000000000000n,
        initTick: 0n
      },
      attoAlphAmount: ONE_ALPH * 2n + DUST_AMOUNT * 2n
    })

    const lowerTickIndex = -10n
    const upperTickIndex = 10n

    await InitPosition.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: ZERO_ADDRESS,
        token1: testAddress,
        fee,
        tickSpacing,
        lowerTick: lowerTickIndex,
        upperTick: upperTickIndex
      },
      attoAlphAmount: ONE_ALPH * 6n + DUST_AMOUNT * 2n
    })

    const liquidityDelta = 100000000000000n

    await CreatePosition.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0Id: token0.contractInstance.contractId,
        token1Id: token1.contractInstance.contractId,
        token0Amount: amount,
        token1Amount: amount,
        index: 1n,
        token0: ZERO_ADDRESS,
        token1: testAddress,
        fee,
        tickSpacing,
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

    await Swap.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: ZERO_ADDRESS,
        token1: testAddress,
        fee,
        tickSpacing,
        xToY: true,
        amount: 100000n,
        byAmountIn: true,
        sqrtPriceLimit: 0n
      }
    })

    const senderToken0BalanceBefore = await balanceOf(token0.contractInstance.contractId, sender.address)
    const senderToken1BalanceBefore = await balanceOf(token1.contractInstance.contractId, sender.address)
    const invariantToken0BalanceBefore = await balanceOf(token0.contractInstance.contractId, invariant.address)
    const invariantToken1BalanceBefore = await balanceOf(token1.contractInstance.contractId, invariant.address)

    expect(senderToken0BalanceBefore).toBe(500149n)
    expect(senderToken1BalanceBefore).toBe(500149n)
    expect(invariantToken0BalanceBefore).toBe(499851n)
    expect(invariantToken1BalanceBefore).toBe(499851n)

    await ClaimFee.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        index: 1n
      },
      attoAlphAmount: DUST_AMOUNT * 2n
    })

    const senderToken0BalanceAfter = await balanceOf(token0.contractInstance.contractId, sender.address)
    const senderToken1BalanceAfter = await balanceOf(token1.contractInstance.contractId, sender.address)
    const invariantToken0BalanceAfter = await balanceOf(token0.contractInstance.contractId, invariant.address)
    const invariantToken1BalanceAfter = await balanceOf(token1.contractInstance.contractId, invariant.address)

    expect(senderToken0BalanceAfter).toBe(500149n)
    expect(senderToken1BalanceAfter).toBe(501149n)
    expect(invariantToken0BalanceAfter).toBe(499851n)
    expect(invariantToken1BalanceAfter).toBe(498851n)
  })
})
