import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { ChangeFeeReceiver, InvariantInstance, TokenFaucetInstance } from '../artifacts/ts'
import { balanceOf } from '../src/utils'
import { InvariantError } from '../src/consts'
import { expectError, getPool, initFeeTier, withdrawProtocolFee } from '../src/testUtils'
import {
  initBasicFeeTickSpacing,
  initBasicPool,
  initBasicPosition,
  initBasicSwap,
  initDexAndTokens
} from '../src/snippets'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let admin: PrivateKeyWallet
let invariant: InvariantInstance
let tokenX: TokenFaucetInstance
let tokenY: TokenFaucetInstance

describe('protocol fee tests', () => {
  const [fee, tickSpacing] = initBasicFeeTickSpacing()

  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
    ;[invariant, tokenX, tokenY] = await initDexAndTokens(admin)

    await initFeeTier(invariant, admin, fee, tickSpacing)
    await initBasicPool(invariant, admin, tokenX, tokenY)

    const positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
    await initBasicPosition(invariant, positionOwner, tokenX, tokenY)

    const swapper = await getSigner(ONE_ALPH * 1000n, 0)
    await initBasicSwap(invariant, swapper, tokenX, tokenY)
  })

  test('protocol_fee', async () => {
    const poolBefore = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
    await withdrawProtocolFee(invariant, admin, tokenX, tokenY, fee, tickSpacing)
    const adminParams = {
      balanceX: await balanceOf(tokenX.contractId, admin.address),
      balanceY: await balanceOf(tokenY.contractId, admin.address)
    }
    const adminExpected = {
      balanceX: poolBefore.feeProtocolTokenX,
      balanceY: poolBefore.feeProtocolTokenY
    }
    expect(adminParams).toMatchObject(adminExpected)

    const poolAfter = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
    expect(poolAfter).toMatchObject({ feeProtocolTokenX: 0n, feeProtocolTokenY: 0n })
  })

  test('protocol fee_not_admin', async () => {
    const notAdmin = await getSigner(ONE_ALPH * 1000n, 0)

    expectError(
      InvariantError.NotFeeReceiver,
      invariant,
      withdrawProtocolFee(invariant, notAdmin, tokenX, tokenY, fee, tickSpacing)
    )
  })

  test('protocol fee_not_deployer', async () => {
    const poolBefore = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
    const newFeeReceiver = await getSigner(ONE_ALPH * 1000n, 0)

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
    await expectError(
      InvariantError.NotFeeReceiver,
      invariant,
      withdrawProtocolFee(invariant, admin, tokenX, tokenY, fee, tickSpacing)
    )

    await withdrawProtocolFee(invariant, newFeeReceiver, tokenX, tokenY, fee, tickSpacing)
    const newFeeReceiverExpected = {
      balanceX: poolBefore.feeProtocolTokenX,
      balanceY: poolBefore.feeProtocolTokenY
    }
    const newFeeReceiverParams = {
      balanceX: await balanceOf(tokenX.contractId, newFeeReceiver.address),
      balanceY: await balanceOf(tokenY.contractId, newFeeReceiver.address)
    }
    expect(newFeeReceiverParams).toMatchObject(newFeeReceiverExpected)

    const poolAfter = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
    expect(poolAfter).toMatchObject({ feeProtocolTokenX: 0n, feeProtocolTokenY: 0n })
  })
})
