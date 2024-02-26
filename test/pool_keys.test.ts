import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { AddFeeTier, CreatePool } from '../artifacts/ts'
import { decodePools, deployInvariant, deployTokenFaucet } from '../src/utils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let sender: PrivateKeyWallet

describe('pool key tests', () => {
  beforeAll(async () => {
    sender = await getSigner(ONE_ALPH * 1000n, 0)
  })

  test('get pools', async () => {
    const invariant = await deployInvariant(sender, 0n)

    const fee1 = 0n
    const tickSpacing1 = 1n

    await AddFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: fee1,
        tickSpacing: tickSpacing1
      },
      attoAlphAmount: ONE_ALPH
    })

    {
      const pools = await invariant.methods.getPools()
      const parsedPools = decodePools(pools.returns)

      expect(parsedPools.length).toBe(0)
    }

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
      attoAlphAmount: ONE_ALPH * 2n
    })

    {
      const pools = await invariant.methods.getPools()
      const parsedPools = decodePools(pools.returns)

      const [tokenX, tokenY] =
        token0.contractInstance.contractId < token1.contractInstance.contractId
          ? [token0.contractInstance.contractId, token1.contractInstance.contractId]
          : [token1.contractInstance.contractId, token0.contractInstance.contractId]

      expect(parsedPools.length).toBe(1)
      expect(parsedPools[0].tokenX).toBe(tokenX)
      expect(parsedPools[0].tokenY).toBe(tokenY)
      expect(parsedPools[0].fee).toBe(0n)
      expect(parsedPools[0].tickSpacing).toBe(1n)
    }

    const token2 = await deployTokenFaucet(sender, '', '', 0n, 0n)

    await CreatePool.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: token1.contractInstance.contractId,
        token1: token2.contractInstance.contractId,
        fee: 0n,
        tickSpacing: 1n,
        initSqrtPrice: 1000000000000000000000000n,
        initTick: 0n
      },
      attoAlphAmount: ONE_ALPH * 2n
    })

    {
      const pools = await invariant.methods.getPools()
      const parsedPools = decodePools(pools.returns)

      const [tokenX1, tokenY1] =
        token0.contractInstance.contractId < token1.contractInstance.contractId
          ? [token0.contractInstance.contractId, token1.contractInstance.contractId]
          : [token1.contractInstance.contractId, token0.contractInstance.contractId]

      const [tokenX2, tokenY2] =
        token1.contractInstance.contractId < token2.contractInstance.contractId
          ? [token1.contractInstance.contractId, token2.contractInstance.contractId]
          : [token2.contractInstance.contractId, token1.contractInstance.contractId]

      expect(parsedPools.length).toBe(2)
      expect(parsedPools[0].tokenX).toBe(tokenX1)
      expect(parsedPools[0].tokenY).toBe(tokenY1)
      expect(parsedPools[0].fee).toBe(0n)
      expect(parsedPools[0].tickSpacing).toBe(1n)
      expect(parsedPools[1].tokenX).toBe(tokenX2)
      expect(parsedPools[1].tokenY).toBe(tokenY2)
      expect(parsedPools[1].fee).toBe(0n)
      expect(parsedPools[1].tickSpacing).toBe(1n)
    }
  })
})
