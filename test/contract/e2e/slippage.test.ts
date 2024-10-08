import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { TokenFaucetInstance } from '../../../artifacts/ts/'
import { InvariantInstance } from '../../../artifacts/ts'
import { newFeeTier, newPoolKey } from '../../../src/utils'
import {
  getBasicFeeTickSpacing,
  initBasicPool,
  initBasicPosition,
  swapExactLimit
} from '../../../src/snippets'
import {
  initFeeTier,
  initSwap,
  quote,
  expectError,
  withdrawTokens,
  initPosition,
  getPool,
  initTokensXY,
  initPool,
  deployInvariant
} from '../../../src/testUtils'
import { InvariantError, MAX_SQRT_PRICE } from '../../../src/consts'
import { calculateSqrtPrice, toLiquidity, toPercentage } from '../../../src/math'
import { PoolKey, SqrtPrice, TokenAmount } from '../../../src/types'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let admin: PrivateKeyWallet
let positionOwner: PrivateKeyWallet
let invariant: InvariantInstance
let tokenX: TokenFaucetInstance
let tokenY: TokenFaucetInstance
let poolKey: PoolKey

describe('slippage tests', () => {
  const swapAmount = (10n ** 8n) as TokenAmount
  const [fee, tickSpacing] = getBasicFeeTickSpacing()

  const withdrawAmount = (10n ** 10n) as TokenAmount

  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
  })

  beforeEach(async () => {
    invariant = await deployInvariant(admin, toPercentage(1n, 2n))
    const feeTier = newFeeTier(fee, tickSpacing)
    await initFeeTier(invariant, admin, feeTier)

    const tokenSupply = (10n ** 23n) as TokenAmount
    ;[tokenX, tokenY] = await initTokensXY(admin, tokenSupply)
    positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
    await withdrawTokens(positionOwner, [tokenX, withdrawAmount], [tokenY, withdrawAmount])

    const initTick = 0n
    const initSqrtPrice = calculateSqrtPrice(initTick)

    poolKey = newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)
    await initPool(invariant, positionOwner, tokenX, tokenY, feeTier, initSqrtPrice, initTick)

    const [lowerTick, upperTick] = [-1000n, 1000n]

    const liquidityDelta = toLiquidity(10_000_000_000n)

    const poolBefore = await getPool(invariant, poolKey)

    const slippageLimitLower = poolBefore.sqrtPrice
    const slippageLimitUpper = poolBefore.sqrtPrice

    await initPosition(
      invariant,
      positionOwner,
      poolKey,
      withdrawAmount,
      withdrawAmount,
      lowerTick,
      upperTick,
      liquidityDelta,
      slippageLimitLower,
      slippageLimitUpper
    )

    expect(await getPool(invariant, poolKey)).toMatchObject({
      liquidity: liquidityDelta,
      poolKey,
      currentTickIndex: 0n
    })
  })

  test('basic slippage', async () => {
    const swapper = await getSigner(ONE_ALPH * 1000n, 0)

    const swapAmount = (10n ** 8n) as TokenAmount
    await withdrawTokens(swapper, [tokenY, swapAmount])

    const targetSqrtPrice = 1009940000000000000000001n as SqrtPrice
    await initSwap(invariant, swapper, poolKey, false, swapAmount, true, targetSqrtPrice)

    let expectedSqrtPrice = 1009940000000000000000000n

    const pool = await getPool(invariant, poolKey)

    expect(pool.sqrtPrice).toBe(expectedSqrtPrice)
  })

  test('swap close to limit', async () => {
    const feeTier = newFeeTier(fee, tickSpacing)

    const swapper = await getSigner(ONE_ALPH * 1000n, 0)
    await withdrawTokens(swapper, [tokenX, withdrawAmount], [tokenY, withdrawAmount])
    const poolKey = newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    const quoteResult = await quote(invariant, poolKey, false, swapAmount, true, MAX_SQRT_PRICE)

    const targetSqrtPrice = (quoteResult.targetSqrtPrice - 1n) as SqrtPrice

    await expectError(
      InvariantError.PriceLimitReached,
      initSwap(invariant, positionOwner, poolKey, false, swapAmount, true, targetSqrtPrice),
      invariant
    )
  })

  test('swap exact limit', async () => {
    invariant = await deployInvariant(admin, toPercentage(1n, 2n))
    const tokenSupply = (10n ** 23n) as TokenAmount
    ;[tokenX, tokenY] = await initTokensXY(admin, tokenSupply)

    const feeTier = newFeeTier(fee, tickSpacing)
    await initFeeTier(invariant, admin, feeTier)

    await initBasicPool(invariant, admin, tokenX, tokenY)

    await initBasicPosition(invariant, positionOwner, tokenX, tokenY)

    const swapAmount = 1000n as TokenAmount
    const swapper = await getSigner(ONE_ALPH * 1000n, 0)

    await withdrawTokens(swapper, [tokenX, swapAmount])

    const poolKey = newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    await swapExactLimit(invariant, swapper, poolKey, true, swapAmount, true)
  })
})
