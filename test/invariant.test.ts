import { DUST_AMOUNT, ONE_ALPH, ZERO_ADDRESS, toApiByteVec, web3 } from '@alephium/web3'
import { getSigner, testAddress } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { AddFeeTier, ChangeProtocolFee, CreatePool, CreateTick, Init, Invariant, RemoveFeeTier } from '../artifacts/ts'
import { invariantDeployFee, testPrivateKeys } from '../src/consts'
import { decodeFeeTiers, decodePool, decodePools, deployInvariant, expectError } from '../src/utils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let sender = new PrivateKeyWallet({ privateKey: testPrivateKeys[0] })

describe('invariant tests', () => {
  beforeAll(async () => {
    sender = await getSigner(ONE_ALPH * 1000n, 0)
  })

  test('collection', async () => {
    const invariantResult = await deployInvariant(sender, 0n)

    const invariant = Invariant.at(invariantResult.contractInstance.address)

    await Init.execute(sender, {
      initialFields: { invariant: invariant.contractId },
      attoAlphAmount: invariantDeployFee
    })

    let feeTier = await invariant.methods.getFeeTierCount()
    expect(feeTier.returns).toEqual(0n)

    await AddFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: 0n,
        tickSpacing: 1n
      },
      attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
    })

    feeTier = await invariant.methods.getFeeTierCount()
    expect(feeTier.returns).toEqual(1n)

    await AddFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: 0n,
        tickSpacing: 2n
      },
      attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
    })

    feeTier = await invariant.methods.getFeeTierCount()
    expect(feeTier.returns).toEqual(2n)

    await expectError(
      AddFeeTier.execute(sender, {
        initialFields: {
          invariant: invariant.contractId,
          fee: 0n,
          tickSpacing: 1n
        },
        attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
      })
    )

    feeTier = await invariant.methods.getFeeTierCount()
    expect(feeTier.returns).toEqual(2n)

    await RemoveFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: 0n,
        tickSpacing: 1n
      }
    })

    feeTier = await invariant.methods.getFeeTierCount()
    expect(feeTier.returns).toEqual(1n)

    await expectError(
      RemoveFeeTier.execute(sender, {
        initialFields: {
          invariant: invariant.contractId,
          fee: 0n,
          tickSpacing: 1n
        }
      })
    )

    feeTier = await invariant.methods.getFeeTierCount()
    expect(feeTier.returns).toEqual(1n)

    await expectError(
      RemoveFeeTier.execute(sender, {
        initialFields: {
          invariant: invariant.contractId,
          fee: 0n,
          tickSpacing: 1n
        }
      })
    )

    feeTier = await invariant.methods.getFeeTierCount()
    expect(feeTier.returns).toEqual(1n)

    await RemoveFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: 0n,
        tickSpacing: 2n
      }
    })

    feeTier = await invariant.methods.getFeeTierCount()
    expect(feeTier.returns).toEqual(0n)
  })

  test('create pool', async () => {
    const invariantResult = await deployInvariant(sender, 0n)

    const invariant = Invariant.at(invariantResult.contractInstance.address)

    await Init.execute(sender, {
      initialFields: { invariant: invariant.contractId },
      attoAlphAmount: invariantDeployFee
    })

    let feeTier = await invariant.methods.getFeeTierCount()
    expect(feeTier.returns).toEqual(0n)

    await AddFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: 0n,
        tickSpacing: 1n
      },
      attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
    })

    await CreatePool.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: ZERO_ADDRESS,
        token1: testAddress,
        fee: 0n,
        tickSpacing: 1n,
        initSqrtPrice: 1000000000000000000000000n,
        initTick: 0n
      },
      attoAlphAmount: ONE_ALPH * 2n + DUST_AMOUNT * 2n
    })
  })
  test('create pool', async () => {
    const invariantResult = await deployInvariant(sender, 0n)

    const invariant = Invariant.at(invariantResult.contractInstance.address)

    await Init.execute(sender, {
      initialFields: { invariant: invariant.contractId },
      attoAlphAmount: invariantDeployFee
    })

    let feeTier = await invariant.methods.getFeeTierCount()
    expect(feeTier.returns).toEqual(0n)

    await AddFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: 100n,
        tickSpacing: 1n
      },
      attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
    })

    const feeTiers = await invariant.methods.getFeeTiers()
    const parsedFeeTiers = decodeFeeTiers(feeTiers.returns)

    expect(parsedFeeTiers.length).toBe(1)
    expect(parsedFeeTiers[0].fee).toBe(100n)
    expect(parsedFeeTiers[0].tickSpacing).toBe(1n)

    await CreatePool.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: ZERO_ADDRESS,
        token1: testAddress,
        fee: 100n,
        tickSpacing: 1n,
        initSqrtPrice: 1000000000000000000000000n,
        initTick: 0n
      },
      attoAlphAmount: ONE_ALPH * 2n + DUST_AMOUNT * 2n
    })

    const poolKey = toApiByteVec(ZERO_ADDRESS)
    const index = 1n

    await CreateTick.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        poolKey,
        tickSpacing: 1n,
        index,
        poolCurrentIndex: 0n,
        poolFeeGrowthGlobalX: 0n,
        poolFeeGrowthGlobalY: 0n,
        poolStartTimestamp: 0n
      },
      attoAlphAmount: ONE_ALPH * 2n + DUST_AMOUNT * 2n
    })

    const pools = await invariant.methods.getPools()
    const parsedPools = decodePools(pools.returns)

    expect(parsedPools.length).toBe(1)
    // expect(parsedPools[0].token0).toBe(ZERO_ADDRESS)
    // expect(parsedPools[0].token1).toBe(testAddress)
    expect(parsedPools[0].fee).toBe(100n)
    expect(parsedPools[0].tickSpacing).toBe(1n)

    const pool = await invariant.methods.getPool({
      args: { token0: ZERO_ADDRESS, token1: testAddress, fee: 100n, tickSpacing: 1n }
    })

    expect(pool.returns[0]).toBe(true)
    const parsedPool = decodePool(pool.returns[1])

    expect(parsedPool.poolLiquidity).toBe(0n)
    expect(parsedPool.poolCurrentSqrtPrice).toBe(1000000000000000000000000n)
    expect(parsedPool.poolCurrentTickIndex).toBe(0n)
    expect(parsedPool.feeGrowthGlobalX).toBe(0n)
    expect(parsedPool.feeGrowthGlobalY).toBe(0n)
    expect(parsedPool.feeProtocolTokenX).toBe(0n)
    expect(parsedPool.feeProtocolTokenY).toBe(0n)
    expect(parsedPool.startTimestamp).toBeGreaterThan(0n)
    expect(parsedPool.lastTimestamp).toBeGreaterThan(0n)
    // expect(parsedPool.feeReceiver).toBe(sender.address)

    const tick = await invariant.methods.getTick({
      args: { token0: ZERO_ADDRESS, token1: testAddress, fee: 100n, tickSpacing: 1n, index: 0n }
    })

    expect(tick.returns[0]).toBe(false)

    const isTickInitialized = await invariant.methods.isTickInitialized({
      args: { token0: ZERO_ADDRESS, token1: testAddress, fee: 100n, tickSpacing: 1n, index: 0n }
    })

    expect(isTickInitialized.returns).toBe(false)

    {
      const params = { args: { poolKey, index } }
      const [doesExist, isInitialized] = (await invariant.methods.tickExist(params)).returns
    }
  })
  test('protocol fee', async () => {
    const invariantResult = await deployInvariant(sender, 0n)
    const invariant = Invariant.at(invariantResult.contractInstance.address)

    await Init.execute(sender, {
      initialFields: { invariant: invariant.contractId },
      attoAlphAmount: invariantDeployFee
    })

    const currentFee = (await invariant.methods.getProtocolFee()).returns
    expect(currentFee).toEqual(0n)

    await ChangeProtocolFee.execute(sender, {
      initialFields: { invariant: invariant.contractId, newFee: 100n }
    })

    const changedFee = (await invariant.methods.getProtocolFee()).returns
    expect(changedFee).toEqual(100n)
  })
})
