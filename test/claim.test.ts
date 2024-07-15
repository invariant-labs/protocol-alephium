import { DUST_AMOUNT, ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { ClaimFee, InvariantInstance, TokenFaucetInstance } from '../artifacts/ts'
import { balanceOf, newFeeTier, newPoolKey } from '../src/utils'
import { InvariantError } from '../src/consts'
import {
  getPool,
  initFeeTier,
  getPosition,
  expectError,
  getReserveBalances
} from '../src/testUtils'
import {
  getBasicFeeTickSpacing,
  initBasicPool,
  initBasicPosition,
  initBasicSwap,
  initDexAndTokens
} from '../src/snippets'
import { FeeTier, PoolKey } from '../artifacts/ts/types'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let admin: PrivateKeyWallet
let invariant: InvariantInstance
let positionOwner: PrivateKeyWallet
let tokenX: TokenFaucetInstance
let tokenY: TokenFaucetInstance

describe('invariant tests', () => {
  const [fee, tickSpacing] = getBasicFeeTickSpacing()
  let feeTier: FeeTier
  let poolKey: PoolKey
  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
    positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
    ;[invariant, tokenX, tokenY] = await initDexAndTokens(admin)

    feeTier = await newFeeTier(fee, tickSpacing)
    poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    await initFeeTier(invariant, admin, feeTier)
    await initBasicPool(invariant, admin, tokenX, tokenY)
    await initBasicPosition(invariant, positionOwner, tokenX, tokenY)
    const swapper = await getSigner(ONE_ALPH * 1000n, 0)
    await initBasicSwap(invariant, swapper, tokenX, tokenY)
  })

  test('claim', async () => {
    const { x: dexXBefore } = await getReserveBalances(invariant, poolKey)
    const ownerXBefore = await balanceOf(tokenX.contractId, positionOwner.address)

    await ClaimFee.execute(positionOwner, {
      initialFields: {
        invariant: invariant.contractId,
        index: 0n
      },
      attoAlphAmount: DUST_AMOUNT
    })

    const { x: dexXAfter } = await getReserveBalances(invariant, poolKey)
    const ownerXAfter = await balanceOf(tokenX.contractId, positionOwner.address)
    const expectedTokensClaimed = 5n

    expect(ownerXAfter - expectedTokensClaimed).toBe(ownerXBefore)
    expect(dexXAfter + expectedTokensClaimed).toBe(dexXBefore)

    const poolAfter = await getPool(invariant, poolKey)
    const positionAfter = await getPosition(invariant, positionOwner.address, 0n)
    expect(positionAfter).toMatchObject({
      feeGrowthInsideX: poolAfter.feeGrowthGlobalX,
      tokensOwedX: 0n
    })
  })

  test('claim_not_owner', async () => {
    const notOwner = await getSigner(ONE_ALPH * 1000n, 0)
    expectError(
      InvariantError.PositionNotFound,
      ClaimFee.execute(notOwner, {
        initialFields: {
          invariant: invariant.contractId,
          index: 0n
        },
        attoAlphAmount: DUST_AMOUNT
      }),
      invariant
    )
  })
})
