import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { deployInvariant } from '../../../src/testUtils'
import { changeProtocolFee, expectError, getProtocolFee } from '../../../src/testUtils'
import { InvariantError } from '../../../src/consts'
import { Percentage } from '../../../src/types'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let admin: PrivateKeyWallet
let unauthorizedUser: PrivateKeyWallet

describe('change protocol fee tests', () => {
  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
    unauthorizedUser = await getSigner(ONE_ALPH * 1000n, 0)
  })
  it('change protocol fee', async () => {
    const protocolFee = 0n as Percentage
    const invariant = await deployInvariant(admin, protocolFee)
    const newFee = 1n as Percentage
    await changeProtocolFee(invariant, admin, newFee)
    const queriedFee = await getProtocolFee(invariant)
    expect(queriedFee).toBe(newFee)
  })
  it('not fee receiver', async () => {
    const protocolFee = 0n as Percentage
    const invariant = await deployInvariant(admin, protocolFee)
    const newFee = 1n as Percentage
    await expectError(
      InvariantError.NotAdmin,
      changeProtocolFee(invariant, unauthorizedUser, newFee),
      invariant
    )
  })
})
