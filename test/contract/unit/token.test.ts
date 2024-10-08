import { DUST_AMOUNT, ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { Withdraw } from '../../../artifacts/ts'
import { balanceOf, deployTokenFaucet } from '../../../src/utils'
import { TokenAmount } from '../../../src/types'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let sender: PrivateKeyWallet

describe('token tests', () => {
  beforeAll(async () => {
    sender = await getSigner(ONE_ALPH * 10n, 0)
  })

  test('withdraw', async () => {
    let initAmount = 100n as TokenAmount
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
    const contractBalance = await balanceOf(
      result.contractInstance.contractId,
      result.contractInstance.address
    )

    expect(senderBalance).toEqual(amount)
    expect(contractBalance).toEqual(initAmount - amount)
  })
})
