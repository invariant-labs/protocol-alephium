import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { balanceOf, deployInvariant, newFeeTier, newPoolKey } from '../../../src/utils'
import {
  getBasicFeeTickSpacing,
  initBasicPool,
  initBasicPosition,
  initBasicSwap,
  initDexAndTokens
} from '../../../src/snippets'
import {
  expectError,
  expectVMError,
  getPool,
  getReserveBalances,
  getTick,
  initFeeTier,
  initPosition,
  initSwap,
  initTokensXY,
  quote,
  withdrawTokens
} from '../../../src/testUtils'
import { InvariantError, MAX_SQRT_PRICE, MIN_SQRT_PRICE, VMError } from '../../../src/consts'
import { toLiquidity, toPercentage } from '../../../src/math'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let admin: PrivateKeyWallet

describe('swap tests', () => {
  // 0.6% fee
  const protocolFee = toPercentage(6n, 3n)

  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
  })

  test('swap', async () => {
    const [fee, tickSpacing] = getBasicFeeTickSpacing()
    const [invariant, tokenX, tokenY] = await initDexAndTokens(admin)
    const feeTier = await newFeeTier(fee, tickSpacing)
    await initFeeTier(invariant, admin, feeTier)
    await initBasicPool(invariant, admin, tokenX, tokenY)
    const positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
    await initBasicPosition(invariant, positionOwner, tokenX, tokenY)
    const swapper = await getSigner(ONE_ALPH * 1000n, 0)
    await initBasicSwap(invariant, swapper, tokenX, tokenY)
  })

  test('x to y', async () => {
    const invariant = await deployInvariant(admin, protocolFee)

    const positionsAmount = 2n * 10n ** 10n
    const swapAmount = 1000n
    const [tokenX, tokenY] = await initTokensXY(admin, positionsAmount + swapAmount)

    const [fee, tickSpacing] = getBasicFeeTickSpacing()
    const feeTier = await newFeeTier(fee, tickSpacing)
    const poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    await initFeeTier(invariant, admin, feeTier)

    await initBasicPool(invariant, admin, tokenX, tokenY)
    // positions
    const [lowerTickIndex, middleTickIndex, upperTickIndex] = [-20n, -10n, 10n]
    {
      const positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
      await withdrawTokens(positionOwner, [tokenX, positionsAmount], [tokenY, positionsAmount])

      const poolBefore = await getPool(invariant, poolKey)
      const slippageLimit = poolBefore.sqrtPrice
      const liquidityDelta = toLiquidity(1000000n)

      const positionAmount = positionsAmount / 2n

      await initPosition(
        invariant,
        positionOwner,
        poolKey,
        positionAmount,
        positionAmount,
        lowerTickIndex,
        upperTickIndex,
        liquidityDelta,
        slippageLimit,
        slippageLimit
      )

      await initPosition(
        invariant,
        positionOwner,
        poolKey,
        positionAmount,
        positionAmount,
        lowerTickIndex - 20n,
        middleTickIndex,
        liquidityDelta,
        slippageLimit,
        slippageLimit
      )
    }
    // swap + check balance
    {
      const swapper = await getSigner(ONE_ALPH * 1000n, 0)
      await withdrawTokens(swapper, [tokenX, swapAmount])

      const dexBalanceBefore = await getReserveBalances(invariant, poolKey)
      expect(dexBalanceBefore).toStrictEqual({ x: 500n, y: 2499n })

      const poolBefore = await getPool(invariant, poolKey)

      const slippage = MIN_SQRT_PRICE
      await initSwap(invariant, swapper, poolKey, true, swapAmount, true, slippage)

      // check balances
      const dex = await getReserveBalances(invariant, poolKey)
      const dexDelta = {
        tokenX: dex.x - dexBalanceBefore.x,
        tokenY: dex.y - dexBalanceBefore.y
      }
      expect(dexDelta).toMatchObject({ tokenX: swapAmount, tokenY: 10n - swapAmount })

      const swapperBalance = {
        tokenX: await balanceOf(tokenX.contractId, swapper.address),
        tokenY: await balanceOf(tokenY.contractId, swapper.address)
      }
      expect(swapperBalance).toMatchObject({ tokenX: 0n, tokenY: swapAmount - 10n })

      // check pool
      const poolAfter = await getPool(invariant, poolKey)
      const poolExpected = {
        liquidity: toLiquidity(2n * 1000000n),
        currentTickIndex: -20n,
        feeGrowthGlobalX: 4n * 10n ** 22n,
        feeGrowthGlobalY: 0n,
        feeProtocolTokenX: 2n,
        feeProtocolTokenY: 0n
      }

      expect(poolAfter).toMatchObject(poolExpected)
      expect(poolAfter.liquidity).not.toBe(poolBefore.liquidity)

      // check ticks
      const lowerTick = await getTick(invariant, poolKey, lowerTickIndex)
      expect(lowerTick).toMatchObject({ feeGrowthOutsideX: 0n })

      const middleTick = await getTick(invariant, poolKey, middleTickIndex)
      expect(middleTick).toMatchObject({ feeGrowthOutsideX: 3n * 10n ** 22n })

      const upperTick = await getTick(invariant, poolKey, upperTickIndex)
      expect(upperTick).toMatchObject({ feeGrowthOutsideX: 0n })
    }
  })

  test('y to x', async () => {
    const invariant = await deployInvariant(admin, protocolFee)

    const positionsAmount = 2n * 10n ** 10n
    const swapAmount = 1000n
    const [tokenX, tokenY] = await initTokensXY(admin, positionsAmount + swapAmount)

    const [fee, tickSpacing] = getBasicFeeTickSpacing()

    const feeTier = await newFeeTier(fee, tickSpacing)
    const poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    await initFeeTier(invariant, admin, feeTier)

    await initBasicPool(invariant, admin, tokenX, tokenY)
    // positions
    const [lowerTickIndex, middleTickIndex, upperTickIndex] = [-10n, 10n, 20n]
    {
      const positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
      await withdrawTokens(positionOwner, [tokenX, positionsAmount], [tokenY, positionsAmount])

      const poolBefore = await getPool(invariant, poolKey)
      const slippageLimit = poolBefore.sqrtPrice
      const liquidityDelta = toLiquidity(1000000n)

      const positionAmount = positionsAmount / 2n

      await initPosition(
        invariant,
        positionOwner,
        poolKey,
        positionAmount,
        positionAmount,
        lowerTickIndex,
        upperTickIndex,
        liquidityDelta,
        slippageLimit,
        slippageLimit
      )

      await initPosition(
        invariant,
        positionOwner,
        poolKey,
        positionAmount,
        positionAmount,
        middleTickIndex,
        upperTickIndex + 20n,
        liquidityDelta,
        slippageLimit,
        slippageLimit
      )
    }

    // swap + check results
    {
      const swapper = await getSigner(ONE_ALPH * 1000n, 0)
      await withdrawTokens(swapper, [tokenY, swapAmount])

      const dexBalanceBefore = await getReserveBalances(invariant, poolKey)
      expect(dexBalanceBefore).toStrictEqual({ x: 2499n, y: 500n })

      const poolBefore = await getPool(invariant, poolKey)

      const { targetSqrtPrice: slippage } = await quote(
        invariant,
        poolKey,
        false,
        swapAmount,
        true,
        MAX_SQRT_PRICE
      )
      await initSwap(invariant, swapper, poolKey, false, swapAmount, true, slippage)

      // check balances
      const dexBalance = await getReserveBalances(invariant, poolKey)
      const dexDelta = {
        tokenX: dexBalance.x - dexBalanceBefore.x,
        tokenY: dexBalance.y - dexBalanceBefore.y
      }
      expect(dexDelta).toMatchObject({ tokenX: 10n - swapAmount, tokenY: swapAmount })

      const swapperBalance = {
        tokenX: await balanceOf(tokenX.contractId, swapper.address),
        tokenY: await balanceOf(tokenY.contractId, swapper.address)
      }
      expect(swapperBalance).toMatchObject({ tokenX: swapAmount - 10n, tokenY: 0n })

      // check pool
      const poolAfter = await getPool(invariant, poolKey)
      const poolExpected = {
        liquidity: toLiquidity(2n * 1000000n),
        currentTickIndex: 10n,
        feeGrowthGlobalX: 0n,
        feeGrowthGlobalY: 4n * 10n ** 22n,
        feeProtocolTokenX: 0n,
        feeProtocolTokenY: 2n
      }
      expect(poolAfter).toMatchObject(poolExpected)
      expect(poolAfter.liquidity).not.toBe(poolBefore.liquidity)

      // check ticks
      const lowerTick = await getTick(invariant, poolKey, lowerTickIndex)
      expect(lowerTick).toMatchObject({ feeGrowthOutsideY: 0n })

      const middleTick = await getTick(invariant, poolKey, middleTickIndex)
      expect(middleTick).toMatchObject({ feeGrowthOutsideY: 3n * 10n ** 22n })

      const upperTick = await getTick(invariant, poolKey, upperTickIndex)
      expect(upperTick).toMatchObject({ feeGrowthOutsideY: 0n })
    }
  })
  test('not enough liquidity token x', async () => {
    const invariant = await deployInvariant(admin, protocolFee)

    const positionsAmount = 2n * 10n ** 10n
    const swapAmount = 1000n
    const [tokenX, tokenY] = await initTokensXY(admin, positionsAmount + swapAmount)

    const [fee, tickSpacing] = getBasicFeeTickSpacing()

    const feeTier = await newFeeTier(fee, tickSpacing)
    const poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    await initFeeTier(invariant, admin, feeTier)
    await initBasicPool(invariant, admin, tokenX, tokenY)

    // positions
    const [lowerTickIndex, middleTickIndex, upperTickIndex] = [-10n, 10n, 20n]
    {
      const positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
      await withdrawTokens(positionOwner, [tokenX, positionsAmount], [tokenY, positionsAmount])

      const poolBefore = await getPool(invariant, poolKey)
      const slippageLimit = poolBefore.sqrtPrice
      const liquidityDelta = toLiquidity(1000000n)

      const positionAmount = positionsAmount / 2n

      await initPosition(
        invariant,
        positionOwner,
        poolKey,
        positionAmount,
        positionAmount,
        lowerTickIndex,
        upperTickIndex,
        liquidityDelta,
        slippageLimit,
        slippageLimit
      )

      await initPosition(
        invariant,
        positionOwner,
        poolKey,
        positionAmount,
        positionAmount,
        middleTickIndex,
        upperTickIndex + 20n,
        liquidityDelta,
        slippageLimit,
        slippageLimit
      )
    }
    // swap + check balance
    {
      const swapper = await getSigner(ONE_ALPH * 1000n, 0)
      await withdrawTokens(swapper, [tokenX, swapAmount])

      const dexBalance = await getReserveBalances(invariant, poolKey)
      expect(dexBalance).toStrictEqual({ x: 2499n, y: 500n })
      // we run out of gas before completing the calculation, might be related to the performance of `prevInitialized`
      // in the particularly unlikely in the real world scenario of only uninitialized chunks
      await expectVMError(
        VMError.OutOfGas,
        initSwap(invariant, swapper, poolKey, true, swapAmount, true, MIN_SQRT_PRICE)
      )
    }
  })

  test('not enough liquidity token y', async () => {
    const invariant = await deployInvariant(admin, protocolFee)

    const positionsAmount = 2n * 10n ** 10n
    const swapAmount = 1000n
    const [tokenX, tokenY] = await initTokensXY(admin, positionsAmount + swapAmount)

    const [fee, tickSpacing] = getBasicFeeTickSpacing()
    const feeTier = await newFeeTier(fee, tickSpacing)
    const poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    await initFeeTier(invariant, admin, feeTier)

    await initBasicPool(invariant, admin, tokenX, tokenY)
    // positions
    const [lowerTickIndex, middleTickIndex, upperTickIndex] = [-20n, -10n, 10n]
    {
      const positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
      await withdrawTokens(positionOwner, [tokenX, positionsAmount], [tokenY, positionsAmount])

      const poolBefore = await getPool(invariant, poolKey)
      const slippageLimit = poolBefore.sqrtPrice
      const liquidityDelta = toLiquidity(1000000n)

      const positionAmount = positionsAmount / 2n

      await initPosition(
        invariant,
        positionOwner,
        poolKey,
        positionAmount,
        positionAmount,
        lowerTickIndex,
        upperTickIndex,
        liquidityDelta,
        slippageLimit,
        slippageLimit
      )

      await initPosition(
        invariant,
        positionOwner,
        poolKey,
        positionAmount,
        positionAmount,
        lowerTickIndex - 20n,
        middleTickIndex,
        liquidityDelta,
        slippageLimit,
        slippageLimit
      )
    }

    // swap + check results
    {
      const swapper = await getSigner(ONE_ALPH * 1000n, 0)
      await withdrawTokens(swapper, [tokenY, swapAmount])

      const dexBalance = await getReserveBalances(invariant, poolKey)
      expect(dexBalance).toStrictEqual({ x: 500n, y: 2499n })

      await expectError(
        InvariantError.TickLimitReached,
        initSwap(invariant, swapper, poolKey, false, swapAmount, true, MAX_SQRT_PRICE),
        invariant
      )
    }
  })
})
