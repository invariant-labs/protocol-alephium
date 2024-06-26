import { DUST_AMOUNT, ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { ClaimFee, InvariantInstance, TokenFaucetInstance } from '../artifacts/ts'
import { balanceOf } from '../src/utils'
import { InvariantError } from '../src/consts'
import { getPool, initFeeTier, getPosition, expectError } from '../src/testUtils'
import {
  getBasicFeeTickSpacing,
  initBasicPool,
  initBasicPosition,
  initBasicSwap,
  initDexAndTokens
} from '../src/snippets'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let admin: PrivateKeyWallet
let invariant: InvariantInstance
let positionOwner: PrivateKeyWallet
let tokenX: TokenFaucetInstance
let tokenY: TokenFaucetInstance

describe('invariant tests', () => {
  const [fee, tickSpacing] = getBasicFeeTickSpacing()

  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
    positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
    ;[invariant, tokenX, tokenY] = await initDexAndTokens(admin)

    await initFeeTier(invariant, admin, fee, tickSpacing)
    await initBasicPool(invariant, admin, tokenX, tokenY)
    await initBasicPosition(invariant, positionOwner, tokenX, tokenY)
    const swapper = await getSigner(ONE_ALPH * 1000n, 0)
    await initBasicSwap(invariant, swapper, tokenX, tokenY)
  })

  test('claim', async () => {
    const tokenXBeforeBalance = {
      invariant: await balanceOf(tokenX.contractId, positionOwner.address),
      positionOwner: await balanceOf(tokenX.contractId, invariant.address)
    }
    const tokenYBeforeBalance = {
      invariant: await balanceOf(tokenY.contractId, positionOwner.address),
      positionOwner: await balanceOf(tokenY.contractId, invariant.address)
    }

    await ClaimFee.execute(positionOwner, {
      initialFields: {
        invariant: invariant.contractId,
        index: 1n
      },
      attoAlphAmount: DUST_AMOUNT
    })

    const tokenXAfterBalance = {
      invariant: await balanceOf(tokenX.contractId, positionOwner.address),
      positionOwner: await balanceOf(tokenX.contractId, invariant.address)
    }
    const tokenYAfterBalance = {
      invariant: await balanceOf(tokenY.contractId, positionOwner.address),
      positionOwner: await balanceOf(tokenY.contractId, invariant.address)
    }

    const tokenXChange = {
      invariant: tokenXBeforeBalance.invariant - tokenXAfterBalance.invariant,
      positionOwner: tokenXBeforeBalance.positionOwner - tokenXAfterBalance.positionOwner
    }

    expect(tokenXChange).toMatchObject({ invariant: -5n, positionOwner: 5n })
    expect(tokenYAfterBalance).toMatchObject(tokenYBeforeBalance)

    const poolAfter = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
    const positionAfter = await getPosition(invariant, positionOwner.address, 1n)
    expect(positionAfter).toMatchObject({
      feeGrowthInsideX: poolAfter.feeGrowthGlobalX,
      tokensOwedX: 0n
    })
  })

  test('claim_not_owner', async () => {
    const notOwner = await getSigner(ONE_ALPH * 1000n, 0)
    expectError(
      InvariantError.PositionDoesNotExist,
      invariant,
      ClaimFee.execute(notOwner, {
        initialFields: {
          invariant: invariant.contractId,
          index: 1n
        },
        attoAlphAmount: DUST_AMOUNT
      })
    )
  })
})
