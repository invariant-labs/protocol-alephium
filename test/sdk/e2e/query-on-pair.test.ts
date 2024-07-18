import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { Invariant } from '../../../src/invariant'
import { Network } from '../../../src/network'
import { initTokensXY } from '../../../src/testUtils'
import { getBasicFeeTickSpacing } from '../../../src/snippets'
import { newFeeTier, newPoolKey } from '../../../src/utils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

describe('query on token pair tests', () => {
  const initialFee = 0n
  const [fee] = getBasicFeeTickSpacing()
  const initSqrtPrice = 10n ** 24n
  const supply = 10n ** 10n

  test('query on pools', async () => {
    const deployer = await getSigner(ONE_ALPH * 1000n, 0)
    const invariant = await Invariant.deploy(deployer, Network.Local, initialFee)
    const [tokenX, tokenY] = await initTokensXY(deployer, supply)

    const feeTier10TS = await newFeeTier(fee, 10n)
    const feeTier20TS = await newFeeTier(fee, 20n)

    await invariant.addFeeTier(deployer, feeTier10TS)
    await invariant.addFeeTier(deployer, feeTier20TS)

    const poolKey0 = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier10TS)
    const poolKey1 = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier20TS)

    await invariant.createPool(
      deployer,
      tokenX.contractId,
      tokenY.contractId,
      feeTier10TS,
      initSqrtPrice
    )

    await invariant.createPool(
      deployer,
      tokenX.contractId,
      tokenY.contractId,
      feeTier20TS,
      initSqrtPrice
    )

    const expectedPool0 = await invariant.getPool(poolKey0)
    const expectedPool1 = await invariant.getPool(poolKey1)

    const queriedPools = await invariant.getAllPoolsForPair(tokenX.contractId, tokenY.contractId)
    expect(queriedPools).toStrictEqual([expectedPool0, expectedPool1])
    const allPoolKeys = await invariant.getAllPoolKeys()
    expect(allPoolKeys.length).toBe(2)
  })
  test('query max pools', async () => {
    const deployer = await getSigner(ONE_ALPH * 1000n, 0)
    const invariant = await Invariant.deploy(deployer, Network.Local, initialFee)
    const [tokenX, tokenY] = await initTokensXY(deployer, supply)

    for (let tickSpacing = 1n; tickSpacing <= 32n; tickSpacing++) {
      const feeTier10TS = await newFeeTier(fee, tickSpacing)
      await invariant.addFeeTier(deployer, feeTier10TS)
      await invariant.createPool(
        deployer,
        tokenX.contractId,
        tokenY.contractId,
        feeTier10TS,
        initSqrtPrice
      )
    }

    const queriedPools = await invariant.getAllPoolsForPair(tokenX.contractId, tokenY.contractId)
    expect(queriedPools.length).toBe(32)
  })
})
