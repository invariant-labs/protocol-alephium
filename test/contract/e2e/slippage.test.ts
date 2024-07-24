import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { TokenFaucetInstance } from '../../../artifacts/ts/'
import { InvariantInstance } from '../../../artifacts/ts'
import { deployInvariant, newFeeTier, newPoolKey } from '../../../src/utils'
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
  initPool
} from '../../../src/testUtils'
import { InvariantError, MaxSqrtPrice } from '../../../src/consts'
import { calculateSqrtPrice, toLiquidity } from '../../../src/math'
import { PoolKey } from '../../../artifacts/ts/types'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let admin: PrivateKeyWallet
let positionOwner: PrivateKeyWallet
let invariant: InvariantInstance
let tokenX: TokenFaucetInstance
let tokenY: TokenFaucetInstance
let poolKey: PoolKey

describe('Invariant Swap Tests', () => {
  const swapAmount = 10n ** 8n
  const [fee, tickSpacing] = getBasicFeeTickSpacing()

  const withdrawAmount = 10n ** 10n

  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
  })

  beforeEach(async () => {
    invariant = await deployInvariant(admin, 10n ** 10n)
    const feeTier = await newFeeTier(fee, tickSpacing)
    await initFeeTier(invariant, admin, feeTier)

    const tokenSupply = 10n ** 23n
    ;[tokenX, tokenY] = await initTokensXY(admin, tokenSupply)
    positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
    await withdrawTokens(positionOwner, [tokenX, withdrawAmount], [tokenY, withdrawAmount])

    const initTick = 0n
    const initSqrtPrice = await calculateSqrtPrice(initTick)

    poolKey = await newPoolKey(tokenX.address, tokenY.address, feeTier)
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

  test('test_basic_slippage', async () => {
    const swapper = await getSigner(ONE_ALPH * 1000n, 0)

    const swapAmount = 10n ** 8n
    await withdrawTokens(swapper, [tokenY, swapAmount])

    const targetSqrtPrice = 1009940000000000000000001n
    await initSwap(invariant, swapper, poolKey, false, swapAmount, true, targetSqrtPrice)

    let expectedSqrtPrice = 1009940000000000000000000n

    const pool = await getPool(invariant, poolKey)

    expect(pool.sqrtPrice).toBe(expectedSqrtPrice)
  })

  test('test_swap_close_to_limit', async () => {
    const feeTier = await newFeeTier(fee, tickSpacing)

    const swapper = await getSigner(ONE_ALPH * 1000n, 0)
    await withdrawTokens(swapper, [tokenX, withdrawAmount], [tokenY, withdrawAmount])
    const poolKey = await newPoolKey(tokenX.address, tokenY.address, feeTier)

    const quoteResult = await quote(invariant, poolKey, false, swapAmount, true, MaxSqrtPrice)

    const targetSqrtPrice = quoteResult.targetSqrtPrice - 1n

    await expectError(
      InvariantError.PriceLimitReached,
      initSwap(invariant, positionOwner, poolKey, false, swapAmount, true, targetSqrtPrice),
      invariant
    )
  })

  test('test_swap_exact_limit', async () => {
    invariant = await deployInvariant(admin, 10n ** 10n)
    const tokenSupply = 10n ** 23n
    ;[tokenX, tokenY] = await initTokensXY(admin, tokenSupply)

    const feeTier = await newFeeTier(fee, tickSpacing)
    await initFeeTier(invariant, admin, feeTier)

    await initBasicPool(invariant, admin, tokenX, tokenY)

    await initBasicPosition(invariant, positionOwner, tokenX, tokenY)

    const swapAmount = 1000n
    const swapper = await getSigner(ONE_ALPH * 1000n, 0)

    await withdrawTokens(swapper, [tokenX, swapAmount])

    const poolKey = await newPoolKey(tokenX.address, tokenY.address, feeTier)

    await swapExactLimit(invariant, swapper, poolKey, true, swapAmount, true)
  })
})
