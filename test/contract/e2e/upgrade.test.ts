import { web3, ONE_ALPH } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import {
  deployCLAMM,
  deployInvariant,
  expectError,
  upgrade,
  upgradeCLAMM
} from '../../../src/testUtils'
import { Percentage } from '../../../src/types'
import { InvariantError } from '../../../src/consts'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let admin: PrivateKeyWallet
let notAdmin: PrivateKeyWallet

describe('upgrade tests', () => {
  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
    notAdmin = await getSigner(ONE_ALPH * 1000n, 0)
  })

  describe('invariant', () => {
    test('invariant', async () => {
      const invariant = await deployInvariant(admin, 0n as Percentage)
      await upgrade(invariant, admin)
    })

    test('not admin', async () => {
      const invariant = await deployInvariant(admin, 0n as Percentage)
      await expectError(InvariantError.NotAdmin, upgrade(invariant, notAdmin), invariant)
    })
  })

  describe('clamm', () => {
    test('clamm', async () => {
      const clamm = await deployCLAMM(admin)
      await upgradeCLAMM(clamm, admin)
    })

    test('not admin', async () => {
      const clamm = await deployCLAMM(admin)
      await expectError(InvariantError.NotAdmin, upgradeCLAMM(clamm, notAdmin), clamm)
    })
  })
})
