import { DUST_AMOUNT, ONE_ALPH, ZERO_ADDRESS, web3 } from '@alephium/web3'
import { getSigner, testAddress } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { AddFeeTier, CreatePool, CreatePosition, Init, InitPosition, Invariant } from '../artifacts/ts'
import { invariantDeployFee, testPrivateKeys } from '../src/consts'
import { decodePosition, decodeTick, deployInvariant } from '../src/utils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let sender = new PrivateKeyWallet({ privateKey: testPrivateKeys[0] })

describe('position tests', () => {
  const protocolFee = 0n
  const fee = 10n ** 12n
  const tickSpacing = 10n
  const liquidityDelta = 1000n
  const lowerTickIndex = -20n
  const upperTickIndex = 10n

  beforeAll(async () => {
    sender = await getSigner(ONE_ALPH * 1000n, 0)
  })

  test('create position', async () => {
    const invariantResult = await deployInvariant(sender, protocolFee)

    const invariant = Invariant.at(invariantResult.contractInstance.address)

    await Init.execute(sender, {
      initialFields: { invariant: invariant.contractId },
      attoAlphAmount: invariantDeployFee
    })

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
        token0: ZERO_ADDRESS,
        token1: testAddress,
        fee,
        tickSpacing,
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
        fee,
        tickSpacing,
        lowerTick: lowerTickIndex,
        upperTick: upperTickIndex
      },
      attoAlphAmount: ONE_ALPH * 6n + DUST_AMOUNT * 2n
    })

    await CreatePosition.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        index: 1n,
        token0: ZERO_ADDRESS,
        token1: testAddress,
        fee,
        tickSpacing,
        lowerTick: lowerTickIndex,
        upperTick: upperTickIndex,
        liquidityDelta: liquidityDelta,
        slippageLimitLower: 1000000000000000000000000n,
        slippageLimitUpper: 1000000000000000000000000n
      }
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
      args: { token0: ZERO_ADDRESS, token1: testAddress, fee, tickSpacing, index: lowerTickIndex }
    })

    const parsedLowerTick = decodeTick(lowerTick.returns)
    expect(parsedLowerTick.exist).toBe(true)
    expect(parsedLowerTick.sign).toBe(true)
    expect(parsedLowerTick.liquidityChange).toBe(liquidityDelta)
    expect(parsedLowerTick.liquidityGross).toBe(liquidityDelta)
    // expect(parsedLowerTick.sqrtPrice).toBe(999500149965000000000000n)
    expect(parsedLowerTick.feeGrowthOutsideX).toBe(0n)
    expect(parsedLowerTick.feeGrowthOutsideY).toBe(0n)
    expect(parsedLowerTick.secondsOutside).toBe(0n)

    const upperTick = await invariant.methods.getTick({
      args: { token0: ZERO_ADDRESS, token1: testAddress, fee, tickSpacing, index: upperTickIndex }
    })

    const parsedUpperTick = decodeTick(upperTick.returns)
    expect(parsedUpperTick.exist).toBe(true)
    expect(parsedUpperTick.sign).toBe(false)
    expect(parsedUpperTick.liquidityChange).toBe(liquidityDelta)
    expect(parsedUpperTick.liquidityGross).toBe(liquidityDelta)
    // expect(parsedUpperTick.sqrtPrice).toBe(1000500100010000000000000n)
    expect(parsedUpperTick.feeGrowthOutsideX).toBe(0n)
    expect(parsedUpperTick.feeGrowthOutsideY).toBe(0n)
    expect(parsedUpperTick.secondsOutside).toBe(0n)

    const isLowerTickInitialized = await invariant.methods.isTickInitialized({
      args: { token0: ZERO_ADDRESS, token1: testAddress, fee, tickSpacing, index: lowerTickIndex }
    })

    expect(isLowerTickInitialized.returns).toBe(true)

    const isUpperTickInitialized = await invariant.methods.isTickInitialized({
      args: { token0: ZERO_ADDRESS, token1: testAddress, fee, tickSpacing, index: upperTickIndex }
    })

    expect(isUpperTickInitialized.returns).toBe(true)
  })
})
