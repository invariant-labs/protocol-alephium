import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { Invariant } from '../../../src/invariant'
import { Network } from '../../../src/network'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { TokenFaucetInstance } from '../../../artifacts/ts'
import { expectVMError, initTokensXY, withdrawTokens } from '../../../src/testUtils'
import { PoolKey } from '../../../artifacts/ts/types'
import { newFeeTier, newPoolKey } from '../../../src/utils'
import { MAX_POOL_KEYS_QUERIED, VMError } from '../../../src/consts'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let invariant: Invariant
let deployer: PrivateKeyWallet
let positionOwner: PrivateKeyWallet
let tokenX: TokenFaucetInstance
let tokenY: TokenFaucetInstance

describe('get pool keys test', () => {
  const initialFee = 0n

  const initSqrtPrice = 10n ** 24n
  const supply = 10n ** 10n

  beforeEach(async () => {
    deployer = await getSigner(ONE_ALPH * 1000n, 0)
    positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
    invariant = await Invariant.deploy(deployer, Network.Local, initialFee)
    ;[tokenX, tokenY] = await initTokensXY(deployer, supply)

    await withdrawTokens(positionOwner, [tokenX, supply], [tokenY, supply])
  })
  test('query on 0 pools', async () => {
    const poolKeys = await invariant.getAllPoolKeys()
    expect(poolKeys.length).toBe(0)
  })
  test('get all pool keys', async () => {
    const feeTiers = await Promise.all(
      Array.from(Array(10).keys()).map(async i => await newFeeTier(BigInt(i + 1), BigInt(i + 1)))
    )
    const expectedPoolKeys: PoolKey[] = []
    for (const feeTier of feeTiers) {
      await invariant.addFeeTier(deployer, feeTier)

      const poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)
      expectedPoolKeys.push(poolKey)
      await invariant.createPool(
        deployer,
        tokenX.contractId,
        tokenY.contractId,
        feeTier,
        initSqrtPrice
      )
    }

    const poolKeys = await invariant.getAllPoolKeys()
    expect(poolKeys.length).toBe(10)

    poolKeys.map((poolKey, index) => {
      expect(poolKey).toStrictEqual(expectedPoolKeys[index])
    })
  })
  test('find max query limit', async () => {
    const feeTier = await newFeeTier(1n, 1n)
    await invariant.addFeeTier(deployer, feeTier)
    const expectedPoolKeys: PoolKey[] = []
    for (let i = 0n; i < MAX_POOL_KEYS_QUERIED; i++) {
      const [tokenX, tokenY] = await initTokensXY(deployer, supply)
      const poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)
      expectedPoolKeys.push(poolKey)
      await invariant.createPool(
        deployer,
        tokenX.contractId,
        tokenY.contractId,
        feeTier,
        initSqrtPrice
      )
    }

    const [poolKeys] = await invariant.getPoolKeys(MAX_POOL_KEYS_QUERIED, 0n)
    expect(poolKeys.length).toBe(Number(MAX_POOL_KEYS_QUERIED))
  }, 150000)
  test('runs out of gas over the limit for single query, querying all passes', async () => {
    const overSingleLimit = MAX_POOL_KEYS_QUERIED + 1n
    const feeTier = await newFeeTier(1n, 1n)
    await invariant.addFeeTier(deployer, feeTier)

    const expectedPoolKeys: PoolKey[] = []
    for (let i = 0n; i < overSingleLimit; i++) {
      const [tokenX, tokenY] = await initTokensXY(deployer, supply)
      const poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)
      expectedPoolKeys.push(poolKey)
      await invariant.createPool(
        deployer,
        tokenX.contractId,
        tokenY.contractId,
        feeTier,
        initSqrtPrice
      )
    }

    expectVMError(VMError.OutOfGas, invariant.getPoolKeys(overSingleLimit, 0n))

    const poolKeys = await invariant.getAllPoolKeys()
    expect(poolKeys.length).toBe(Number(overSingleLimit))

    poolKeys.map((poolKey, index) => {
      expect(poolKey).toStrictEqual(expectedPoolKeys[index])
    })
  }, 150000)
})
