import { DUST_AMOUNT, ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { Flip } from '../artifacts/ts'
import { testPrivateKeys } from '../src/consts'
import { deployCLAMM, deployChunk, deployTickmap } from '../src/utils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let sender = new PrivateKeyWallet({ privateKey: testPrivateKeys[0] })

describe('tickmap tests', () => {
  beforeAll(async () => {
    sender = await getSigner(ONE_ALPH * 1000n, 0)
  })

  test('flip and get works', async () => {
    const chunk = await deployChunk(sender)
    const clamm = await deployCLAMM(sender)
    const tickmap = await deployTickmap(
      sender,
      sender.address,
      chunk.contractInstance.contractId,
      clamm.contractInstance.contractId
    )

    const getBefore = await tickmap.contractInstance.methods.get({
      args: { tick: 0n, tickSpacing: 1n, poolKey: '' }
    })
    expect(getBefore.returns).toEqual(false)

    await Flip.execute(sender, {
      initialFields: { tickmap: tickmap.contractInstance.contractId, tick: 0n, tickSpacing: 1n, poolKey: '' },
      attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
    })

    const getAfter = await tickmap.contractInstance.methods.get({
      args: { tick: 0n, tickSpacing: 1n, poolKey: '' }
    })
    expect(getAfter.returns).toEqual(true)

    await Flip.execute(sender, {
      initialFields: { tickmap: tickmap.contractInstance.contractId, tick: 20n, tickSpacing: 1n, poolKey: '' },
      attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
    })

    const nextInitialized1 = await tickmap.contractInstance.methods.nextInitialized({
      args: { tick: 10n, tickSpacing: 1n, poolKey: '' }
    })
    expect(nextInitialized1.returns).toEqual([true, 20n])

    const nextInitialized2 = await tickmap.contractInstance.methods.nextInitialized({
      args: { tick: 30n, tickSpacing: 1n, poolKey: '' }
    })
    expect(nextInitialized2.returns).toEqual([false, 0n])

    const prevInitialized1 = await tickmap.contractInstance.methods.prevInitialized({
      args: { tick: 30n, tickSpacing: 1n, poolKey: '' }
    })
    expect(prevInitialized1.returns).toEqual([true, 20n])

    const prevInitialized2 = await tickmap.contractInstance.methods.prevInitialized({
      args: { tick: -10n, tickSpacing: 1n, poolKey: '' }
    })
    expect(prevInitialized2.returns).toEqual([false, 0n])

    const closerLimit = await tickmap.contractInstance.methods.getCloserLimit({
      args: {
        sqrtPriceLimit: 1001000450120000000000001n,
        xToY: false,
        currentTick: 10n,
        tickSpacing: 1n,
        poolKey: ''
      }
    })
    expect(closerLimit.returns).toEqual([1001000450120000000000000n, true, 20n, true])
  })
})
