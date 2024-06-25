import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { AddFeeTier, RemoveFeeTier } from '../artifacts/ts'
import { decodeFeeTiers, deployInvariant, MAP_ENTRY_DEPOSIT } from '../src/utils'
import { expectError } from '../src/testUtils'
import { InvariantError } from '../src/consts'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let sender: PrivateKeyWallet

describe('fee tier tests', () => {
  beforeAll(async () => {
    sender = await getSigner(ONE_ALPH * 1000n, 0)
  })

  test('add fee tier', async () => {
    const invariant = await deployInvariant(sender, 0n)

    const fee1 = 0n
    const tickSpacing1 = 1n

    await AddFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: fee1,
        tickSpacing: tickSpacing1
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT
    })

    const exist = (
      await invariant.methods.feeTierExist({ args: { fee: fee1, tickSpacing: tickSpacing1 } })
    ).returns
    expect(exist).toBeTruthy()

    {
      const feeTiers = await invariant.methods.getFeeTiers()
      const parsedFeeTiers = decodeFeeTiers(feeTiers.returns)

      expect(parsedFeeTiers.length).toBe(1)
      expect(parsedFeeTiers[0].fee).toBe(fee1)
      expect(parsedFeeTiers[0].tickSpacing).toBe(tickSpacing1)
    }

    const fee2 = 0n
    const tickSpacing2 = 2n

    await AddFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: fee2,
        tickSpacing: tickSpacing2
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT
    })

    {
      const feeTiers = await invariant.methods.getFeeTiers()
      const parsedFeeTiers = decodeFeeTiers(feeTiers.returns)

      expect(parsedFeeTiers.length).toBe(2)
      expect(parsedFeeTiers[0].fee).toBe(fee1)
      expect(parsedFeeTiers[0].tickSpacing).toBe(tickSpacing1)
      expect(parsedFeeTiers[1].fee).toBe(fee2)
      expect(parsedFeeTiers[1].tickSpacing).toBe(tickSpacing2)
    }

    await expectError(
      InvariantError.FeeTierAlreadyExist,
      invariant,
      AddFeeTier.execute(sender, {
        initialFields: {
          invariant: invariant.contractId,
          fee: fee2,
          tickSpacing: tickSpacing2
        },
        attoAlphAmount: MAP_ENTRY_DEPOSIT
      })
    )

    {
      const feeTiers = await invariant.methods.getFeeTiers()
      const parsedFeeTiers = decodeFeeTiers(feeTiers.returns)

      expect(parsedFeeTiers.length).toBe(2)
      expect(parsedFeeTiers[0].fee).toBe(fee1)
      expect(parsedFeeTiers[0].tickSpacing).toBe(tickSpacing1)
      expect(parsedFeeTiers[1].fee).toBe(fee2)
      expect(parsedFeeTiers[1].tickSpacing).toBe(tickSpacing2)
    }
  })

  test('remove fee tier', async () => {
    const invariant = await deployInvariant(sender, 0n)

    const fee1 = 0n
    const tickSpacing1 = 1n

    await AddFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: fee1,
        tickSpacing: tickSpacing1
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT
    })

    const fee2 = 0n
    const tickSpacing2 = 2n

    await AddFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: fee2,
        tickSpacing: tickSpacing2
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT
    })

    await RemoveFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: fee1,
        tickSpacing: tickSpacing1
      },
      attoAlphAmount: 0n
    })

    {
      const feeTiers = await invariant.methods.getFeeTiers()
      const parsedFeeTiers = decodeFeeTiers(feeTiers.returns)

      expect(parsedFeeTiers.length).toBe(1)
      expect(parsedFeeTiers[0].fee).toBe(fee2)
      expect(parsedFeeTiers[0].tickSpacing).toBe(tickSpacing2)
    }

    await expectError(
      InvariantError.FeeTierNotFound,
      invariant,
      RemoveFeeTier.execute(sender, {
        initialFields: {
          invariant: invariant.contractId,
          fee: fee1,
          tickSpacing: tickSpacing1
        },
        attoAlphAmount: 0n
      })
    )

    {
      const feeTiers = await invariant.methods.getFeeTiers()
      const parsedFeeTiers = decodeFeeTiers(feeTiers.returns)

      expect(parsedFeeTiers.length).toBe(1)
      expect(parsedFeeTiers[0].fee).toBe(fee2)
      expect(parsedFeeTiers[0].tickSpacing).toBe(tickSpacing2)
    }

    await RemoveFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: fee2,
        tickSpacing: tickSpacing2
      },
      attoAlphAmount: 0n
    })

    {
      const feeTiers = await invariant.methods.getFeeTiers()
      const parsedFeeTiers = decodeFeeTiers(feeTiers.returns)

      expect(parsedFeeTiers.length).toBe(0)
    }
  })
})
