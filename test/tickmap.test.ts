import { DUST_AMOUNT, ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { Flip } from '../artifacts/ts'
import { testPrivateKeys } from '../src/consts'
import { deployChunk, deployTickmap } from '../src/utils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let sender = new PrivateKeyWallet({ privateKey: testPrivateKeys[0] })

describe('tickmap tests', () => {
  beforeAll(async () => {
    sender = await getSigner(ONE_ALPH * 1000n, 0)
  })

  test('flip and get works', async () => {
    const chunk = await deployChunk(sender)
    const tickmap = await deployTickmap(sender, chunk.contractInstance.contractId)

    const getBefore = await tickmap.contractInstance.methods.get({
      args: { tick: 0n, tickSpacing: 1n }
    })
    expect(getBefore.returns).toEqual(false)

    await Flip.execute(sender, {
      initialFields: { tickmap: tickmap.contractInstance.contractId, tick: 0n, tickSpacing: 1n },
      attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
    })

    const getAfter = await tickmap.contractInstance.methods.get({
      args: { tick: 0n, tickSpacing: 1n }
    })
    expect(getAfter.returns).toEqual(true)

    await Flip.execute(sender, {
      initialFields: { tickmap: tickmap.contractInstance.contractId, tick: 20n, tickSpacing: 1n },
      attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
    })

    const nextInitialized1 = await tickmap.contractInstance.methods.nextInitialized({
      args: { tick: 10n, tickSpacing: 1n }
    })
    expect(nextInitialized1.returns).toEqual([true, 20n])

    const nextInitialized2 = await tickmap.contractInstance.methods.nextInitialized({
      args: { tick: 30n, tickSpacing: 1n }
    })
    expect(nextInitialized2.returns).toEqual([false, 0n])
  })
})
