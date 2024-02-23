import { DUST_AMOUNT, ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { Withdraw } from '../artifacts/ts'
import { testPrivateKeys } from '../src/consts'
import { balanceOf, deployTokenFaucet } from '../src/utils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let sender = new PrivateKeyWallet({ privateKey: testPrivateKeys[0] })

describe('token tests', () => {
  beforeAll(async () => {
    sender = await getSigner(ONE_ALPH * 10n, 0)
  })

  test('withdraw works', async () => {
    let initAmount = 100n
    let amount = 25n

    const result = await deployTokenFaucet(sender, '', '', 0n, initAmount)

    await Withdraw.execute(sender, {
      initialFields: {
        token: result.contractInstance.contractId,
        amount
      },
      attoAlphAmount: DUST_AMOUNT * 2n
    })

    const senderBalance = await balanceOf(result.contractInstance.contractId, sender.address)
    const contractBalance = await balanceOf(result.contractInstance.contractId, result.contractInstance.address)

    expect(senderBalance).toEqual(amount)
    expect(contractBalance).toEqual(initAmount - amount)
  })
})
