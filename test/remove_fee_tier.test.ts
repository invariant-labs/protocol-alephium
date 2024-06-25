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
  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
  })

  test('remove_fee_tier', async () => {
    const invariant = await deployInvariant(admin, 0n)

    // 0.02%
    const fee = 2n * 10n ** (PercentageScale - 4n)
    const tickSpacing = 1n
    const tickSpacing2 = 2n

    await initFeeTier(invariant, admin, fee, tickSpacing)
    await initFeeTier(invariant, admin, fee, tickSpacing2)
    await removeFeeTier(invariant, admin, fee, tickSpacing)
    let tierExists = feeTierExists(invariant, { fee, tickSpacing })[0]
    expect(tierExists).toBeFalsy()

    const feeTiers = await getFeeTiers(invariant)
    expect(feeTiers[0]).toStrictEqual({ fee, tickSpacing: tickSpacing2 })
    expect(feeTiers.length).toBe(1)
  })

  test('remove_non_existing_fee_tier', async () => {
    const invariant = await deployInvariant(admin, 0n)

    // 0.02%
    const fee = 2n * 10n ** (PercentageScale - 4n)
    const tickSpacing = 1n
    const tickSpacing2 = 2n

    await initFeeTier(invariant, admin, fee, tickSpacing)

    let tierExists = feeTierExists(invariant, { fee, tickSpacing: tickSpacing2 })[0]
    expect(tierExists).toBeFalsy()

    expectError(
      InvariantError.FeeTierNotFound,
      invariant,
      removeFeeTier(invariant, admin, fee, tickSpacing2)
    )
  })

  test('remove fee tier not admin', async () => {
    const invariant = await deployInvariant(admin, 0n)

    // 0.02%
    const fee = 2n * 10n ** (PercentageScale - 4n)
    const tickSpacing = 1n
    const tickSpacing2 = 2n

    await initFeeTier(invariant, admin, fee, tickSpacing)
    await initFeeTier(invariant, admin, fee, tickSpacing2)

    const notAdmin = await getSigner(ONE_ALPH * 1000n, 0)

    expectError(
      InvariantError.NotAdmin,
      invariant,
      removeFeeTier(invariant, notAdmin, fee, tickSpacing)
    )
  })
})
