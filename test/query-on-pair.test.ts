import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { Invariant } from '../src/invariant'
import { Network } from '../src/network'
import { getPool, initTokensXY } from '../src/testUtils'
import { getBasicFeeTickSpacing } from '../src/snippets'
import { newFeeTier, newPoolKey } from '../src/utils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

describe('query on pair', () => {
  test('query on pools works', async () => {
    const initialFee = 0n
    const [fee] = getBasicFeeTickSpacing()
    const deployer = await getSigner(ONE_ALPH * 1000n, 0)
    const invariant = await Invariant.deploy(deployer, Network.Local, initialFee)
    const supply = 10n ** 10n
    const [tokenX, tokenY] = await initTokensXY(deployer, supply)

    const initSqrtPrice = 10n ** 24n
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
    console.log('expectedPool0', expectedPool0)
    console.log('expectedPool1', expectedPool1)
    const query = await invariant.getAllPoolsForPair(tokenX.contractId, tokenY.contractId)
    console.log(query)
  })
})
