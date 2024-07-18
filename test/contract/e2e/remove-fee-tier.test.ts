import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { deployInvariant, newFeeTier } from '../../../src/utils'
import { InvariantError, PercentageScale } from '../../../src/consts'
import {
  expectError,
  feeTierExists,
  getFeeTiers,
  initFeeTier,
  removeFeeTier
} from '../../../src/testUtils'
import { FeeTier } from '../../../artifacts/ts/types'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let admin: PrivateKeyWallet

describe('remove fee tier tests', () => {
  // 0.02%
  const fee = 2n * 10n ** (PercentageScale - 4n)
  const tickSpacings = [1n, 2n]
  let feeTier1TS: FeeTier
  let feeTier2TS: FeeTier

  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
    feeTier1TS = await newFeeTier(fee, tickSpacings[0])
    feeTier2TS = await newFeeTier(fee, tickSpacings[1])
  })

  test('remove fee tier', async () => {
    const invariant = await deployInvariant(admin, 0n)

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
    const invariant = await deployInvariant(admin, 0n)
    await initFeeTier(invariant, admin, feeTier1TS)

    const [tierExists] = await feeTierExists(invariant, feeTier2TS)
    expect(tierExists).toBeFalsy()

    expectError(
      InvariantError.FeeTierNotFound,
      removeFeeTier(invariant, admin, feeTier2TS),
      invariant
    )
  })

  test('not admin', async () => {
    const invariant = await deployInvariant(admin, 0n)

    await initFeeTier(invariant, admin, feeTier1TS)
    await initFeeTier(invariant, admin, feeTier2TS)

    const notAdmin = await getSigner(ONE_ALPH * 1000n, 0)

    expectError(InvariantError.NotAdmin, removeFeeTier(invariant, notAdmin, feeTier1TS), invariant)
  })
})
