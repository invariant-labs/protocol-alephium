import { DUST_AMOUNT, ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { AddFeeTier, CreatePool, Init, Invariant } from '../artifacts/ts'
import { invariantDeployFee, testPrivateKeys } from '../src/consts'
import { decodePool, decodePools, deployInvariant, deployTokenFaucet, expectError } from '../src/utils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let sender = new PrivateKeyWallet({ privateKey: testPrivateKeys[0] })

describe('pools tests', () => {
  beforeAll(async () => {
    sender = await getSigner(ONE_ALPH * 1000n, 0)
  })

  test('create and decode poolKey', async () => {
    const invariantResult = await deployInvariant(sender, 0n)

    const invariant = Invariant.at(invariantResult.contractInstance.address)

    await Init.execute(sender, {
      initialFields: { invariant: invariant.contractId },
      attoAlphAmount: invariantDeployFee
    })

    const token0 = (await deployTokenFaucet(sender, '', '', 0n, 0n)).contractInstance.contractId
    const token1 = (await deployTokenFaucet(sender, '', '', 0n, 0n)).contractInstance.contractId
    const [tokenX, tokenY] = token0 < token1 ? [token0, token1] : [token1, token0]
    {
      const fee = 0n
      const tickSpacing = 1n

      const poolKey = (
        await invariant.methods.generatePoolKey({
          args: { token0, token1, fee, tickSpacing }
        })
      ).returns

      const [extractedTokenX, extractedTokenY] = (
        await invariant.methods.extractTokensFromPoolKey({ args: { poolKey } })
      ).returns

      expect(extractedTokenX).toBe(tokenX)
      expect(extractedTokenY).toBe(tokenY)
    }
  })

  test('create pool', async () => {
    const invariantResult = await deployInvariant(sender, 0n)

    const invariant = Invariant.at(invariantResult.contractInstance.address)

    await Init.execute(sender, {
      initialFields: { invariant: invariant.contractId },
      attoAlphAmount: invariantDeployFee
    })

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
    const pools = await invariant.methods.getPools()
    const parsedPools = decodePools(pools.returns)

    expect(parsedPools.length).toBe(1)
    // expect(parsedPools[0].token0).toBe('030000000000000000000000000000000000000000000000000000000000000000')
    // expect(parsedPools[0].token1).toBe('00bee85f379545a2ed9f6cceb331288842f378cf0f04012ad4ac8824aae7d6f80a')
    expect(parsedPools[0].fee).toBe(0n)
    expect(parsedPools[0].tickSpacing).toBe(1n)

    const pool = await invariant.methods.getPool({
      args: {
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        fee: 0n,
        tickSpacing: 1n
      }
    })

    expect(pool.returns[0]).toBe(true)
    const parsedPool = decodePool(pool.returns)

    expect(parsedPool.liquidity).toBe(0n)
    expect(parsedPool.currentSqrtPrice).toBe(1_000_000_000_000_000_000_000_000n)
    expect(parsedPool.currentTickIndex).toBe(0n)
    expect(parsedPool.feeGrowthGlobalX).toBe(0n)
    expect(parsedPool.feeGrowthGlobalY).toBe(0n)
    expect(parsedPool.feeProtocolTokenX).toBe(0n)
    expect(parsedPool.feeProtocolTokenY).toBe(0n)
    expect(parsedPool.startTimestamp).toBeGreaterThan(0n)
    expect(parsedPool.lastTimestamp).toBeGreaterThan(0n)
  })
  test('not existing pool', async () => {
    const invariantResult = await deployInvariant(sender, 0n)

    const invariant = Invariant.at(invariantResult.contractInstance.address)

    await Init.execute(sender, {
      initialFields: { invariant: invariant.contractId },
      attoAlphAmount: invariantDeployFee
    })
    expectError(
      invariant.methods.getPool({
        args: {
          token0: '',
          token1: '',
          fee: 100n,
          tickSpacing: 1n
        }
      })
    )
    const pools = await invariant.methods.getPools()
    const parsedPools = decodePools(pools.returns)
    expect(parsedPools.length).toBe(0)
  })
})
