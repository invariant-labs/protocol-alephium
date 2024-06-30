import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { getPool, expectError, initTokensXY, initFeeTier, initPool } from '../src/testUtils'
import { ChangeFeeReceiver, InvariantInstance, TokenFaucetInstance } from '../artifacts/ts'
import { deployInvariant } from '../src/utils'
import { InvariantError } from '../src/consts'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let admin: PrivateKeyWallet
let invariant: InvariantInstance
let tokenX: TokenFaucetInstance
let tokenY: TokenFaucetInstance

describe('change fee receiver tests', () => {
  const protocolFee = 10n ** 10n
  const fee = 6n * 10n ** 9n
  const tickSpacing = 10n

  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
  })

  beforeEach(async () => {
    invariant = await deployInvariant(admin, protocolFee)
    ;[tokenX, tokenY] = await initTokensXY(admin, 0n)

    await initFeeTier(invariant, admin, fee, tickSpacing)

    await initPool(invariant, admin, tokenX, tokenY, fee, tickSpacing, 10n ** 24n, 0n)
  })

  test('test_change_fee_receiver', async () => {
    const newFeeReceiver = await getSigner(ONE_ALPH * 10n, 0)

    await ChangeFeeReceiver.execute(admin, {
      initialFields: {
        invariant: invariant.contractId,
        token0: tokenX.contractId,
        token1: tokenY.contractId,
        fee,
        tickSpacing,
        newFeeReceiver: newFeeReceiver.address
      }
    })

    const pool = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)

    expect(pool.feeReceiver).toBe(newFeeReceiver.address)
  })

  test('test_not_admin_change_fee_receiver', async () => {
    const notAdmin = await getSigner(ONE_ALPH * 1000n, 0)

    await expectError(
      InvariantError.NotAdmin,

      ChangeFeeReceiver.execute(notAdmin, {
        initialFields: {
          invariant: invariant.contractId,
          token0: tokenX.contractId,
          token1: tokenY.contractId,
          fee,
          tickSpacing,
          newFeeReceiver: notAdmin.address
        }
      }),
      invariant
    )
  })
})
