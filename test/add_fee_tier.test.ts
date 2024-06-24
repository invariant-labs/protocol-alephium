import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { deployInvariant, expectErrorCode } from '../src/utils'
import { InvariantError, PercentageScale } from '../src/consts'
import { feeTierExists, getFeeTiers, initFeeTier } from '../src/testUtils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let admin: PrivateKeyWallet

describe('add fee tier tests', () => {
  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
  })

  test('add_multiple_fee_tiers', async () => {
    const invariant = await deployInvariant(admin, 0n)

    // 0.02%
    const fee = 2n * 10n ** (PercentageScale - 4n)
    const tickSpacing1 = 1n
    const tickSpacing2 = 2n
    const tickSpacing3 = 4n

    {
      const tiersExist = await feeTierExists(
        invariant,
        { fee, tickSpacing: tickSpacing1 },
        { fee, tickSpacing: tickSpacing2 },
        { fee, tickSpacing: tickSpacing3 }
      )
      expect(tiersExist).toStrictEqual([false, false, false])
    }

    await initFeeTier(invariant, admin, fee, tickSpacing1)

    {
      const tiersExist = await feeTierExists(
        invariant,
        { fee, tickSpacing: tickSpacing1 },
        { fee, tickSpacing: tickSpacing2 },
        { fee, tickSpacing: tickSpacing3 }
      )
      expect(tiersExist).toStrictEqual([true, false, false])
    }

    await initFeeTier(invariant, admin, fee, tickSpacing2)

    {
      const tiersExist = await feeTierExists(
        invariant,
        { fee, tickSpacing: tickSpacing1 },
        { fee, tickSpacing: tickSpacing2 },
        { fee, tickSpacing: tickSpacing3 }
      )
      expect(tiersExist).toStrictEqual([true, true, false])
    }

    await initFeeTier(invariant, admin, fee, tickSpacing3)

    const feeTiers = await getFeeTiers(invariant)

    expect(feeTiers[0]).toStrictEqual({ fee, tickSpacing: tickSpacing1 })
    expect(feeTiers[1]).toStrictEqual({ fee, tickSpacing: tickSpacing2 })
    expect(feeTiers[2]).toStrictEqual({ fee, tickSpacing: tickSpacing3 })
    expect(feeTiers.length).toBe(3)
  })

  test('add existing fee tier', async () => {
    const invariant = await deployInvariant(admin, 0n)

    // 0.02%
    const fee = 2n * 10n ** (PercentageScale - 4n)
    const tickSpacing = 1n

    await initFeeTier(invariant, admin, fee, tickSpacing)

    expectErrorCode(
      InvariantError.FeeTierAlreadyExist,
      initFeeTier(invariant, admin, fee, tickSpacing)
    )
  })

  test('add fee tier not admin', async () => {
    const invariant = await deployInvariant(admin, 0n)

    // 0.02%
    const fee = 2n * 10n ** (PercentageScale - 4n)
    const tickSpacing = 1n

    const notAdmin = await getSigner(ONE_ALPH * 1000n, 0)

    expectErrorCode(InvariantError.NotAdmin, initFeeTier(invariant, notAdmin, fee, tickSpacing))
  })

  test('add fee tier zero fee', async () => {
    const invariant = await deployInvariant(admin, 0n)

    const fee = 0n
    await initFeeTier(invariant, admin, fee, 10n)
  })

  test('add fee tier tick spacing zero', async () => {
    const invariant = await deployInvariant(admin, 0n)

    // 0.02%
    const fee = 2n * 10n ** (PercentageScale - 4n)
    const tickSpacing = 0n

    expectErrorCode(
      InvariantError.InvalidTickSpacing,
      initFeeTier(invariant, admin, fee, tickSpacing)
    )
  })

  test('add fee tier over upper bound tick spacing', async () => {
    const invariant = await deployInvariant(admin, 0n)

    // 0.02%
    const fee = 2n * 10n ** (PercentageScale - 4n)
    const tickSpacing = 101n

    expectErrorCode(
      InvariantError.InvalidTickSpacing,
      initFeeTier(invariant, admin, fee, tickSpacing)
    )
  })

  test('add fee tier fee above limit', async () => {
    const invariant = await deployInvariant(admin, 0n)

    // 100%
    const fee = 10n ** PercentageScale
    const tickSpacing = 10n

    expectErrorCode(InvariantError.InvalidFee, initFeeTier(invariant, admin, fee, tickSpacing))
  })
})
