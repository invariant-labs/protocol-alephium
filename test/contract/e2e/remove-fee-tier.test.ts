import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { newFeeTier } from '../../../src/utils'
import { InvariantError } from '../../../src/consts'
import {
  deployInvariant,
  expectError,
  feeTierExists,
  getFeeTiers,
  initFeeTier,
  removeFeeTier
} from '../../../src/testUtils'
import { FeeTier, Percentage } from '../../../src/types'
import { toPercentage } from '../../../src/math'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let admin: PrivateKeyWallet

describe('remove fee tier tests', () => {
  // 0.02%
  const fee = toPercentage(2n, 4n)
  const tickSpacings = [1n, 2n]
  let feeTier1TS: FeeTier
  let feeTier2TS: FeeTier

  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
    feeTier1TS = newFeeTier(fee, tickSpacings[0])
    feeTier2TS = newFeeTier(fee, tickSpacings[1])
  })

  test('remove fee tier', async () => {
    const invariant = await deployInvariant(admin, 0n as Percentage)

    await initFeeTier(invariant, admin, feeTier1TS)
    await initFeeTier(invariant, admin, feeTier2TS)
    await removeFeeTier(invariant, admin, feeTier1TS)
    const [tierExists] = await feeTierExists(invariant, feeTier1TS)
    expect(tierExists).toBeFalsy()

    const feeTiers = await getFeeTiers(invariant)
    expect(feeTiers[0]).toStrictEqual({ fee, tickSpacing: tickSpacings[1] })
    expect(feeTiers.length).toBe(1)
  })

  test('non existing', async () => {
    const invariant = await deployInvariant(admin, 0n as Percentage)
    await initFeeTier(invariant, admin, feeTier1TS)

    const [tierExists] = await feeTierExists(invariant, feeTier2TS)
    expect(tierExists).toBeFalsy()

    await expectError(
      InvariantError.FeeTierNotFound,
      removeFeeTier(invariant, admin, feeTier2TS),
      invariant
    )
  })

  test('not admin', async () => {
    const invariant = await deployInvariant(admin, 0n as Percentage)

    await initFeeTier(invariant, admin, feeTier1TS)
    await initFeeTier(invariant, admin, feeTier2TS)

    const notAdmin = await getSigner(ONE_ALPH * 1000n, 0)

    await expectError(
      InvariantError.NotAdmin,
      removeFeeTier(invariant, notAdmin, feeTier1TS),
      invariant
    )
  })
})
