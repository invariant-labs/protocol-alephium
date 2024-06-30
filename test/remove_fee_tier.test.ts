import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { deployInvariant } from '../src/utils'
import { InvariantError, PercentageScale } from '../src/consts'
import {
  expectError,
  feeTierExists,
  getFeeTiers,
  initFeeTier,
  removeFeeTier
} from '../src/testUtils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let admin: PrivateKeyWallet

describe('remove fee tier tests', () => {
  // 0.02%
  const fee = 2n * 10n ** (PercentageScale - 4n)
  const tickSpacings = [1n, 2n]

  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
  })

  test('remove_fee_tier', async () => {
    const invariant = await deployInvariant(admin, 0n)

    await initFeeTier(invariant, admin, fee, tickSpacings[0])
    await initFeeTier(invariant, admin, fee, tickSpacings[1])
    await removeFeeTier(invariant, admin, fee, tickSpacings[0])
    const [tierExists] = await feeTierExists(invariant, { fee, tickSpacing: tickSpacings[0] })
    expect(tierExists).toBeFalsy()

    const feeTiers = await getFeeTiers(invariant)
    expect(feeTiers[0]).toStrictEqual({ fee, tickSpacing: tickSpacings[1] })
    expect(feeTiers.length).toBe(1)
  })

  test('remove_non_existing_fee_tier', async () => {
    const invariant = await deployInvariant(admin, 0n)
    await initFeeTier(invariant, admin, fee, tickSpacings[0])

    const [tierExists] = await feeTierExists(invariant, { fee, tickSpacing: tickSpacings[1] })
    expect(tierExists).toBeFalsy()

    expectError(
      InvariantError.FeeTierNotFound,
      removeFeeTier(invariant, admin, fee, tickSpacings[1]),
      invariant
    )
  })

  test('remove fee tier not admin', async () => {
    const invariant = await deployInvariant(admin, 0n)

    await initFeeTier(invariant, admin, fee, tickSpacings[0])
    await initFeeTier(invariant, admin, fee, tickSpacings[1])

    const notAdmin = await getSigner(ONE_ALPH * 1000n, 0)

    expectError(
      InvariantError.NotAdmin,
      removeFeeTier(invariant, notAdmin, fee, tickSpacings[0]),
      invariant
    )
  })
})
