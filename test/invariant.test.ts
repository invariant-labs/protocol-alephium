import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { InvariantError, PercentageScale } from '../src/consts'
import { expectError, feeTierExists, getFeeTiers, initFeeTier } from '../src/testUtils'
import { deployInvariant, newFeeTier } from '../src/utils'
import { FeeTier } from '../artifacts/ts/types'
import { Invariant } from '../src/invariant'
import { Network } from '../src/network'
import { AddFeeTier } from '../artifacts/ts'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

describe('init invariant test', () => {
  test('deploy invariant works', async () => {
    const initialFee = 0n
    const deployer = await getSigner(ONE_ALPH * 1000n, 0)
    const invariant = await Invariant.deploy(deployer, Network.Local, initialFee)
    const protocolFee = await invariant.getProtocolFee()
    expect(protocolFee).toBe(0n)
  })
  test('load invariant from address', async () => {
    const initialFee = 0n
    const deployer = await getSigner(ONE_ALPH * 1000n, 0)
    const invariant = await Invariant.deploy(deployer, Network.Local, initialFee)

    const loadedInvariant = await Invariant.load(invariant.address, Network.Local)
    const protocolFee = await loadedInvariant.getProtocolFee()
    expect(protocolFee).toBe(0n)
  })
  test(' test', async () => {
    console.log(AddFeeTier.script)
  })
})
