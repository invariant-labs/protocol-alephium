import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { getPool, expectError, initTokensXY, initFeeTier, initPool } from '../src/testUtils'
import { ChangeFeeReceiver, TokenFaucetInstance } from '../artifacts/ts'
import { newFeeTier, newPoolKey } from '../src/utils'
import { InvariantError } from '../src/consts'
import { FeeTier, PoolKey } from '../artifacts/ts/types'
import { Network } from '../src/network'
import { Invariant } from '../src/invariant'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let admin: PrivateKeyWallet
let invariant: Invariant
let tokenX: TokenFaucetInstance
let tokenY: TokenFaucetInstance

describe('change fee receiver tests', () => {
  const protocolFee = 10n ** 10n
  const fee = 6n * 10n ** 9n
  const tickSpacing = 10n
  const initSqrtPrice = 10n ** 24n
  let feeTier: FeeTier
  let poolKey: PoolKey

  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
  })

  beforeEach(async () => {
    invariant = await Invariant.deploy(admin, Network.Local, protocolFee)
    ;[tokenX, tokenY] = await initTokensXY(admin, 0n)
    feeTier = await newFeeTier(fee, tickSpacing)

    await invariant.addFeeTier(admin, feeTier)
    await invariant.createPool(admin, tokenX.contractId, tokenY.contractId, feeTier, initSqrtPrice)
    poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)
  })

  test('test_change_fee_receiver', async () => {
    const newFeeReceiver = await getSigner(ONE_ALPH * 10n, 0)

    await invariant.changeFeeReceiver(admin, poolKey, newFeeReceiver.address)
    const pool = await invariant.getPool(poolKey)

    expect(pool.feeReceiver).toBe(newFeeReceiver.address)
  })

  test('test_not_admin_change_fee_receiver', async () => {
    const notAdmin = await getSigner(ONE_ALPH * 1000n, 0)

    await expectError(
      InvariantError.NotAdmin,
      invariant.changeFeeReceiver(notAdmin, poolKey, notAdmin.address),
      invariant.instance
    )
  })
})
