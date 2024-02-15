import { AddressType, DUST_AMOUNT, ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { AddFeeTier, CreatePool, Invariant, RemoveFeeTier } from '../artifacts/ts'
import { testPrivateKeys } from '../src/consts'
import { deployInvariant, expectError } from '../src/utils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let sender = new PrivateKeyWallet({ privateKey: testPrivateKeys[0] })

describe('invariant tests', () => {
  beforeAll(async () => {
    sender = await getSigner(ONE_ALPH * 1000n, 0)
  })

  test('collection', async () => {
    const invariantResult = await deployInvariant(sender, 0n)

    const invariant = Invariant.at(invariantResult.contractInstance.address)

    let feeTier = await invariant.methods.getFeeTierCount()
    expect(feeTier.returns).toEqual(0n)

    await AddFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: 0n,
        tickSpacing: 1n
      },
      attoAlphAmount: ONE_ALPH * 2n + DUST_AMOUNT * 2n
    })

    feeTier = await invariant.methods.getFeeTierCount()
    expect(feeTier.returns).toEqual(1n)

    await AddFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: 0n,
        tickSpacing: 2n
      },
      attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
    })

    feeTier = await invariant.methods.getFeeTierCount()
    expect(feeTier.returns).toEqual(2n)

    await expectError(
      AddFeeTier.execute(sender, {
        initialFields: {
          invariant: invariant.contractId,
          fee: 0n,
          tickSpacing: 1n
        },
        attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
      })
    )

    feeTier = await invariant.methods.getFeeTierCount()
    expect(feeTier.returns).toEqual(2n)

    await RemoveFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: 0n,
        tickSpacing: 1n
      }
    })

    feeTier = await invariant.methods.getFeeTierCount()
    expect(feeTier.returns).toEqual(1n)

    await expectError(
      RemoveFeeTier.execute(sender, {
        initialFields: {
          invariant: invariant.contractId,
          fee: 0n,
          tickSpacing: 1n
        }
      })
    )

    feeTier = await invariant.methods.getFeeTierCount()
    expect(feeTier.returns).toEqual(1n)

    await expectError(
      RemoveFeeTier.execute(sender, {
        initialFields: {
          invariant: invariant.contractId,
          fee: 0n,
          tickSpacing: 1n
        }
      })
    )

    feeTier = await invariant.methods.getFeeTierCount()
    expect(feeTier.returns).toEqual(1n)

    await RemoveFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: 0n,
        tickSpacing: 2n
      }
    })

    feeTier = await invariant.methods.getFeeTierCount()
    expect(feeTier.returns).toEqual(0n)
  })
  test('init pool', async () => {
    const invariantResult = await deployInvariant(sender, 0n)

    const invariant = Invariant.at(invariantResult.contractInstance.address)

    let feeTier = await invariant.methods.getFeeTierCount()
    expect(feeTier.returns).toEqual(0n)

    await AddFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: 0n,
        tickSpacing: 1n
      },
      attoAlphAmount: ONE_ALPH * 2n + DUST_AMOUNT * 2n
    })

    feeTier = await invariant.methods.getFeeTierCount()
    expect(feeTier.returns).toEqual(1n)

    // CreatePool.execute(sender, {
    //   initialFields: {
    //     invariant: invariant.contractId,
    //     token0: '1DrDyTr9RpRsQnDnXo2YRiPzPW4ooHX5LLoqXrqfMrpQH',
    //     token1: '2DrDyTr9RpRsQnDnXo2YRiPzPW4ooHX5LLoqXrqfMrpQH',
    //     fee: 0n,
    //     tickSpacing: 1n,
    //     initSqrtPrice: 10n ** 24n,
    //     initTick: 0n
    //   }
    // })
  })
})
