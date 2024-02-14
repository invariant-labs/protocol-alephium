import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { Invariant } from '../artifacts/ts'
import { testPrivateKeys } from '../utils/consts'
import { deployInvariant } from '../utils/test-helpers'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let sender = new PrivateKeyWallet({ privateKey: testPrivateKeys[0] })

describe('invariant tests', () => {
  beforeAll(async () => {
    sender = await getSigner(ONE_ALPH * 10n, 0)
  })

  test('deploy', async () => {
    const invariantResult = await deployInvariant(sender, 500n)

    const invariant = Invariant.at(invariantResult.contractInstance.address)

    const result = await invariant.methods.getProtocolFee()

    expect(result.returns).toBe(500n)
  })
})
