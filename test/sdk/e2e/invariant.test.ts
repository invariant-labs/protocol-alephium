import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { Invariant } from '../../../src/invariant'
import { Network } from '../../../src/network'
import { getBasicFeeTickSpacing } from '../../../src/snippets'
import { newFeeTier } from '../../../src/utils'
import { Percentage } from '../../../src'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

describe('invariant tests', () => {
  test('deploy', async () => {
    const initialFee = 0n as Percentage
    const deployer = await getSigner(ONE_ALPH * 1000n, 0)
    const invariant = await Invariant.deploy(deployer, Network.Local, initialFee)
    const protocolFee = await invariant.getProtocolFee()
    expect(protocolFee).toBe(0n)
  })
  test('load from address', async () => {
    const initialFee = 0n as Percentage
    const deployer = await getSigner(ONE_ALPH * 1000n, 0)
    const invariant = await Invariant.deploy(deployer, Network.Local, initialFee)

    const loadedInvariant = await Invariant.load(invariant.address, Network.Local)
    const protocolFee = await loadedInvariant.getProtocolFee()
    expect(protocolFee).toBe(0n)
  })
  test('deploy and add a fee tier', async () => {
    const initialFee = 0n as Percentage
    const deployer = await getSigner(ONE_ALPH * 1000n, 0)
    const invariant = await Invariant.deploy(deployer, Network.Local, initialFee)
    const [fee, tickSpacing] = getBasicFeeTickSpacing()
    const feeTier = newFeeTier(fee, tickSpacing)
    await invariant.addFeeTier(deployer, feeTier)
    const exists = await invariant.feeTierExist(feeTier)
    expect(exists).toBeTruthy()
    await invariant.removeFeeTier(deployer, feeTier)
    const notExists = await invariant.feeTierExist(feeTier)
    expect(notExists).toBeFalsy()
  })
})
