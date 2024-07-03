import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { deployInvariant, newFeeTier, newPoolKey } from '../src/utils'
import { MaxSqrtPrice, PercentageScale } from '../src/consts'
import {
  getPool,
  initPool,
  initFeeTier,
  initTokensXY,
  initPosition,
  withdrawTokens
} from '../src/testUtils'
import { InvariantInstance } from '../artifacts/ts'
import { FeeTier } from '../artifacts/ts/types'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let admin: PrivateKeyWallet
let positionOwner: PrivateKeyWallet
let invariant: InvariantInstance
describe('manage multiple tokens', () => {
  const protocolFee = 10n ** (PercentageScale - 2n)
  const fee = 5n * 10n ** (PercentageScale - 1n)
  const tickSpacing = 10n
  let feeTier: FeeTier

  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
    positionOwner = await getSigner(ONE_ALPH * 1000n, 0)

    invariant = await deployInvariant(admin, protocolFee)
    feeTier = await newFeeTier(fee, tickSpacing)
    await initFeeTier(invariant, admin, feeTier)
  })
  test('init 5 pools and open position on each of them, invariant manages 10 assets', async () => {
    for (let i = 0n; i < 5n; i++) {
      const supply = 100n
      const [tokenX, tokenY] = await initTokensXY(admin, supply)
      const poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

      await withdrawTokens(positionOwner, [tokenX, supply], [tokenY, supply])

      const initTick = 0n
      const initSqrtPrice = 10n ** 24n
      await initPool(invariant, positionOwner, tokenX, tokenY, feeTier, initSqrtPrice, initTick)

      const pool = await getPool(invariant, poolKey)
      const expectedPool = {
        currentTickIndex: initTick,
        sqrtPrice: initSqrtPrice,
        feeGrowthGlobalX: 0n,
        feeGrowthGlobalY: 0n,
        feeProtocolTokenX: 0n,
        feeProtocolTokenY: 0n,
        liquidity: 0n,
        poolKey,
        feeReceiver: admin.address,
        exist: true
      }
      expect(pool).toMatchObject(expectedPool)
      const lowerTickIndex = -10n
      const upperTickIndex = 10n
      const liquidityDelta = 100n

      await initPosition(
        invariant,
        positionOwner,
        poolKey,
        supply,
        supply,
        lowerTickIndex,
        upperTickIndex,
        liquidityDelta,
        0n,
        MaxSqrtPrice
      )
    }
  })
})
