import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { balanceOf, newFeeTier, newPoolKey } from '../../../src/utils'
import {
  deployInvariant,
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
  isTickInitialized,
  removePosition,
  withdrawTokens
} from '../../../src/testUtils'
import {
  InvariantError,
  MAX_SQRT_PRICE,
  MIN_SQRT_PRICE,
  PERCENTAGE_SCALE
} from '../../../src/consts'
import { calculateSqrtPrice, toLiquidity, toPercentage } from '../../../src/math'
import { Liquidity, Percentage, SqrtPrice, TokenAmount } from '../../../src'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let admin: PrivateKeyWallet

describe('position tests', () => {
  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
  })

  test('create basic position', async () => {
    const positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
    const supply = 500n as TokenAmount
    const fee = 0n as Percentage
    const tickSpacing = 1n

    const invariant = await deployInvariant(admin, 0n as Percentage)
    const [tokenX, tokenY] = await initTokensXY(admin, supply)

    const feeTier = newFeeTier(fee, tickSpacing)
    const poolKey = newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    await withdrawTokens(positionOwner, [tokenX, supply], [tokenY, supply])

    const initTick = 10n
    const initSqrtPrice = calculateSqrtPrice(initTick)

    await initFeeTier(invariant, admin, feeTier)
    await initPool(invariant, admin, tokenX, tokenY, feeTier, initSqrtPrice, initTick)

    const lowerTickIndex = -10n
    const upperTickIndex = 10n
    const liquidityDelta = 10n as Liquidity

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

    const position = await getPosition(invariant, positionOwner.address, 0n)
    const expectedPosition = {
      liquidity: 10n,
      lowerTickIndex: -10n,
      upperTickIndex: 10n,
      feeGrowthInsideX: 0n,
      feeGrowthInsideY: 0n,
      tokensOwedX: 0n,
      tokensOwedY: 0n,
      owner: positionOwner.address
    }
    const pool = await getPool(invariant, poolKey)
    expect(pool.liquidity).toBe(0n)
    expect(position).toMatchObject(expectedPosition)
  })
  test('create with equal lower and upper tick', async () => {
    const positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
    const supply = 500n as TokenAmount
    const fee = 0n as Percentage
    const tickSpacing = 1n

    const invariant = await deployInvariant(admin, 0n as Percentage)
    const [tokenX, tokenY] = await initTokensXY(admin, supply)
    await withdrawTokens(positionOwner, [tokenX, supply], [tokenY, supply])

    const feeTier = newFeeTier(fee, tickSpacing)
    const poolKey = newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    const initTick = 10n
    const initSqrtPrice = calculateSqrtPrice(initTick)

    await initFeeTier(invariant, admin, feeTier)
    await initPool(invariant, admin, tokenX, tokenY, feeTier, initSqrtPrice, initTick)

    const tickIndex = 10n

    const liquidityDelta = 10n as Liquidity

    await expectError(
      InvariantError.InvalidTickIndex,
      initPosition(
        invariant,
        positionOwner,
        poolKey,
        supply,
        supply,
        tickIndex,
        tickIndex,
        liquidityDelta,
        0n as SqrtPrice,
        MAX_SQRT_PRICE
      ),
      invariant
    )
  })
  test('remove', async () => {
    const positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
    const supply = (10n ** 20n + 1000n) as TokenAmount
    const mint = (10n ** 10n) as TokenAmount
    const protocolFee = toPercentage(1n, 2n)
    const fee = toPercentage(6n, 3n)
    const tickSpacing = 10n

    const invariant = await deployInvariant(admin, protocolFee)
    const [tokenX, tokenY] = await initTokensXY(admin, supply)
    await withdrawTokens(positionOwner, [tokenX, mint], [tokenY, mint])

    const feeTier = newFeeTier(fee, tickSpacing)
    const poolKey = newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    const initTick = 0n
    const initSqrtPrice = calculateSqrtPrice(initTick)

    await initFeeTier(invariant, admin, feeTier)
    await initPool(invariant, admin, tokenX, tokenY, feeTier, initSqrtPrice, initTick)

    const lowerTickIndex = -20n
    const upperTickIndex = 10n
    const incorrectLowerTickIndex = lowerTickIndex - 50n
    const incorrectUpperTickIndex = upperTickIndex + 50n

    {
      const liquidityDelta = toLiquidity(1000000n)
      const poolBefore = await getPool(invariant, poolKey)
      const ownerX = await balanceOf(tokenX.contractId, positionOwner.address)
      const ownerY = await balanceOf(tokenY.contractId, positionOwner.address)
      const [slippageLimitLower, slippageLimitUpper] = [poolBefore.sqrtPrice, poolBefore.sqrtPrice]

      await initPosition(
        invariant,
        positionOwner,
        poolKey,
        ownerX,
        ownerY,
        lowerTickIndex,
        upperTickIndex,
        liquidityDelta,
        slippageLimitLower,
        slippageLimitUpper
      )

      const position = await getPosition(invariant, positionOwner.address, 0n)
      const expectedPosition = {
        liquidity: liquidityDelta,
        lowerTickIndex,
        upperTickIndex,
        feeGrowthInsideX: 0n,
        feeGrowthInsideY: 0n,
        tokensOwedX: 0n,
        tokensOwedY: 0n,
        owner: positionOwner.address
      }
      const pool = await getPool(invariant, poolKey)
      expect(pool.liquidity).toBe(liquidityDelta)
      expect(position).toMatchObject(expectedPosition)
    }
    {
      const liquidityDelta = toLiquidity(1000000n * 1000000n)
      const poolBefore = await getPool(invariant, poolKey)
      await withdrawTokens(positionOwner, [tokenX, mint], [tokenY, mint])
      const ownerX = await balanceOf(tokenX.contractId, positionOwner.address)
      const ownerY = await balanceOf(tokenY.contractId, positionOwner.address)

      const [slippageLimitLower, slippageLimitUpper] = [poolBefore.sqrtPrice, poolBefore.sqrtPrice]

      await initPosition(
        invariant,
        positionOwner,
        poolKey,
        ownerX,
        ownerY,
        incorrectLowerTickIndex,
        incorrectUpperTickIndex,
        liquidityDelta,
        slippageLimitLower,
        slippageLimitUpper
      )

      const position = await getPosition(invariant, positionOwner.address, 1n)
      const expectedPosition = {
        liquidity: liquidityDelta,
        lowerTickIndex: incorrectLowerTickIndex,
        upperTickIndex: incorrectUpperTickIndex,
        feeGrowthInsideX: 0n,
        feeGrowthInsideY: 0n,
        tokensOwedX: 0n,
        tokensOwedY: 0n,
        owner: positionOwner.address
      }
      const pool = await getPool(invariant, poolKey)
      expect(pool.liquidity).toBe(liquidityDelta + toLiquidity(1000000n))
      expect(position).toMatchObject(expectedPosition)
    }

    const swapper = await getSigner(ONE_ALPH * 1000n, 0)
    const amount = 1000n as TokenAmount
    await withdrawTokens(swapper, [tokenX, amount], [tokenY, amount])

    const poolBefore = await getPool(invariant, poolKey)
    const slippage = MIN_SQRT_PRICE

    await initSwap(invariant, swapper, poolKey, true, amount, true, slippage)

    const poolAfter = await getPool(invariant, poolKey)

    const expectedPool = {
      poolKey,
      liquidity: poolBefore.liquidity,
      currentTickIndex: -10n,
      feeGrowthGlobalX: 49999950000049999n,
      feeGrowthGlobalY: 0n,
      feeProtocolTokenX: 1n,
      feeProtocolTokenY: 0n,
      feeReceiver: admin.address
    }
    expect(poolAfter).toMatchObject(expectedPool)

    const swapperX = await balanceOf(tokenX.contractId, swapper.address)
    const swapperY = await balanceOf(tokenY.contractId, swapper.address)
    expect(swapperX).toBe(0n)
    expect(swapperY).toBe(1993n)

    const { x: dexXBefore, y: dexYBefore } = await getReserveBalances(invariant, poolKey)

    await removePosition(invariant, positionOwner, 0n)

    const pool = await getPool(invariant, poolKey)

    const lowerBit = await isTickInitialized(invariant, poolKey, lowerTickIndex)
    const upperBit = await isTickInitialized(invariant, poolKey, upperTickIndex)
    const { x: dexX, y: dexY } = await getReserveBalances(invariant, poolKey)
    const expectedWithdrawnX = 499n
    const expectedWithdrawnY = 999n
    const expectedFeeX = 0n

    expect(dexXBefore - dexX).toBe(expectedWithdrawnX + expectedFeeX)
    expect(dexYBefore - dexY).toBe(expectedWithdrawnY)
    await expectError(InvariantError.InvalidTickIndex, getTick(invariant, poolKey, lowerTickIndex))
    await expectError(InvariantError.InvalidTickIndex, getTick(invariant, poolKey, upperTickIndex))
    expect(lowerBit).toBeFalsy()
    expect(upperBit).toBeFalsy()
    expect(pool.liquidity).toBe(100000000000000000n)
    expect(pool.currentTickIndex).toBe(-10n)
  })
  test('create within current tick', async () => {
    const tickSpacing = 4n
    const maxTick = 177450n
    const minTick = -maxTick
    const initTick = -23028n
    const initialBalance = 100000000n as TokenAmount
    const protocolFee = 0n as Percentage
    const fee = toPercentage(2n, 4n)

    const positionOwner = await getSigner(ONE_ALPH * 1001n, 0)

    const invariant = await deployInvariant(admin, protocolFee)
    const [tokenX, tokenY] = await initTokensXY(admin, initialBalance)
    await withdrawTokens(positionOwner, [tokenX, initialBalance], [tokenY, initialBalance])

    const feeTier = newFeeTier(fee, tickSpacing)
    const poolKey = newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    const initSqrtPrice = calculateSqrtPrice(initTick)

    await initFeeTier(invariant, admin, feeTier)
    await initPool(invariant, admin, tokenX, tokenY, feeTier, initSqrtPrice, initTick)

    const lowerTickIndex = minTick + 10n
    const upperTickIndex = maxTick - 10n

    const liquidityDelta = toLiquidity(100n)

    const poolBefore = await getPool(invariant, poolKey)
    const [slippageLimitLower, slippageLimitUpper] = [poolBefore.sqrtPrice, MAX_SQRT_PRICE]
    await initPosition(
      invariant,
      positionOwner,
      poolKey,
      initialBalance,
      initialBalance,
      lowerTickIndex,
      upperTickIndex,
      liquidityDelta,
      slippageLimitLower,
      slippageLimitUpper
    )

    const position = await getPosition(invariant, positionOwner.address, 0n)
    const pool = await getPool(invariant, poolKey)
    const lowerTick = await getTick(invariant, poolKey, lowerTickIndex)
    const upperTick = await getTick(invariant, poolKey, upperTickIndex)
    const ownerX = await balanceOf(tokenX.contractId, positionOwner.address)
    const ownerY = await balanceOf(tokenY.contractId, positionOwner.address)
    const { x: dexX, y: dexY } = await getReserveBalances(invariant, poolKey)
    const expectedXIncrease = 317n
    const expectedYIncrease = 32n

    expect(lowerTick.index).toBe(lowerTickIndex)
    expect(lowerTick.liquidityGross).toBe(liquidityDelta)
    expect(lowerTick.liquidityChange).toBe(liquidityDelta)
    expect(lowerTick.sign).toBeTruthy()

    expect(upperTick.index).toBe(upperTickIndex)
    expect(upperTick.liquidityGross).toBe(liquidityDelta)
    expect(upperTick.liquidityChange).toBe(liquidityDelta)
    expect(upperTick.sign).toBeFalsy()

    expect(pool.liquidity).toBe(liquidityDelta)
    expect(pool.currentTickIndex).toBe(initTick)

    const expectedPosition = {
      liquidity: liquidityDelta,
      lowerTickIndex,
      upperTickIndex,
      feeGrowthInsideX: 0n,
      feeGrowthInsideY: 0n,
      tokensOwedX: 0n,
      tokensOwedY: 0n,
      owner: positionOwner.address
    }

    expect(position).toMatchObject(expectedPosition)

    expect(ownerX).toBe(initialBalance - dexX)
    expect(ownerY).toBe(initialBalance - dexY)
    expect(dexX).toBe(expectedXIncrease)
    expect(dexY).toBe(expectedYIncrease)
  })
  test('create below current tick', async () => {
    const initTick = -23028n
    const initialBalance = 10000000000n as TokenAmount
    const protocolFee = 0n as Percentage
    const fee = (2n * 10n ** (PERCENTAGE_SCALE - 4n)) as Percentage
    const tickSpacing = 4n

    const positionOwner = await getSigner(ONE_ALPH * 1000n, 0)

    const invariant = await deployInvariant(admin, protocolFee)
    const [tokenX, tokenY] = await initTokensXY(admin, initialBalance)
    await withdrawTokens(positionOwner, [tokenX, initialBalance], [tokenY, initialBalance])

    const feeTier = newFeeTier(fee, tickSpacing)
    const poolKey = newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    const initSqrtPrice = calculateSqrtPrice(initTick)

    await initFeeTier(invariant, admin, feeTier)
    await initPool(invariant, admin, tokenX, tokenY, feeTier, initSqrtPrice, initTick)

    const lowerTickIndex = -46080n
    const upperTickIndex = -23040n

    const liquidityDelta = toLiquidity(10000n)

    const poolBefore = await getPool(invariant, poolKey)
    const [slippageLimitLower, slippageLimitUpper] = [poolBefore.sqrtPrice, MAX_SQRT_PRICE]

    await initPosition(
      invariant,
      positionOwner,
      poolKey,
      0n as TokenAmount,
      initialBalance,
      lowerTickIndex,
      upperTickIndex,
      liquidityDelta,
      slippageLimitLower,
      slippageLimitUpper
    )

    const position = await getPosition(invariant, positionOwner.address, 0n)
    const pool = await getPool(invariant, poolKey)
    const lowerTick = await getTick(invariant, poolKey, lowerTickIndex)
    const upperTick = await getTick(invariant, poolKey, upperTickIndex)
    const lowerBit = await isTickInitialized(invariant, poolKey, lowerTickIndex)
    const upperBit = await isTickInitialized(invariant, poolKey, upperTickIndex)
    const ownerX = await balanceOf(tokenX.contractId, positionOwner.address)
    const ownerY = await balanceOf(tokenY.contractId, positionOwner.address)
    const { x: dexX, y: dexY } = await getReserveBalances(invariant, poolKey)
    const expectedXIncrease = 0n
    const expectedYIncrease = 2162n

    expect(lowerTick.index).toBe(lowerTickIndex)
    expect(lowerTick.liquidityGross).toBe(liquidityDelta)
    expect(lowerTick.liquidityChange).toBe(liquidityDelta)
    expect(lowerTick.sign).toBeTruthy()
    expect(lowerBit).toBeTruthy()

    expect(upperTick.index).toBe(upperTickIndex)
    expect(upperTick.liquidityGross).toBe(liquidityDelta)
    expect(upperTick.liquidityChange).toBe(liquidityDelta)
    expect(upperTick.sign).toBeFalsy()
    expect(upperBit).toBeTruthy()

    expect(pool.liquidity).toBe(0n)
    expect(pool.currentTickIndex).toBe(initTick)

    const expectedPosition = {
      liquidity: liquidityDelta,
      lowerTickIndex,
      upperTickIndex,
      feeGrowthInsideX: 0n,
      feeGrowthInsideY: 0n,
      tokensOwedX: 0n,
      tokensOwedY: 0n,
      owner: positionOwner.address
    }

    expect(position).toMatchObject(expectedPosition)

    expect(ownerX).toBe(initialBalance - dexX)
    expect(ownerY).toBe(initialBalance - dexY)
    expect(dexX).toBe(expectedXIncrease)
    expect(dexY).toBe(expectedYIncrease)
  })
  test('create above current tick', async () => {
    const initTick = -23028n
    const initialBalance = 10000000000n as TokenAmount
    const protocolFee = 0n as Percentage
    const fee = toPercentage(2n, 4n)
    const tickSpacing = 4n

    const positionOwner = await getSigner(ONE_ALPH * 1000n, 0)

    const invariant = await deployInvariant(admin, protocolFee)
    const [tokenX, tokenY] = await initTokensXY(admin, initialBalance)
    await withdrawTokens(positionOwner, [tokenX, initialBalance], [tokenY, initialBalance])

    const feeTier = newFeeTier(fee, tickSpacing)
    const poolKey = newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    const initSqrtPrice = calculateSqrtPrice(initTick)

    await initFeeTier(invariant, admin, feeTier)
    await initPool(invariant, admin, tokenX, tokenY, feeTier, initSqrtPrice, initTick)

    const lowerTickIndex = -22980n
    const upperTickIndex = 0n

    const liquidityDelta = toLiquidity(10000n)

    const poolBefore = await getPool(invariant, poolKey)
    const [slippageLimitLower, slippageLimitUpper] = [poolBefore.sqrtPrice, MAX_SQRT_PRICE]

    await initPosition(
      invariant,
      positionOwner,
      poolKey,
      initialBalance,
      0n as TokenAmount,
      lowerTickIndex,
      upperTickIndex,
      liquidityDelta,
      slippageLimitLower,
      slippageLimitUpper
    )

    const position = await getPosition(invariant, positionOwner.address, 0n)
    const pool = await getPool(invariant, poolKey)
    const lowerTick = await getTick(invariant, poolKey, lowerTickIndex)
    const upperTick = await getTick(invariant, poolKey, upperTickIndex)
    const ownerX = await balanceOf(tokenX.contractId, positionOwner.address)
    const ownerY = await balanceOf(tokenY.contractId, positionOwner.address)
    const { x: dexX, y: dexY } = await getReserveBalances(invariant, poolKey)
    const expectedXIncrease = 21549n
    const expectedYIncrease = 0n

    expect(lowerTick.index).toBe(lowerTickIndex)
    expect(lowerTick.liquidityGross).toBe(liquidityDelta)
    expect(lowerTick.liquidityChange).toBe(liquidityDelta)
    expect(lowerTick.sign).toBeTruthy()

    expect(upperTick.index).toBe(upperTickIndex)
    expect(upperTick.liquidityGross).toBe(liquidityDelta)
    expect(upperTick.liquidityChange).toBe(liquidityDelta)
    expect(upperTick.sign).toBeFalsy()

    expect(pool.liquidity).toBe(0n)
    expect(pool.currentTickIndex).toBe(initTick)

    const expectedPosition = {
      liquidity: liquidityDelta,
      lowerTickIndex,
      upperTickIndex,
      feeGrowthInsideX: 0n,
      feeGrowthInsideY: 0n,
      tokensOwedX: 0n,
      tokensOwedY: 0n,
      owner: positionOwner.address
    }

    expect(position).toMatchObject(expectedPosition)

    expect(ownerX).toBe(initialBalance - dexX)
    expect(ownerY).toBe(initialBalance - dexY)
    expect(dexX).toBe(expectedXIncrease)
    expect(dexY).toBe(expectedYIncrease)
  })
})
