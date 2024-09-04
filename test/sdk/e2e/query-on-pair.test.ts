import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { Invariant } from '../../../src/invariant'
import { initTokensXY } from '../../../src/testUtils'
import { getBasicFeeTickSpacing } from '../../../src/snippets'
import { newFeeTier, newPoolKey } from '../../../src/utils'
import { Percentage, TokenAmount, toSqrtPrice } from '../../../src'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

describe('query on token pair tests', () => {
  const initialFee = 0n as Percentage
  const [fee] = getBasicFeeTickSpacing()
  const initSqrtPrice = toSqrtPrice(1n)
  const supply = (10n ** 10n) as TokenAmount

  test('query on pools', async () => {
    const deployer = await getSigner(ONE_ALPH * 1000n, 0)
    const invariant = await Invariant.deploy(deployer, initialFee)
    const [tokenX, tokenY] = await initTokensXY(deployer, supply)

    const feeTier10TS = newFeeTier(fee, 10n)
    const feeTier20TS = newFeeTier(fee, 20n)

    await invariant.addFeeTier(deployer, feeTier10TS)
    await invariant.addFeeTier(deployer, feeTier20TS)

    const poolKey0 = newPoolKey(tokenX.contractId, tokenY.contractId, feeTier10TS)
    const poolKey1 = newPoolKey(tokenX.contractId, tokenY.contractId, feeTier20TS)

    await invariant.createPool(deployer, poolKey0, initSqrtPrice)

    await invariant.createPool(deployer, poolKey1, initSqrtPrice)

    const expectedPool0 = await invariant.getPool(poolKey0)
    const expectedPool1 = await invariant.getPool(poolKey1)

    const queriedPools = await invariant.getAllPoolsForPair(tokenX.contractId, tokenY.contractId)
    expect(queriedPools).toStrictEqual([expectedPool0, expectedPool1])
    const allPoolKeys = await invariant.getAllPoolKeys()
    expect(allPoolKeys.length).toBe(2)
  })
  test('query max pools', async () => {
    const deployer = await getSigner(ONE_ALPH * 1000n, 0)
    const invariant = await Invariant.deploy(deployer, initialFee)
    const [tokenX, tokenY] = await initTokensXY(deployer, supply)

    for (let tickSpacing = 1n; tickSpacing <= 32n; tickSpacing++) {
      const feeTier = newFeeTier(fee, tickSpacing)
      const poolKey = newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)
      await invariant.addFeeTier(deployer, feeTier)
      await invariant.createPool(deployer, poolKey, initSqrtPrice)
    }

    const queriedPools = await invariant.getAllPoolsForPair(tokenX.contractId, tokenY.contractId)
    expect(queriedPools.length).toBe(32)
  }, 35000)
})
