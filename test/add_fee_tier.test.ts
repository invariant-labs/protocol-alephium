import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { InvariantError, PercentageScale } from '../src/consts'
import { expectError } from '../src/testUtils'
import { newFeeTier } from '../src/utils'
import { FeeTier } from '../artifacts/ts/types'
import { Invariant } from '../src/invariant'
import { Network } from '../src/network'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let admin: PrivateKeyWallet

describe('add fee tier tests', () => {
  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
  })

  test('add_multiple_fee_tiers', async () => {
    const invariant = await Invariant.deploy(admin, Network.Local, 0n)

    // 0.02%
    const fee = 2n * 10n ** (PercentageScale - 4n)
    const tickSpacing1 = 1n
    const tickSpacing2 = 2n
    const tickSpacing3 = 4n

    {
      const tiersExist = await Promise.all([
        invariant.feeTierExist({ fee, tickSpacing: tickSpacing1 }),
        invariant.feeTierExist({ fee, tickSpacing: tickSpacing2 }),
        invariant.feeTierExist({ fee, tickSpacing: tickSpacing3 })
      ])
      expect(tiersExist).toStrictEqual([false, false, false])
    }

    {
      const feeTier = await newFeeTier(fee, tickSpacing1)
      await invariant.addFeeTier(admin, feeTier)
    }

    {
      const tiersExist = await Promise.all([
        invariant.feeTierExist({ fee, tickSpacing: tickSpacing1 }),
        invariant.feeTierExist({ fee, tickSpacing: tickSpacing2 }),
        invariant.feeTierExist({ fee, tickSpacing: tickSpacing3 })
      ])
      expect(tiersExist).toStrictEqual([true, false, false])
    }

    {
      const feeTier = await newFeeTier(fee, tickSpacing2)
      await invariant.addFeeTier(admin, feeTier)
    }

    {
      const tiersExist = await Promise.all([
        invariant.feeTierExist({ fee, tickSpacing: tickSpacing1 }),
        invariant.feeTierExist({ fee, tickSpacing: tickSpacing2 }),
        invariant.feeTierExist({ fee, tickSpacing: tickSpacing3 })
      ])
      expect(tiersExist).toStrictEqual([true, true, false])
    }

    {
      {
        const feeTier = await newFeeTier(fee, tickSpacing3)
        await invariant.addFeeTier(admin, feeTier)
      }
    }

    const feeTiers = await invariant.getFeeTiers()

    expect(feeTiers[0]).toStrictEqual({ fee, tickSpacing: tickSpacing1 })
    expect(feeTiers[1]).toStrictEqual({ fee, tickSpacing: tickSpacing2 })
    expect(feeTiers[2]).toStrictEqual({ fee, tickSpacing: tickSpacing3 })
    expect(feeTiers.length).toBe(3)
  })

  test('add existing fee tier', async () => {
    const invariant = await Invariant.deploy(admin, Network.Local, 0n)

    // 0.02%
    const fee = 2n * 10n ** (PercentageScale - 4n)
    const tickSpacing = 1n
    const feeTier = await newFeeTier(fee, tickSpacing)

    await invariant.addFeeTier(admin, feeTier)

    expectError(
      InvariantError.FeeTierAlreadyExist,
      invariant.addFeeTier(admin, feeTier),
      invariant.instance
    )
  })

  test('add fee tier not admin', async () => {
    const invariant = await Invariant.deploy(admin, Network.Local, 0n)

    // 0.02%
    const fee = 2n * 10n ** (PercentageScale - 4n)
    const tickSpacing = 1n
    const feeTier = await newFeeTier(fee, tickSpacing)

    const notAdmin = await getSigner(ONE_ALPH * 1000n, 0)

    expectError(
      InvariantError.NotAdmin,
      invariant.addFeeTier(notAdmin, feeTier),
      invariant.instance
    )
  })

  test('add fee tier zero fee', async () => {
    const invariant = await Invariant.deploy(admin, Network.Local, 0n)

    const fee = 0n
    const tickSpacing = 10n
    const feeTier = await newFeeTier(fee, tickSpacing)
    await invariant.addFeeTier(admin, feeTier)
  })

  test('add fee tier tick spacing zero', async () => {
    const invariant = await Invariant.deploy(admin, Network.Local, 0n)

    // 0.02%
    const fee = 2n * 10n ** (PercentageScale - 4n)
    const tickSpacing = 0n
    const feeTier: FeeTier = { fee, tickSpacing }
    expectError(
      InvariantError.InvalidTickSpacing,
      invariant.addFeeTier(admin, feeTier),
      invariant.instance
    )
  })

  test('add fee tier over upper bound tick spacing', async () => {
    const invariant = await Invariant.deploy(admin, Network.Local, 0n)

    // 0.02%
    const fee = 2n * 10n ** (PercentageScale - 4n)
    const tickSpacing = 101n
    const feeTier: FeeTier = { fee, tickSpacing }
    expectError(
      InvariantError.InvalidTickSpacing,
      invariant.addFeeTier(admin, feeTier),
      invariant.instance
    )
  })

  test('add fee tier fee above limit', async () => {
    const invariant = await Invariant.deploy(admin, Network.Local, 0n)

    // 100%
    const fee = 10n ** PercentageScale
    const tickSpacing = 10n
    const feeTier: FeeTier = { fee, tickSpacing }
    expectError(InvariantError.InvalidFee, invariant.addFeeTier(admin, feeTier), invariant.instance)
  })
})
