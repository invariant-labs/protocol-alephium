import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import {
  getBasicFeeTickSpacing,
  initBasicPool,
  initBasicPosition,
  initDexAndTokens
} from '../../../src/snippets'
import { newFeeTier, newPoolKey } from '../../../src/utils'
import {
  expectError,
  getPool,
  getPosition,
  getPositionWithAssociates,
  getTick,
  initFeeTier
} from '../../../src/testUtils'
import { InvariantInstance, TokenFaucetInstance } from '../../../artifacts/ts'
import { InvariantError } from '../../../src'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let admin: PrivateKeyWallet
let invariant: InvariantInstance
let positionOwner: PrivateKeyWallet
let tokenX: TokenFaucetInstance
let tokenY: TokenFaucetInstance

describe('get position with associates tests', () => {
  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
    ;[invariant, tokenX, tokenY] = await initDexAndTokens(admin)
    positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
    const feeTier = await newFeeTier(...getBasicFeeTickSpacing())

    await initFeeTier(invariant, admin, feeTier)
    await initBasicPool(invariant, positionOwner, tokenX, tokenY)
    await initBasicPosition(invariant, positionOwner, tokenX, tokenY)
  })

  test('get position with associates', async () => {
    const feeTier = await newFeeTier(...getBasicFeeTickSpacing())
    const poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    const [lowerTickIndex, upperTickIndex] = [-20n, 10n]

    const positionRegular = await getPosition(invariant, positionOwner.address, 0n)
    delete positionRegular.exists
    const poolRegular = await getPool(invariant, poolKey)
    delete poolRegular.exists
    const lowerTickRegular = await getTick(invariant, poolKey, lowerTickIndex)
    delete lowerTickRegular.exists
    const upperTickRegular = await getTick(invariant, poolKey, upperTickIndex)
    delete upperTickRegular.exists

    const [position, pool, lowerTick, upperTick] = await getPositionWithAssociates(
      invariant,
      positionOwner.address,
      0n
    )

    expect(position).toStrictEqual(positionRegular)
    expect(pool).toStrictEqual(poolRegular)
    expect(lowerTick).toStrictEqual(lowerTickRegular)
    expect(upperTick).toStrictEqual(upperTickRegular)
  })

  test('non-existent position', async () => {
    await expectError(
      InvariantError.PositionNotFound,
      getPositionWithAssociates(invariant, positionOwner.address, 1n),
      invariant
    )
  })
})
