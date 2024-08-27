import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { getPool, expectError, initTokensXY, initFeeTier, initPool, changeFeeReceiver } from '../../../src/testUtils'
import { InvariantInstance, TokenFaucetInstance } from '../../../artifacts/ts'
import { deployInvariant, newFeeTier, newPoolKey } from '../../../src/utils'
import { InvariantError } from '../../../src/consts'
import { FeeTier, PoolKey } from '../../../src/types'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let admin: PrivateKeyWallet
let invariant: InvariantInstance
let tokenX: TokenFaucetInstance
let tokenY: TokenFaucetInstance

describe('change fee receiver tests', () => {
  const protocolFee = 10n ** 10n
  const fee = 6n * 10n ** 9n
  const tickSpacing = 10n
  let feeTier: FeeTier
  let poolKey: PoolKey

  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
  })

  beforeEach(async () => {
    invariant = await deployInvariant(admin, protocolFee)
    ;[tokenX, tokenY] = await initTokensXY(admin, 0n)
    feeTier = await newFeeTier(fee, tickSpacing)
    await initFeeTier(invariant, admin, feeTier)

    await initPool(invariant, admin, tokenX, tokenY, feeTier, 10n ** 24n, 0n)
    poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)
  })

  test('change fee receiver', async () => {
    const newFeeReceiver = await getSigner(ONE_ALPH * 10n, 0)

    await changeFeeReceiver(invariant, admin, poolKey, newFeeReceiver.address)

    const pool = await getPool(invariant, poolKey)

    expect(pool.feeReceiver).toBe(newFeeReceiver.address)
  })

  test('not admin', async () => {
    const notAdmin = await getSigner(ONE_ALPH * 1000n, 0)

    await expectError(
      InvariantError.NotAdmin,
      changeFeeReceiver(invariant, notAdmin, poolKey, notAdmin.address),
      invariant
    )
  })
})
