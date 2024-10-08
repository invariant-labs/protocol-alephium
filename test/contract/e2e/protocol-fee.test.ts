import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { InvariantInstance, TokenFaucetInstance } from '../../../artifacts/ts'
import { balanceOf, newFeeTier, newPoolKey } from '../../../src/utils'
import { InvariantError } from '../../../src/consts'
import {
  changeFeeReceiver,
  expectError,
  getPool,
  initFeeTier,
  withdrawProtocolFee
} from '../../../src/testUtils'
import {
  getBasicFeeTickSpacing,
  initBasicPool,
  initBasicPosition,
  initBasicSwap,
  initDexAndTokens
} from '../../../src/snippets'
import { FeeTier, PoolKey } from '../../../src/types'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let admin: PrivateKeyWallet
let invariant: InvariantInstance
let tokenX: TokenFaucetInstance
let tokenY: TokenFaucetInstance
let feeTier: FeeTier
let poolKey: PoolKey
describe('protocol fee tests', () => {
  const [fee, tickSpacing] = getBasicFeeTickSpacing()

  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
  })
  beforeEach(async () => {
    ;[invariant, tokenX, tokenY] = await initDexAndTokens(admin)

    feeTier = newFeeTier(fee, tickSpacing)
    poolKey = newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)
    await initFeeTier(invariant, admin, feeTier)
    await initBasicPool(invariant, admin, tokenX, tokenY)

    const positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
    await initBasicPosition(invariant, positionOwner, tokenX, tokenY)

    const swapper = await getSigner(ONE_ALPH * 1000n, 0)
    await initBasicSwap(invariant, swapper, tokenX, tokenY)
  })

  test('protocol fee', async () => {
    const poolBefore = await getPool(invariant, poolKey)
    await withdrawProtocolFee(invariant, admin, poolKey)
    const adminParams = {
      balanceX: await balanceOf(tokenX.contractId, admin.address),
      balanceY: await balanceOf(tokenY.contractId, admin.address)
    }
    const adminExpected = {
      balanceX: poolBefore.feeProtocolTokenX,
      balanceY: poolBefore.feeProtocolTokenY
    }
    expect(adminParams).toMatchObject(adminExpected)

    const poolAfter = await getPool(invariant, poolKey)
    expect(poolAfter).toMatchObject({ feeProtocolTokenX: 0n, feeProtocolTokenY: 0n })
  })

  test('not admin', async () => {
    const notAdmin = await getSigner(ONE_ALPH * 1000n, 0)

    await expectError(
      InvariantError.NotFeeReceiver,
      withdrawProtocolFee(invariant, notAdmin, poolKey),
      invariant
    )
  })

  test('not deployer', async () => {
    const poolBefore = await getPool(invariant, poolKey)
    const newFeeReceiver = await getSigner(ONE_ALPH * 1000n, 0)

    await changeFeeReceiver(invariant, admin, poolKey, newFeeReceiver.address)
    await expectError(
      InvariantError.NotFeeReceiver,
      withdrawProtocolFee(invariant, admin, poolKey),
      invariant
    )

    await withdrawProtocolFee(invariant, newFeeReceiver, poolKey)
    const newFeeReceiverExpected = {
      balanceX: poolBefore.feeProtocolTokenX,
      balanceY: poolBefore.feeProtocolTokenY
    }
    const newFeeReceiverParams = {
      balanceX: await balanceOf(tokenX.contractId, newFeeReceiver.address),
      balanceY: await balanceOf(tokenY.contractId, newFeeReceiver.address)
    }
    expect(newFeeReceiverParams).toMatchObject(newFeeReceiverExpected)

    const poolAfter = await getPool(invariant, poolKey)
    expect(poolAfter).toMatchObject({ feeProtocolTokenX: 0n, feeProtocolTokenY: 0n })
  })
})
