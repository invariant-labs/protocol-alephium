import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { InvariantError, PERCENTAGE_SCALE } from '../../../src/consts'
import { expectError, feeTierExists, getFeeTiers, initFeeTier } from '../../../src/testUtils'
import { deployInvariant, newFeeTier } from '../../../src/utils'
import { FeeTier } from '../../../artifacts/ts/types'
import { toPercentage } from '../../../src/math'
import { unwrapFeeTier } from '../../../src/types'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let admin: PrivateKeyWallet

describe('add fee tier tests', () => {
  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
  })

  test('multiple', async () => {
    const invariant = await deployInvariant(admin, 0n)

    // 0.02%
    const fee = toPercentage(2n, 4n)
    const tickSpacing1 = 1n
    const tickSpacing2 = 2n
    const tickSpacing3 = 4n

    {
      const tiersExist = await feeTierExists(
        invariant,
        await newFeeTier(fee, tickSpacing1),
        await newFeeTier(fee, tickSpacing2),
        await newFeeTier(fee, tickSpacing3)
      )
      expect(tiersExist).toStrictEqual([false, false, false])
    }

    {
      const feeTier = await newFeeTier(fee, tickSpacing1)
      await initFeeTier(invariant, admin, feeTier)
    }

    {
      const tiersExist = await feeTierExists(
        invariant,
        await newFeeTier(fee, tickSpacing1),
        await newFeeTier(fee, tickSpacing2),
        await newFeeTier(fee, tickSpacing3)
      )
      expect(tiersExist).toStrictEqual([true, false, false])
    }

    {
      const feeTier = await newFeeTier(fee, tickSpacing2)
      await initFeeTier(invariant, admin, feeTier)
    }

    {
      const tiersExist = await feeTierExists(
        invariant,
        await newFeeTier(fee, tickSpacing1),
        await newFeeTier(fee, tickSpacing2),
        await newFeeTier(fee, tickSpacing3)
      )
      expect(tiersExist).toStrictEqual([true, true, false])
    }

    {
      {
        const feeTier = await newFeeTier(fee, tickSpacing3)
        await initFeeTier(invariant, admin, feeTier)
      }
    }

    const feeTiers = (await getFeeTiers(invariant)).map(tier => {
      return unwrapFeeTier(tier)
    })
    expect(feeTiers[0]).toStrictEqual({ fee, tickSpacing: tickSpacing1 })
    expect(feeTiers[1]).toStrictEqual({ fee, tickSpacing: tickSpacing2 })
    expect(feeTiers[2]).toStrictEqual({ fee, tickSpacing: tickSpacing3 })
    expect(feeTiers.length).toBe(3)
  })

  test('existing', async () => {
    const invariant = await deployInvariant(admin, 0n)

    // 0.02%
    const fee = toPercentage(2n, 4n)
    const tickSpacing = 1n
    const feeTier = await newFeeTier(fee, tickSpacing)

    await initFeeTier(invariant, admin, feeTier)

    expectError(
      InvariantError.FeeTierAlreadyExist,
      initFeeTier(invariant, admin, feeTier),
      invariant
    )
  })

  test('not admin', async () => {
    const invariant = await deployInvariant(admin, 0n)

    // 0.02%
    const fee = toPercentage(2n, 4n)
    const tickSpacing = 1n
    const feeTier = await newFeeTier(fee, tickSpacing)

    const notAdmin = await getSigner(ONE_ALPH * 1000n, 0)

    expectError(InvariantError.NotAdmin, initFeeTier(invariant, notAdmin, feeTier), invariant)
  })

  test('zero fee', async () => {
    const invariant = await deployInvariant(admin, 0n)

    const fee = 0n
    const tickSpacing = 10n
    const feeTier = await newFeeTier(fee, tickSpacing)
    await initFeeTier(invariant, admin, feeTier)
  })

  test('zero tick spacing', async () => {
    const invariant = await deployInvariant(admin, 0n)

    // 0.02%
    const fee = toPercentage(2n, 4n)
    const tickSpacing = 0n
    const feeTier: FeeTier = { fee: { v: fee }, tickSpacing }
    expectError(
      InvariantError.InvalidTickSpacing,
      initFeeTier(invariant, admin, feeTier),
      invariant
    )
  })

  test('over upper bound tick spacing', async () => {
    const invariant = await deployInvariant(admin, 0n)

    // 0.02%
    const fee = toPercentage(2n, 4n)
    const tickSpacing = 101n
    const feeTier: FeeTier = { fee: { v: fee }, tickSpacing }
    expectError(
      InvariantError.InvalidTickSpacing,
      initFeeTier(invariant, admin, feeTier),
      invariant
    )
  })

  test('fee above limit', async () => {
    const invariant = await deployInvariant(admin, 0n)

    // 100%
    const fee = 10n ** PERCENTAGE_SCALE
    const tickSpacing = 10n
    const feeTier: FeeTier = { fee: { v: fee }, tickSpacing }
    expectError(InvariantError.InvalidFee, initFeeTier(invariant, admin, feeTier), invariant)
  })
})
