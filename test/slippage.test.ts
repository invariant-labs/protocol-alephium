import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { TokenFaucetInstance } from '../artifacts/ts/'
import { InvariantInstance } from '../artifacts/ts'
import { deployInvariant, newFeeTier, newPoolKey } from '../src/utils'
import { getBasicFeeTickSpacing, initBasicPool, swapExactLimit } from '../src/snippets'
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
} from '../src/testUtils'
import { InvariantError, LiquidityScale, MaxSqrtPrice, MinSqrtPrice } from '../src/consts'
import { calculateSqrtPrice } from '../src/math'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let admin: PrivateKeyWallet
let positionOwner: PrivateKeyWallet
let invariant: InvariantInstance
let tokenX: TokenFaucetInstance
let tokenY: TokenFaucetInstance

describe('Invariant Swap Tests', () => {
  const swapAmount = 10n ** 8n
  const [fee, tickSpacing] = getBasicFeeTickSpacing()
  const initTick = 0n
  const [lowerTick, upperTick] = [-1000n, 1000n]
  const withdrawAmount = 10n ** 10n

  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
  })

  beforeEach(async () => {
    invariant = await deployInvariant(admin, 0n)

    const tokenSupply = 10n ** 23n
    ;[tokenX, tokenY] = await initTokensXY(admin, tokenSupply)
    positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
    await withdrawTokens(positionOwner, [tokenX, withdrawAmount], [tokenY, withdrawAmount])

    const feeTier = await newFeeTier(fee, tickSpacing)
    await initFeeTier(invariant, admin, feeTier)

    const liquidityDelta = 10_000_000_000n * 10n ** LiquidityScale
    const poolKey = await newPoolKey(tokenX.address, tokenY.address, feeTier)

    const initSqrtPrice = await calculateSqrtPrice(initTick)

    console.log('Init sqrt price:', initSqrtPrice)

    await initPool(invariant, positionOwner, tokenX, tokenY, feeTier, initSqrtPrice, initTick)

    const { sqrtPrice: slippageLimit } = await getPool(invariant, poolKey)

    // const slippageLimit = 1009940000000000000000000n

    // const poolBefore = await getPool(invariant, poolKey)

    // const slippageLimitLower = poolBefore.sqrtPrice
    // const slippageLimitUpper = poolBefore.sqrtPrice

    console.log('Slippage limit:', slippageLimit)

    await initPosition(
      invariant,
      positionOwner,
      poolKey,
      withdrawAmount,
      withdrawAmount,
      lowerTick,
      upperTick,
      liquidityDelta,
      slippageLimit,
      slippageLimit
    )

    expect(await getPool(invariant, poolKey)).toMatchObject({
      liquidity: liquidityDelta,
      poolKey,
      currentTickIndex: 0n
    })
  })

  // test('test_basic_slippage', async () => {
  //   const swapper = await getSigner(ONE_ALPH * 1000n, 0)
  //   await withdrawTokens(swapper, [tokenY, swapAmount])
  //   const targetSqrtPrice = 1009940000000000000000001n
  //   const feeTier = await newFeeTier(fee, tickSpacing)
  //   const poolKey = await newPoolKey(tokenX.address, tokenY.address, feeTier)
  //   await initSwap(invariant, swapper, poolKey, false, swapAmount, true, targetSqrtPrice)
  // })

  test('test_swap_close_to_limit', async () => {
    const feeTier = await newFeeTier(fee, tickSpacing)

    const poolKey = await newPoolKey(tokenX.address, tokenY.address, feeTier)

    const quoteResult = await quote(invariant, poolKey, false, swapAmount, true, MaxSqrtPrice)

    const targetSqrtPrice = quoteResult.targetSqrtPrice - 10n

    console.log(`Quote result`, quoteResult)
    console.log(
      `Quote result.targetPrice`,
      quoteResult.targetSqrtPrice,
      `Target sqrt price`,
      targetSqrtPrice
    )

    const poolStateBefore = await getPool(invariant, poolKey)
    console.log('Pool state before:', JSON.stringify(poolStateBefore, null, 2))

    console.log(targetSqrtPrice)
    // await initSwap(invariant, swapper, poolKey, false, swapAmount, true, targetSqrtPrice)

    await expectError(
      InvariantError.PriceLimitReached,
      initSwap(invariant, positionOwner, poolKey, true, swapAmount, true, targetSqrtPrice),
      invariant
    )
    const poolStateAfter = await getPool(invariant, poolKey)
    console.log(`Pool state after: '${JSON.stringify(poolStateAfter, null, 2)}'`)
  })

  // test('test_swap_exact_limit', async () => {
  //   const swapper = await getSigner(ONE_ALPH * 1000n, 0)
  //   const feeTier = await newFeeTier(fee, tickSpacing)
  //   await withdrawTokens(swapper, [tokenX, swapAmount])

  //   const poolKey = await newPoolKey(tokenX.address, tokenY.address, feeTier)

  //   const poolStateBefore = await getPool(invariant, poolKey)
  //   console.log(`Pool state before: ${poolStateBefore}`)

  //   await swapExactLimit(invariant, swapper, poolKey, true, swapAmount, true)

  //   const poolStateAfter = await getPool(invariant, poolKey)
  //   console.log(poolStateAfter)
  // })
})
