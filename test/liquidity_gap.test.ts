import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { InvariantInstance, TokenFaucetInstance } from '../artifacts/ts'
import { balanceOf, deployInvariant, newFeeTier, newPoolKey } from '../src/utils'
import { LiquidityScale, MinSqrtPrice, PercentageScale } from '../src/consts'
import {
  getPool,
  getPosition,
  getTick,
  initFeeTier,
  initPool,
  initPositionWithLiquidity,
  initSwap,
  initTokensXY,
  quote,
  withdrawTokens
} from '../src/testUtils'
import { FeeTier, PoolKey } from '../artifacts/ts/types'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

describe('liquidity gap tests', () => {
  const mintAmount = 10n ** 10n
  let deployer: PrivateKeyWallet
  let positionOwner: PrivateKeyWallet
  let swapper: PrivateKeyWallet
  let invariant: InvariantInstance
  let tokenX: TokenFaucetInstance
  let tokenY: TokenFaucetInstance
  let feeTier: FeeTier
  let poolKey: PoolKey
  const fee = 6n * 10n ** (PercentageScale - 3n)
  const tickSpacing = 10n
  const initTick = 0n
  const initSqrtPrice = 10n ** 24n

  beforeAll(async () => {
    deployer = await getSigner(ONE_ALPH * 1000n, 0)
    positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
    swapper = await getSigner(ONE_ALPH * 1000n, 0)

    const protocolFee = 10n ** (PercentageScale - 2n)
    invariant = await deployInvariant(deployer, protocolFee)
    ;[tokenX, tokenY] = await initTokensXY(deployer, mintAmount)
    feeTier = await newFeeTier(fee, tickSpacing)
    await initFeeTier(invariant, deployer, feeTier)
    poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)
    await initPool(invariant, deployer, tokenX, tokenY, feeTier, initSqrtPrice, initTick)
  })
  test('init position', async () => {
    const amount = 10n ** 6n
    const lowerTick = -10n
    const upperTick = 10n
    const liquidityDelta = 20006000n * 10n ** LiquidityScale
    await withdrawTokens(positionOwner, [tokenX, amount], [tokenY, amount])

    const poolBefore = await getPool(invariant, poolKey)
    const [slippageLimitLower, slippageLimitUpper] = [poolBefore.sqrtPrice, poolBefore.sqrtPrice]

    await initPositionWithLiquidity(
      invariant,
      positionOwner,
      poolKey,
      amount,
      amount,
      lowerTick,
      upperTick,
      liquidityDelta,
      1n,
      slippageLimitLower,
      slippageLimitUpper
    )

    const poolAfter = await getPool(invariant, poolKey)
    expect(poolAfter.liquidity).toEqual(liquidityDelta)
  })
  test('init swap', async () => {
    const amount = 10067n
    await withdrawTokens(swapper, [tokenX, amount], [tokenY, amount])

    const dexXBefore = await balanceOf(tokenX.contractId, invariant.address)
    const dexYBefore = await balanceOf(tokenY.contractId, invariant.address)

    const slippage = MinSqrtPrice

    const { targetSqrtPrice } = await quote(invariant, poolKey, true, amount, true, slippage)

    await initSwap(invariant, swapper, poolKey, true, amount, true, targetSqrtPrice)

    const pool = await getPool(invariant, poolKey)
    const expectedSqrtPrice = (
      await invariant.methods.calculateSqrtPrice({ args: { tickIndex: -10n } })
    ).returns
    const expectedYAmountOut = 9999n
    const liquidityDelta = 20006000n * 10n ** LiquidityScale
    const lowerTick = -10n

    expect(pool.sqrtPrice).toEqual(expectedSqrtPrice)
    expect(pool.liquidity).toEqual(liquidityDelta)
    expect(pool.currentTickIndex).toEqual(lowerTick)

    const swapperX = await balanceOf(tokenX.contractId, swapper.address)
    const swapperY = await balanceOf(tokenY.contractId, swapper.address)
    const dexX = await balanceOf(tokenX.contractId, invariant.address)
    const dexY = await balanceOf(tokenY.contractId, invariant.address)

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
  test('Open second position non-adjacent to the previous one, consequently creating a gap in liquidity', async () => {
    const lowerTick = -90n
    const upperTick = -50n
    const liquidityDelta = 20008000n * 10n ** LiquidityScale
    const amount = 10n ** 6n
    await withdrawTokens(positionOwner, [tokenX, amount], [tokenY, amount])

    const poolBefore = await getPool(invariant, poolKey)

    const [slippageLimitLower, slippageLimitUpper] = [poolBefore.sqrtPrice, poolBefore.sqrtPrice]

    await initPositionWithLiquidity(
      invariant,
      positionOwner,
      poolKey,
      amount,
      amount,
      lowerTick,
      upperTick,
      liquidityDelta,
      2n,
      slippageLimitLower,
      slippageLimitUpper
    )
  })
  test('should skip gap and then swap', async () => {
    const amount = 10067n
    await withdrawTokens(swapper, [tokenX, amount], [tokenY, amount])

    const slippage = MinSqrtPrice

    const { targetSqrtPrice } = await quote(invariant, poolKey, true, amount, true, slippage)

    await initSwap(invariant, swapper, poolKey, true, amount, true, targetSqrtPrice)

    const pool = await getPool(invariant, poolKey)
    const firstPosition = await getPosition(invariant, positionOwner.address, 1n)
    const secondPosition = await getPosition(invariant, positionOwner.address, 2n)

    const { exist: lowerInMap, ...lowerTick } = await getTick(invariant, poolKey, -50n)
    const { exist: currentInMap } = await getTick(invariant, poolKey, -60n)
    const { exist: upperInMap, ...upperTick } = await getTick(invariant, poolKey, -10n)

    const expectedFirstPosition = {
      exist: true,
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
      exist: true,
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

    expect(lowerInMap).toBeTruthy()
    expect(currentInMap).toBeFalsy()
    expect(upperInMap).toBeTruthy()

    const expectedLowerTick = {
      sign: false,
      index: -50n,
      liquidityChange: secondPosition.liquidity,
      liquidityGross: secondPosition.liquidity,
      sqrtPrice: (await invariant.methods.calculateSqrtPrice({ args: { tickIndex: -50n } }))
        .returns,
      feeGrowthOutsideX: 0n,
      feeGrowthOutsideY: 0n
    }
    const expectedUpperTick = {
      sign: true,
      index: -10n,
      liquidityChange: firstPosition.liquidity,
      liquidityGross: firstPosition.liquidity,
      sqrtPrice: (await invariant.methods.calculateSqrtPrice({ args: { tickIndex: -10n } }))
        .returns,
      feeGrowthOutsideX: 29991002699190242927121n,
      feeGrowthOutsideY: 0n
    }

    expect(lowerTick).toMatchObject(expectedLowerTick)
    expect(upperTick).toMatchObject(expectedUpperTick)

    const expectedPool = {
      exist: true,
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
