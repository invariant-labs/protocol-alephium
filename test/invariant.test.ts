import { DUST_AMOUNT, ONE_ALPH, toApiByteVec, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { AddFeeTier, ChangeProtocolFee, CreatePool, Init, Invariant } from '../artifacts/ts'
import { invariantDeployFee, testPrivateKeys } from '../src/consts'
import { decodeFeeTiers, decodePool, decodePools, deployInvariant, deployTokenFaucet } from '../src/utils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let sender = new PrivateKeyWallet({ privateKey: testPrivateKeys[0] })

describe('invariant tests', () => {
  beforeAll(async () => {
    sender = await getSigner(ONE_ALPH * 1000n, 0)
  })

  test('create pool', async () => {
    const invariant = await deployInvariant(sender, 0n)

    // const invariant = Invariant.at(invariantResult.contractInstance.address)

    // await Init.execute(sender, {
    //   initialFields: { invariant: invariant.contractId },
    //   attoAlphAmount: invariantDeployFee
    // })

    await AddFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: 0n,
        tickSpacing: 1n
      },
      attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
    })

    const token0 = await deployTokenFaucet(sender, '', '', 0n, 0n)
    const token1 = await deployTokenFaucet(sender, '', '', 0n, 0n)

    await CreatePool.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        fee: 0n,
        tickSpacing: 1n,
        initSqrtPrice: 1000000000000000000000000n,
        initTick: 0n
      },
      attoAlphAmount: ONE_ALPH * 2n + DUST_AMOUNT * 2n
    })
  })
  test('create pool', async () => {
    const invariant = await deployInvariant(sender, 0n)

    // const invariant = Invariant.at(invariantResult.contractInstance.address)

    // await Init.execute(sender, {
    //   initialFields: { invariant: invariant.contractId },
    //   attoAlphAmount: invariantDeployFee
    // })

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

    const token0 = await deployTokenFaucet(sender, '', '', 0n, 0n)
    const token1 = await deployTokenFaucet(sender, '', '', 0n, 0n)

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
      attoAlphAmount: ONE_ALPH * 2n + DUST_AMOUNT * 2n
    })

    const poolKey = toApiByteVec(token0.contractInstance.contractId)
    const index = 1n

    const pools = await invariant.methods.getPools()
    const parsedPools = decodePools(pools.returns)

    expect(parsedPools.length).toBe(1)
    // expect(parsedPools[0].token0).toBe(ZERO_ADDRESS)
    // expect(parsedPools[0].token1).toBe(testAddress)
    expect(parsedPools[0].fee).toBe(100n)
    expect(parsedPools[0].tickSpacing).toBe(1n)

    const pool = await invariant.methods.getPool({
      args: {
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        fee: 100n,
        tickSpacing: 1n
      }
    })

    const parsedPool = decodePool(pool.returns)
    expect(parsedPool.liquidity).toBe(0n)
    expect(parsedPool.currentSqrtPrice).toBe(1000000000000000000000000n)
    expect(parsedPool.currentTickIndex).toBe(0n)
    expect(parsedPool.feeGrowthGlobalX).toBe(0n)
    expect(parsedPool.feeGrowthGlobalY).toBe(0n)
    expect(parsedPool.feeProtocolTokenX).toBe(0n)
    expect(parsedPool.feeProtocolTokenY).toBe(0n)
    expect(parsedPool.startTimestamp).toBeGreaterThan(0n)
    expect(parsedPool.lastTimestamp).toBeGreaterThan(0n)

    const tick = await invariant.methods.getTick({
      args: {
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        fee: 100n,
        tickSpacing: 1n,
        index: 0n
      }
    })

    expect(tick.returns[0]).toBe(false)
  })
  test('protocol fee', async () => {
    const invariant = await deployInvariant(sender, 0n)

    // const invariant = Invariant.at(invariantResult.contractInstance.address)

    // await Init.execute(sender, {
    //   initialFields: { invariant: invariant.contractId },
    //   attoAlphAmount: invariantDeployFee
    // })

    const currentFee = (await invariant.methods.getProtocolFee()).returns
    expect(currentFee).toEqual(0n)

    await ChangeProtocolFee.execute(sender, {
      initialFields: { invariant: invariant.contractId, newFee: 100n }
    })

    const changedFee = (await invariant.methods.getProtocolFee()).returns
    expect(changedFee).toEqual(100n)
  })
})
