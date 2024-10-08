import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { InvariantError } from '../../../src/consts'
import {
  deployInvariant,
  expectError,
  feeTierExists,
  getFeeTiers,
  initFeeTier
} from '../../../src/testUtils'
import { newFeeTier } from '../../../src/utils'
import { toPercentage } from '../../../src/math'
import { FeeTier, Percentage } from '../../../src/types'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let admin: PrivateKeyWallet

describe('add fee tier tests', () => {
  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
  })

  test('multiple', async () => {
    const invariant = await deployInvariant(admin, 0n as Percentage)

    // 0.02%
    const fee = toPercentage(2n, 4n)
    const tickSpacing1 = 1n
    const tickSpacing2 = 2n
    const tickSpacing3 = 4n

    {
      const tiersExist = await feeTierExists(
        invariant,
        newFeeTier(fee, tickSpacing1),
        newFeeTier(fee, tickSpacing2),
        newFeeTier(fee, tickSpacing3)
      )
      expect(tiersExist).toStrictEqual([false, false, false])
    }

    {
      const feeTier = newFeeTier(fee, tickSpacing1)
      await initFeeTier(invariant, admin, feeTier)
    }

    {
      const tiersExist = await feeTierExists(
        invariant,
        newFeeTier(fee, tickSpacing1),
        newFeeTier(fee, tickSpacing2),
        newFeeTier(fee, tickSpacing3)
      )
      expect(tiersExist).toStrictEqual([true, false, false])
    }

    {
      const feeTier = newFeeTier(fee, tickSpacing2)
      await initFeeTier(invariant, admin, feeTier)
    }

    {
      const tiersExist = await feeTierExists(
        invariant,
        newFeeTier(fee, tickSpacing1),
        newFeeTier(fee, tickSpacing2),
        newFeeTier(fee, tickSpacing3)
      )
      expect(tiersExist).toStrictEqual([true, true, false])
    }

    {
      {
        const feeTier = newFeeTier(fee, tickSpacing3)
        await initFeeTier(invariant, admin, feeTier)
      }
    }

    const feeTiers = await getFeeTiers(invariant)
    expect(feeTiers[0]).toStrictEqual({ fee, tickSpacing: tickSpacing1 })
    expect(feeTiers[1]).toStrictEqual({ fee, tickSpacing: tickSpacing2 })
    expect(feeTiers[2]).toStrictEqual({ fee, tickSpacing: tickSpacing3 })
    expect(feeTiers.length).toBe(3)
  })

  test('existing', async () => {
    const invariant = await deployInvariant(admin, 0n as Percentage)

    // 0.02%
    const fee = toPercentage(2n, 4n)
    const tickSpacing = 1n
    const feeTier = newFeeTier(fee, tickSpacing)

    await initFeeTier(invariant, admin, feeTier)

    await expectError(
      InvariantError.FeeTierAlreadyExist,
      initFeeTier(invariant, admin, feeTier),
      invariant
    )
  })

  test('not admin', async () => {
    const invariant = await deployInvariant(admin, 0n as Percentage)

    // 0.02%
    const fee = toPercentage(2n, 4n)
    const tickSpacing = 1n
    const feeTier = newFeeTier(fee, tickSpacing)

    const notAdmin = await getSigner(ONE_ALPH * 1000n, 0)

    await expectError(InvariantError.NotAdmin, initFeeTier(invariant, notAdmin, feeTier), invariant)
  })

  test('zero fee', async () => {
    const invariant = await deployInvariant(admin, 0n as Percentage)

    const fee = 0n as Percentage
    const tickSpacing = 10n
    const feeTier = newFeeTier(fee, tickSpacing)
    await initFeeTier(invariant, admin, feeTier)
  })

  test('zero tick spacing', async () => {
    const invariant = await deployInvariant(admin, 0n as Percentage)

    // 0.02%
    const fee = toPercentage(2n, 4n)
    const tickSpacing = 0n
    const feeTier: FeeTier = { fee, tickSpacing }
    await expectError(
      InvariantError.InvalidTickSpacing,
      initFeeTier(invariant, admin, feeTier),
      invariant
    )
  })

  test('over upper bound tick spacing', async () => {
    const invariant = await deployInvariant(admin, 0n as Percentage)

    // 0.02%
    const fee = toPercentage(2n, 4n)
    const tickSpacing = 101n
    const feeTier: FeeTier = { fee, tickSpacing }
    await expectError(
      InvariantError.InvalidTickSpacing,
      initFeeTier(invariant, admin, feeTier),
      invariant
    )
  })

  test('fee above limit', async () => {
    const invariant = await deployInvariant(admin, 0n as Percentage)

    // 100%
    const fee = toPercentage(1n)
    const tickSpacing = 10n
    const feeTier: FeeTier = { fee, tickSpacing }
    await expectError(InvariantError.InvalidFee, initFeeTier(invariant, admin, feeTier), invariant)
  })
})
