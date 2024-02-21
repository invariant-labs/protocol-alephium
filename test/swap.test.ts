import { DUST_AMOUNT, ONE_ALPH, ZERO_ADDRESS, web3 } from '@alephium/web3'
import { getSigner, testAddress } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { AddFeeTier, CreatePool, CreatePosition, Init, InitPosition, Invariant } from '../artifacts/ts'
import { invariantDeployFee, testPrivateKeys } from '../src/consts'
import { decodePool, decodePosition, decodeTick, deployInvariant } from '../src/utils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let sender = new PrivateKeyWallet({ privateKey: testPrivateKeys[0] })

describe('position tests', () => {
  beforeAll(async () => {
    sender = await getSigner(ONE_ALPH * 1000n, 0)
  })

  test('create position', async () => {
    const protocolFee = 10n ** 10n
    const invariantResult = await deployInvariant(sender, protocolFee)

    const invariant = Invariant.at(invariantResult.contractInstance.address)

    await Init.execute(sender, {
      initialFields: { invariant: invariant.contractId },
      attoAlphAmount: invariantDeployFee
    })

    const fee = 6n * 10n ** 9n
    const tickSpacing = 10n

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

    const liquidityDelta = 1000000n * 10n ** 5n

    await InitPosition.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: ZERO_ADDRESS,
        token1: testAddress,
        fee,
        tickSpacing,
        lowerTick: -20n,
        upperTick: 10n
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
        lowerTick: -20n,
        upperTick: 10n,
        liquidityDelta,
        slippageLimitLower: 1000000000000000000000000n,
        slippageLimitUpper: 1000000000000000000000000n
      }
    })

    const position = await invariant.methods.getPosition({
      args: { owner: sender.address, index: 1n }
    })

    const parsedPosition = decodePosition(position.returns)
    expect(parsedPosition.exist).toBe(true)
    expect(parsedPosition.liquidity).toBe(1000n)
    expect(parsedPosition.lowerTickIndex).toBe(-10n)
    expect(parsedPosition.upperTickIndex).toBe(10n)
    expect(parsedPosition.feeGrowthInsideX).toBe(0n)
    expect(parsedPosition.feeGrowthInsideY).toBe(0n)
    expect(parsedPosition.lastBlockNumber).toBeGreaterThan(0n)
    expect(parsedPosition.tokensOwedX).toBe(0n)
    expect(parsedPosition.tokensOwedY).toBe(0n)

    const lowerTick = await invariant.methods.getTick({
      args: { token0: ZERO_ADDRESS, token1: testAddress, fee, tickSpacing, index: -20n }
    })

    const parsedLowerTick = decodeTick(lowerTick.returns)
    expect(parsedLowerTick.exist).toBe(true)
    expect(parsedLowerTick.sign).toBe(true)
    expect(parsedLowerTick.liquidityChange).toBe(1000n)
    expect(parsedLowerTick.liquidityGross).toBe(1000n)
    expect(parsedLowerTick.sqrtPrice).toBe(999500149965000000000000n)
    expect(parsedLowerTick.feeGrowthOutsideX).toBe(0n)
    expect(parsedLowerTick.feeGrowthOutsideY).toBe(0n)
    expect(parsedLowerTick.secondsOutside).toBe(0n)

    const upperTick = await invariant.methods.getTick({
      args: { token0: ZERO_ADDRESS, token1: testAddress, fee, tickSpacing, index: 10n }
    })

    const parsedUpperTick = decodeTick(upperTick.returns)
    expect(parsedUpperTick.exist).toBe(true)
    expect(parsedUpperTick.sign).toBe(false)
    expect(parsedUpperTick.liquidityChange).toBe(1000n)
    expect(parsedUpperTick.liquidityGross).toBe(1000n)
    expect(parsedUpperTick.sqrtPrice).toBe(1000500100010000000000000n)
    expect(parsedUpperTick.feeGrowthOutsideX).toBe(0n)
    expect(parsedUpperTick.feeGrowthOutsideY).toBe(0n)
    expect(parsedUpperTick.secondsOutside).toBe(0n)

    const pool = decodePool(
      (
        await invariant.methods.getPool({
          args: { token0: ZERO_ADDRESS, token1: testAddress, fee, tickSpacing }
        })
      ).returns
    )
    expect(pool.liquidity).toBe(1000n)
  })
})
