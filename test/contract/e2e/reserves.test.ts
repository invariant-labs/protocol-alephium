import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { deployInvariant, newFeeTier, newPoolKey } from '../../../src/utils'
import { MAX_SQRT_PRICE } from '../../../src/consts'
import {
  getPool,
  initPool,
  initFeeTier,
  initTokensXY,
  initPosition,
  withdrawTokens
} from '../../../src/testUtils'
import { InvariantInstance } from '../../../artifacts/ts'
import {
  getBasicFeeTickSpacing,
  initBasicPool,
  initBasicPosition,
  initBasicSwap
} from '../../../src/snippets'
import { FeeTier, Liquidity, SqrtPrice, TokenAmount } from '../../../src/types'
import { toPercentage, toSqrtPrice } from '../../../src'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let admin: PrivateKeyWallet
let positionOwner: PrivateKeyWallet
let swapper: PrivateKeyWallet
let invariant: InvariantInstance
describe('reserves tests - manage multiple tokens', () => {
  const protocolFee = toPercentage(1n, 2n)
  const [fee, tickSpacing] = getBasicFeeTickSpacing()
  let feeTier: FeeTier

  beforeEach(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
    positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
    swapper = await getSigner(ONE_ALPH * 1000n, 0)

    invariant = await deployInvariant(admin, protocolFee)
    feeTier = await newFeeTier(fee, tickSpacing)
    await initFeeTier(invariant, admin, feeTier)
  })
  test('init 5 pools and open position on each of them, invariant manages 10 assets', async () => {
    for (let i = 0n; i < 5n; i++) {
      const supply = 100n as TokenAmount
      const [tokenX, tokenY] = await initTokensXY(admin, supply)
      const poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

      await withdrawTokens(positionOwner, [tokenX, supply], [tokenY, supply])

      const initTick = 0n
      const initSqrtPrice = toSqrtPrice(1n)
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
        feeReceiver: admin.address
      }
      expect(pool).toMatchObject(expectedPool)
      const lowerTickIndex = -10n
      const upperTickIndex = 10n
      const liquidityDelta = 100n as Liquidity

      await initPosition(
        invariant,
        positionOwner,
        poolKey,
        supply,
        supply,
        lowerTickIndex,
        upperTickIndex,
        liquidityDelta,
        0n as SqrtPrice,
        MAX_SQRT_PRICE
      )
    }
  })
  test('pool where assets are stored in different reserves', async () => {
    const supply = 1000000n as TokenAmount
    let firstReserveId: string = ''
    // Perform operations on 2 pools - 4 Tokens in Reserve
    for (let i = 0n; i < 2n; i++) {
      const [tokenX, tokenY] = await initTokensXY(admin, supply)
      const poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)
      await initBasicPool(invariant, admin, tokenX, tokenY)
      await initBasicPosition(invariant, positionOwner, tokenX, tokenY)
      await initBasicSwap(invariant, swapper, tokenX, tokenY)
      const pool = await getPool(invariant, poolKey)
      expect(pool.reserveX).toBe(pool.reserveY)
      firstReserveId = pool.reserveX
    }
    {
      const [tokenX, tokenY] = await initTokensXY(admin, supply)
      const [tokenZ] = await initTokensXY(admin, supply)
      // Init 3rd pool - 6 Tokens in Reserve
      {
        const poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)
        await initBasicPool(invariant, admin, tokenX, tokenY)
        await initBasicPosition(invariant, positionOwner, tokenX, tokenY)
        await initBasicSwap(invariant, swapper, tokenX, tokenY)
        const pool = await getPool(invariant, poolKey)
        expect(pool.reserveX).toBe(pool.reserveY)
      }
      // Init 4th pool - 7 tokens in Reserve
      {
        const poolKey = await newPoolKey(tokenX.contractId, tokenZ.contractId, feeTier)
        await initBasicPool(invariant, admin, tokenX, tokenZ)
        await initBasicPosition(invariant, positionOwner, tokenX, tokenZ)
        const pool = await getPool(invariant, poolKey)
        expect(pool.reserveX).toBe(pool.reserveY)
      }
    }
    // Init 5th Pool where assets are stored in different reserves
    {
      const [tokenX, tokenY] = await initTokensXY(admin, supply)
      const poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)
      await initBasicPool(invariant, admin, tokenX, tokenY)
      await initBasicPosition(invariant, positionOwner, tokenX, tokenY)
      await initBasicSwap(invariant, swapper, tokenX, tokenY)
      const pool = await getPool(invariant, poolKey)
      expect(pool.reserveX).not.toBe(pool.reserveY)
      expect(pool.reserveX).toBe(firstReserveId)
    }
  })
})
