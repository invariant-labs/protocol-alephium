import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { getBasicFeeTickSpacing, initBasicPool, initDexAndTokens } from '../../../src/snippets'
import { newFeeTier, newPoolKey } from '../../../src/utils'
import {
  expectError,
  getPool,
  getTick,
  initFeeTier,
  initPosition,
  initSwap,
  withdrawTokens
} from '../../../src/testUtils'
import { InvariantError, MAX_SQRT_PRICE, MIN_SQRT_PRICE } from '../../../src/consts'
import { calculateSqrtPrice, toLiquidity } from '../../../src/math'
import { InvariantInstance, TokenFaucetInstance } from '../../../artifacts/ts'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let admin: PrivateKeyWallet
let invariant: InvariantInstance
let tokenX: TokenFaucetInstance
let tokenY: TokenFaucetInstance
let positionsOwner: PrivateKeyWallet
let swapper: PrivateKeyWallet

describe('cross tests', () => {
  const [fee, tickSpacing] = getBasicFeeTickSpacing()
  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 100000n, 0)
  })
  beforeEach(async () => {
    ;[invariant, tokenX, tokenY] = await initDexAndTokens(admin, 10n ** 24n)
    const feeTier = await newFeeTier(fee, tickSpacing)
    await initFeeTier(invariant, admin, feeTier)
    const poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    positionsOwner = await getSigner(ONE_ALPH * 1000n, 0)
    await initBasicPool(invariant, positionsOwner, tokenX, tokenY)
    // init positions
    {
      const mintAmount = 10n ** 5n
      const positionAmount = mintAmount / 2n
      await withdrawTokens(positionsOwner, [tokenX, mintAmount], [tokenY, mintAmount])
      const [lowerTick, middleTick, upperTick] = [-20n, -10n, 10n]
      const liquidityDelta = toLiquidity(20006000n)

      const { sqrtPrice: slippageLimit } = await getPool(invariant, poolKey)

      await initPosition(
        invariant,
        positionsOwner,
        poolKey,
        positionAmount,
        positionAmount,
        lowerTick,
        middleTick,
        liquidityDelta,
        slippageLimit,
        slippageLimit
      )
      await initPosition(
        invariant,
        positionsOwner,
        poolKey,
        positionAmount,
        positionAmount,
        middleTick,
        upperTick,
        liquidityDelta,
        slippageLimit,
        slippageLimit
      )

      expect(await getPool(invariant, poolKey)).toMatchObject({ liquidity: liquidityDelta })
    }

    swapper = await getSigner(ONE_ALPH * 1000n, 0)
    const limitWithoutCrossTickAmount = 10_068n

    await withdrawTokens(
      swapper,
      [tokenX, limitWithoutCrossTickAmount],
      [tokenY, limitWithoutCrossTickAmount]
    )

    // no tick crossing
    const { liquidity: beforeLiquidity } = await getPool(invariant, poolKey)

    await initSwap(
      invariant,
      swapper,
      poolKey,
      true,
      limitWithoutCrossTickAmount,
      true,
      MIN_SQRT_PRICE
    )

    expect(await getPool(invariant, poolKey)).toMatchObject({
      currentTickIndex: -10n,
      sqrtPrice: await calculateSqrtPrice(-10n),
      liquidity: beforeLiquidity
    })
  })

  test('both sides', async () => {
    const feeTier = await newFeeTier(fee, tickSpacing)
    const poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    const minAmountToCrossFromTickPrice = 3n
    await withdrawTokens(
      swapper,
      [tokenX, minAmountToCrossFromTickPrice],
      [tokenY, minAmountToCrossFromTickPrice]
    )

    // cross between different positions' ticks minimally
    {
      await initSwap(
        invariant,
        swapper,
        poolKey,
        true,
        minAmountToCrossFromTickPrice,
        true,
        MIN_SQRT_PRICE
      )

      await initSwap(
        invariant,
        swapper,
        poolKey,
        false,
        minAmountToCrossFromTickPrice,
        true,
        MAX_SQRT_PRICE
      )
    }
    // a new position with massive liquidity
    {
      const mintAmount = 10n ** 19n
      await withdrawTokens(positionsOwner, [tokenX, mintAmount], [tokenY, mintAmount])

      const [lowerTick, upperTick] = [-20n, 0n]
      const liquidityDelta = toLiquidity(19996000399699881985603n)
      await initPosition(
        invariant,
        positionsOwner,
        poolKey,
        mintAmount,
        mintAmount,
        lowerTick,
        upperTick,
        liquidityDelta,
        MIN_SQRT_PRICE,
        MAX_SQRT_PRICE
      )
    }
    {
      const predictedRequiredX = 3n
      const xOut = 1n
      const yIn = 2n
      await withdrawTokens(swapper, [tokenX, predictedRequiredX])

      await initSwap(
        invariant,
        swapper,
        poolKey,
        true,
        xOut,
        false,
        MIN_SQRT_PRICE,
        predictedRequiredX
      )
      await initSwap(invariant, swapper, poolKey, false, yIn, true, MAX_SQRT_PRICE)

      const expectedLiquidity = toLiquidity(19996000399699901991603n)
      expect(await getPool(invariant, poolKey)).toMatchObject({
        currentTickIndex: -20n,
        feeGrowthGlobalX: 29991002699190242927121n,
        feeGrowthGlobalY: 0n,
        feeProtocolTokenX: 4n,
        feeProtocolTokenY: 2n,
        liquidity: expectedLiquidity,
        sqrtPrice: 999500149964999999999999n
      })

      expect(await getTick(invariant, poolKey, -20n)).toMatchObject({
        liquidityChange: toLiquidity(19996000399699901991603n),
        feeGrowthOutsideX: 0n,
        feeGrowthOutsideY: 0n
      })

      expect(await getTick(invariant, poolKey, -10n)).toMatchObject({
        liquidityChange: 0n,
        feeGrowthOutsideX: 29991002699190242927121n,
        feeGrowthOutsideY: 0n
      })

      expect(await getTick(invariant, poolKey, 10n)).toMatchObject({
        liquidityChange: toLiquidity(20006000n),
        feeGrowthOutsideX: 0n,
        feeGrowthOutsideY: 0n
      })
    }
  })

  test('both sides do not cross', async () => {
    const feeTier = await newFeeTier(fee, tickSpacing)
    const poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    const notCrossAmount = 1n
    await withdrawTokens(swapper, [tokenX, notCrossAmount])

    await expectError(
      InvariantError.NoGainSwap,
      initSwap(invariant, swapper, poolKey, true, notCrossAmount, true, MIN_SQRT_PRICE),
      invariant
    )
  })
})
