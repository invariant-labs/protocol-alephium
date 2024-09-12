import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import {
  getPool,
  expectError,
  initTokensXY,
  initFeeTier,
  initPool,
  changeFeeReceiver,
  deployInvariant
} from '../../../src/testUtils'
import { InvariantInstance, TokenFaucetInstance } from '../../../artifacts/ts'
import { newFeeTier, newPoolKey } from '../../../src/utils'
import { InvariantError, SQRT_PRICE_DENOMINATOR } from '../../../src/consts'
import { FeeTier, PoolKey, TokenAmount } from '../../../src/types'
import { toPercentage } from '../../../src/math'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let admin: PrivateKeyWallet
let invariant: InvariantInstance
let tokenX: TokenFaucetInstance
let tokenY: TokenFaucetInstance

describe('change fee receiver tests', () => {
  const protocolFee = toPercentage(1n, 2n)
  const fee = toPercentage(6n, 3n)
  const tickSpacing = 10n
  let feeTier: FeeTier
  let poolKey: PoolKey

  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
  })

  beforeEach(async () => {
    invariant = await deployInvariant(admin, protocolFee)
    ;[tokenX, tokenY] = await initTokensXY(admin, 0n as TokenAmount)
    feeTier = newFeeTier(fee, tickSpacing)
    await initFeeTier(invariant, admin, feeTier)

    await initPool(invariant, admin, tokenX, tokenY, feeTier, SQRT_PRICE_DENOMINATOR, 0n)
    poolKey = newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)
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
