import { DUST_AMOUNT, ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { Invariant, Set } from '../artifacts/ts'
import { testPrivateKeys } from '../utils/consts'
import { deployInvariant, deployValue } from '../utils/test-helpers'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let sender = new PrivateKeyWallet({ privateKey: testPrivateKeys[0] })

describe('invariant tests', () => {
  beforeAll(async () => {
    sender = await getSigner(ONE_ALPH * 10n, 0)
  })

  test('collection', async () => {
    const value = await deployValue(sender)

    const invariantResult = await deployInvariant(sender, 0n, value.contractInstance.contractId)

    const invariant = Invariant.at(invariantResult.contractInstance.address)

    await Set.execute(sender, {
      initialFields: { invariant: invariantResult.contractInstance.address, key: 1n, value: 2n },
      attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
    })

    await Set.execute(sender, {
      initialFields: { invariant: invariantResult.contractInstance.address, key: 2n, value: 5n },
      attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
    })

    const firstResult = await invariant.methods.get({ args: { key: 1n } })
    const secondResult = await invariant.methods.get({ args: { key: 2n } })

    expect(firstResult.returns).toBe(2n)
    expect(secondResult.returns).toBe(5n)
  })
})
