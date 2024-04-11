import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { AddFeeTier, RemoveFeeTier } from '../artifacts/ts'
import { decodeFeeTiers, deployInvariant, expectError } from '../src/utils'

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
      attoAlphAmount: ONE_ALPH
    })

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
      attoAlphAmount: ONE_ALPH
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

    expectError(
      AddFeeTier.execute(sender, {
        initialFields: {
          invariant: invariant.contractId,
          fee: fee2,
          tickSpacing: tickSpacing2
        },
        attoAlphAmount: ONE_ALPH
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
      attoAlphAmount: ONE_ALPH
    })

    const fee2 = 0n
    const tickSpacing2 = 2n

    await AddFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: fee2,
        tickSpacing: tickSpacing2
      },
      attoAlphAmount: ONE_ALPH
    })

    await RemoveFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: fee1,
        tickSpacing: tickSpacing1
      },
      attoAlphAmount: ONE_ALPH
    })

    {
      const feeTiers = await invariant.methods.getFeeTiers()
      const parsedFeeTiers = decodeFeeTiers(feeTiers.returns)

      expect(parsedFeeTiers.length).toBe(1)
      expect(parsedFeeTiers[0].fee).toBe(fee2)
      expect(parsedFeeTiers[0].tickSpacing).toBe(tickSpacing2)
    }

    expectError(
      RemoveFeeTier.execute(sender, {
        initialFields: {
          invariant: invariant.contractId,
          fee: fee1,
          tickSpacing: tickSpacing1
        },
        attoAlphAmount: ONE_ALPH
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
      attoAlphAmount: ONE_ALPH
    })

    {
      const feeTiers = await invariant.methods.getFeeTiers()
      const parsedFeeTiers = decodeFeeTiers(feeTiers.returns)

      expect(parsedFeeTiers.length).toBe(0)
    }
  })

  test('fee tier exist', async () => {
    const invariant = await deployInvariant(sender, 0n)

    const fee1 = 0n
    const tickSpacing1 = 1n

    const fee2 = 0n
    const tickSpacing2 = 2n

    const fee3 = 0n
    const tickSpacing3 = 3n

    {
      const feeTier1Exist = await invariant.methods.feeTierExist({ args: { fee: fee1, tickSpacing: tickSpacing1 } })
      expect(feeTier1Exist.returns).toBe(false)

      const feeTier2Exist = await invariant.methods.feeTierExist({ args: { fee: fee2, tickSpacing: tickSpacing2 } })
      expect(feeTier2Exist.returns).toBe(false)

      const feeTier3Exist = await invariant.methods.feeTierExist({ args: { fee: fee3, tickSpacing: tickSpacing3 } })
      expect(feeTier3Exist.returns).toBe(false)
    }

    await AddFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: fee1,
        tickSpacing: tickSpacing1
      },
      attoAlphAmount: ONE_ALPH
    })

    {
      const feeTier1Exist = await invariant.methods.feeTierExist({ args: { fee: fee1, tickSpacing: tickSpacing1 } })
      expect(feeTier1Exist.returns).toBe(true)

      const feeTier2Exist = await invariant.methods.feeTierExist({ args: { fee: fee2, tickSpacing: tickSpacing2 } })
      expect(feeTier2Exist.returns).toBe(false)

      const feeTier3Exist = await invariant.methods.feeTierExist({ args: { fee: fee3, tickSpacing: tickSpacing3 } })
      expect(feeTier3Exist.returns).toBe(false)
    }

    await AddFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: fee2,
        tickSpacing: tickSpacing2
      },
      attoAlphAmount: ONE_ALPH
    })

    {
      const feeTier1Exist = await invariant.methods.feeTierExist({ args: { fee: fee1, tickSpacing: tickSpacing1 } })
      expect(feeTier1Exist.returns).toBe(true)

      const feeTier2Exist = await invariant.methods.feeTierExist({ args: { fee: fee2, tickSpacing: tickSpacing2 } })
      expect(feeTier2Exist.returns).toBe(true)

      const feeTier3Exist = await invariant.methods.feeTierExist({ args: { fee: fee3, tickSpacing: tickSpacing3 } })
      expect(feeTier3Exist.returns).toBe(false)
    }
  })

  test('not admin', async () => {
    const invariant = await deployInvariant(sender, 0n)

    const notAdmin = await getSigner(ONE_ALPH * 1000n, 0)

    const fee = 0n
    const tickSpacing = 1n

    expectError(
      AddFeeTier.execute(notAdmin, {
        initialFields: {
          invariant: invariant.contractId,
          fee,
          tickSpacing
        },
        attoAlphAmount: ONE_ALPH
      })
    )

    await AddFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee,
        tickSpacing
      },
      attoAlphAmount: ONE_ALPH
    })

    expectError(
      RemoveFeeTier.execute(notAdmin, {
        initialFields: {
          invariant: invariant.contractId,
          fee,
          tickSpacing
        },
        attoAlphAmount: ONE_ALPH
      })
    )
  })
})
