import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { deployInvariant } from '../src/utils'
import { changeProtocolFee, expectError, getProtocolFee } from '../src/testUtils'
import { InvariantError } from '../src/consts'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let admin: PrivateKeyWallet
let unauthorizedUser: PrivateKeyWallet

describe('change protocol fee tests', () => {
  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
    unauthorizedUser = await getSigner(ONE_ALPH * 1000n, 0)
  })
  it('change protocol fee', async () => {
    const protocolFee = 0n
    const invariant = await deployInvariant(admin, protocolFee)
    const newFee = 1n
    await changeProtocolFee(invariant, admin, newFee)
    const queriedFee = await getProtocolFee(invariant)
    expect(queriedFee).toBe(newFee)
  })
  it('try to change protocol fee by unauthorized user', async () => {
    const protocolFee = 0n
    const invariant = await deployInvariant(admin, protocolFee)
    const newFee = 1n
    await expectError(
      InvariantError.NotAdmin,
      changeProtocolFee(invariant, unauthorizedUser, newFee),
      invariant
    )
  })
})
