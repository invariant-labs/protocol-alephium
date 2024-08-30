import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { InvariantInstance, TokenFaucetInstance } from '../../../artifacts/ts'
import { balanceOf, deployInvariant, newFeeTier, newPoolKey } from '../../../src/utils'
import { InvariantError, MIN_SQRT_PRICE } from '../../../src/consts'
import {
  expectError,
  getPool,
  getPosition,
  getReserveBalances,
  getTick,
  initFeeTier,
  initPool,
  initPosition,
  initSwap,
  initTokensXY,
  quote,
  withdrawTokens
} from '../../../src/testUtils'
import { calculateSqrtPrice, toLiquidity, toPercentage, toSqrtPrice } from '../../../src/math'
import { FeeTier, PoolKey, TokenAmount } from '../../../src/types'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

describe('liquidity gap tests', () => {
  const mintAmount = (10n ** 10n) as TokenAmount
  let deployer: PrivateKeyWallet
  let positionOwner: PrivateKeyWallet
  let swapper: PrivateKeyWallet
  let invariant: InvariantInstance
  let tokenX: TokenFaucetInstance
  let tokenY: TokenFaucetInstance
  let feeTier: FeeTier
  let poolKey: PoolKey
  const fee = toPercentage(6n, 3n)
  const tickSpacing = 10n
  const initTick = 0n
  const initSqrtPrice = toSqrtPrice(1n)

  beforeAll(async () => {
    deployer = await getSigner(ONE_ALPH * 1000n, 0)
    positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
    swapper = await getSigner(ONE_ALPH * 1000n, 0)

    const protocolFee = toPercentage(1n, 2n)
    invariant = await deployInvariant(deployer, protocolFee)
    ;[tokenX, tokenY] = await initTokensXY(deployer, mintAmount)
    feeTier = newFeeTier(fee, tickSpacing)
    await initFeeTier(invariant, deployer, feeTier)
    poolKey = newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)
    await initPool(invariant, deployer, tokenX, tokenY, feeTier, initSqrtPrice, initTick)
  })
  test('init position', async () => {
    const amount = (10n ** 6n) as TokenAmount
    const lowerTick = -10n
    const upperTick = 10n
    const liquidityDelta = toLiquidity(20006000n)
    await withdrawTokens(positionOwner, [tokenX, amount], [tokenY, amount])

    const poolBefore = await getPool(invariant, poolKey)
    const [slippageLimitLower, slippageLimitUpper] = [poolBefore.sqrtPrice, poolBefore.sqrtPrice]

    await initPosition(
      invariant,
      positionOwner,
      poolKey,
      amount,
      amount,
      lowerTick,
      upperTick,
      liquidityDelta,
      slippageLimitLower,
      slippageLimitUpper
    )

    const poolAfter = await getPool(invariant, poolKey)
    expect(poolAfter.liquidity).toEqual(liquidityDelta)
  })
  test('init swap', async () => {
    const amount = 10067n as TokenAmount
    await withdrawTokens(swapper, [tokenX, amount], [tokenY, amount])

    const { x: dexXBefore, y: dexYBefore } = await getReserveBalances(invariant, poolKey)

    const slippage = MIN_SQRT_PRICE

    const { targetSqrtPrice } = await quote(invariant, poolKey, true, amount, true, slippage)

    await initSwap(invariant, swapper, poolKey, true, amount, true, targetSqrtPrice)

    const pool = await getPool(invariant, poolKey)
    const expectedSqrtPrice = calculateSqrtPrice(-10n)
    const expectedYAmountOut = 9999n
    const liquidityDelta = toLiquidity(20006000n)
    const lowerTick = -10n

    expect(pool.sqrtPrice).toEqual(expectedSqrtPrice)
    expect(pool.liquidity).toEqual(liquidityDelta)
    expect(pool.currentTickIndex).toEqual(lowerTick)

    const swapperX = await balanceOf(tokenX.contractId, swapper.address)
    const swapperY = await balanceOf(tokenY.contractId, swapper.address)
    const { x: dexX, y: dexY } = await getReserveBalances(invariant, poolKey)

    const deltaDexX = dexX - dexXBefore
    const deltaDexY = dexYBefore - dexY

    expect(swapperX).toEqual(0n)
    expect(swapperY).toEqual(expectedYAmountOut + amount)
    expect(deltaDexX).toEqual(amount)
    expect(deltaDexY).toEqual(expectedYAmountOut)
    expect(pool.feeGrowthGlobalX).toEqual(29991002699190242927121n)
    expect(pool.feeGrowthGlobalY).toEqual(0n)
    expect(pool.feeProtocolTokenX).toEqual(1n)
    expect(pool.feeProtocolTokenY).toEqual(0n)
  })
  test('open second position non-adjacent to the previous one, consequently creating a gap in liquidity', async () => {
    const lowerTick = -90n
    const upperTick = -50n
    const liquidityDelta = toLiquidity(20008000n)
    const amount = (10n ** 6n) as TokenAmount
    await withdrawTokens(positionOwner, [tokenX, amount], [tokenY, amount])

    const poolBefore = await getPool(invariant, poolKey)

    const [slippageLimitLower, slippageLimitUpper] = [poolBefore.sqrtPrice, poolBefore.sqrtPrice]

    await initPosition(
      invariant,
      positionOwner,
      poolKey,
      amount,
      amount,
      lowerTick,
      upperTick,
      liquidityDelta,
      slippageLimitLower,
      slippageLimitUpper
    )
  })
  test('should skip gap and then swap', async () => {
    const amount = 10067n as TokenAmount
    await withdrawTokens(swapper, [tokenX, amount], [tokenY, amount])

    const slippage = MIN_SQRT_PRICE

    const { targetSqrtPrice } = await quote(invariant, poolKey, true, amount, true, slippage)

    await initSwap(invariant, swapper, poolKey, true, amount, true, targetSqrtPrice)

    const pool = await getPool(invariant, poolKey)
    const firstPosition = await getPosition(invariant, positionOwner.address, 0n)
    const secondPosition = await getPosition(invariant, positionOwner.address, 1n)

    const lowerTick = await getTick(invariant, poolKey, -50n)
    const upperTick = await getTick(invariant, poolKey, -10n)

    const expectedFirstPosition = {
      liquidity: 2000600000000n,
      lowerTickIndex: -10n,
      upperTickIndex: 10n,
      feeGrowthInsideX: 0n,
      feeGrowthInsideY: 0n,
      tokensOwedX: 0n,
      tokensOwedY: 0n,
      owner: positionOwner.address
    }
    const expectedSecondPosition = {
      liquidity: 2000800000000n,
      lowerTickIndex: -90n,
      upperTickIndex: -50n,
      feeGrowthInsideX: 0n,
      feeGrowthInsideY: 0n,
      tokensOwedX: 0n,
      tokensOwedY: 0n,
      owner: positionOwner.address
    }
    expect(firstPosition).toMatchObject(expectedFirstPosition)
    expect(secondPosition).toMatchObject(expectedSecondPosition)

    await expectError(InvariantError.InvalidTickIndex, getTick(invariant, poolKey, -60n))

    const expectedLowerTick = {
      sign: false,
      index: -50n,
      liquidityChange: secondPosition.liquidity,
      liquidityGross: secondPosition.liquidity,
      sqrtPrice: calculateSqrtPrice(-50n),
      feeGrowthOutsideX: 0n,
      feeGrowthOutsideY: 0n
    }
    const expectedUpperTick = {
      sign: true,
      index: -10n,
      liquidityChange: firstPosition.liquidity,
      liquidityGross: firstPosition.liquidity,
      sqrtPrice: calculateSqrtPrice(-10n),
      feeGrowthOutsideX: 29991002699190242927121n,
      feeGrowthOutsideY: 0n
    }

    expect(lowerTick).toMatchObject(expectedLowerTick)
    expect(upperTick).toMatchObject(expectedUpperTick)

    const expectedPool = {
      poolKey,
      liquidity: secondPosition.liquidity,
      currentTickIndex: -60n,
      feeGrowthGlobalX: 59979007497271010620043n,
      feeGrowthGlobalY: 0n,
      feeProtocolTokenX: 2n,
      feeProtocolTokenY: 0n,
      feeReceiver: deployer.address
    }
    expect(pool).toMatchObject(expectedPool)
  })
})
