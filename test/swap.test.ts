import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { balanceOf, deployInvariant, newFeeTier, newPoolKey } from '../src/utils'
import {
  getBasicFeeTickSpacing,
  initBasicPool,
  initBasicPosition,
  initBasicSwap,
  initDexAndTokens
} from '../src/snippets'
import {
  expectError,
  expectVMError,
  getPool,
  getTick,
  initFeeTier,
  initPosition,
  initSwap,
  initTokensXY,
  quote,
  withdrawTokens
} from '../src/testUtils'
import {
  InvariantError,
  LiquidityScale,
  MaxSqrtPrice,
  MinSqrtPrice,
  PercentageScale,
  VMError
} from '../src/consts'
import { FeeTier, PoolKey } from '../artifacts/ts/types'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let admin: PrivateKeyWallet

describe('swap tests', () => {
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

  test('swap x to y', async () => {
    // 6% fee
    const protocolFee = 6n * 10n ** (PercentageScale - 3n)
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
      const liquidity = 1000000n * 10n ** LiquidityScale

      const positionAmount = positionsAmount / 2n

      await initPosition(
        invariant,
        positionOwner,
        poolKey,
        positionAmount,
        positionAmount,
        lowerTickIndex,
        upperTickIndex,
        liquidity,
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
        liquidity,
        slippageLimit,
        slippageLimit
      )
    }
    // swap + check balance
    {
      const swapper = await getSigner(ONE_ALPH * 1000n, 0)
      await withdrawTokens(swapper, [tokenX, swapAmount])

      const dexBalanceBefore = {
        tokenX: await balanceOf(tokenX.contractId, invariant.address),
        tokenY: await balanceOf(tokenY.contractId, invariant.address)
      }
      expect(dexBalanceBefore).toStrictEqual({ tokenX: 500n, tokenY: 2499n })

      const poolBefore = await getPool(invariant, poolKey)

      const slippage = MinSqrtPrice
      await initSwap(invariant, swapper, poolKey, true, swapAmount, true, slippage)

      // check balances
      const dexDelta = {
        tokenX: (await balanceOf(tokenX.contractId, invariant.address)) - dexBalanceBefore.tokenX,
        tokenY: (await balanceOf(tokenY.contractId, invariant.address)) - dexBalanceBefore.tokenY
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
        liquidity: 2n * 1000000n * 10n ** LiquidityScale,
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
      expect(lowerTick).toMatchObject({ exist: true, feeGrowthOutsideX: 0n })

      const middleTick = await getTick(invariant, poolKey, middleTickIndex)
      expect(middleTick).toMatchObject({ exist: true, feeGrowthOutsideX: 3n * 10n ** 22n })

      const upperTick = await getTick(invariant, poolKey, upperTickIndex)
      expect(upperTick).toMatchObject({ exist: true, feeGrowthOutsideX: 0n })
    }
  })

  test('swap y to x', async () => {
    // 6% fee
    const protocolFee = 6n * 10n ** (PercentageScale - 3n)
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
      const liquidity = 1000000n * 10n ** LiquidityScale

      const positionAmount = positionsAmount / 2n

      await initPosition(
        invariant,
        positionOwner,
        poolKey,
        positionAmount,
        positionAmount,
        lowerTickIndex,
        upperTickIndex,
        liquidity,
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
        liquidity,
        slippageLimit,
        slippageLimit
      )
    }

    // swap + check results
    {
      const swapper = await getSigner(ONE_ALPH * 1000n, 0)
      await withdrawTokens(swapper, [tokenY, swapAmount])

      const dexBalanceBefore = {
        tokenX: await balanceOf(tokenX.contractId, invariant.address),
        tokenY: await balanceOf(tokenY.contractId, invariant.address)
      }
      expect(dexBalanceBefore).toStrictEqual({ tokenX: 2499n, tokenY: 500n })

      const poolBefore = await getPool(invariant, poolKey)

      const { targetSqrtPrice: slippage } = await quote(
        invariant,
        poolKey,
        false,
        swapAmount,
        true,
        MaxSqrtPrice
      )
      await initSwap(invariant, swapper, poolKey, false, swapAmount, true, slippage)

      // check balances
      const dexDelta = {
        tokenX: (await balanceOf(tokenX.contractId, invariant.address)) - dexBalanceBefore.tokenX,
        tokenY: (await balanceOf(tokenY.contractId, invariant.address)) - dexBalanceBefore.tokenY
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
        liquidity: 2n * 1000000n * 10n ** LiquidityScale,
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
      expect(lowerTick).toMatchObject({ exist: true, feeGrowthOutsideY: 0n })

      const middleTick = await getTick(invariant, poolKey, middleTickIndex)
      expect(middleTick).toMatchObject({ exist: true, feeGrowthOutsideY: 3n * 10n ** 22n })

      const upperTick = await getTick(invariant, poolKey, upperTickIndex)
      expect(upperTick).toMatchObject({ exist: true, feeGrowthOutsideY: 0n })
    }
  })
  test('swap not enough liquidity token x', async () => {
    // 6% fee
    const protocolFee = 6n * 10n ** (PercentageScale - 3n)
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
      const liquidity = 1000000n * 10n ** LiquidityScale

      const positionAmount = positionsAmount / 2n

      await initPosition(
        invariant,
        positionOwner,
        poolKey,
        positionAmount,
        positionAmount,
        lowerTickIndex,
        upperTickIndex,
        liquidity,
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
        liquidity,
        slippageLimit,
        slippageLimit
      )
    }
    // swap + check balance
    {
      const swapper = await getSigner(ONE_ALPH * 1000n, 0)
      await withdrawTokens(swapper, [tokenX, swapAmount])

      const dexBalance = {
        tokenX: await balanceOf(tokenX.contractId, invariant.address),
        tokenY: await balanceOf(tokenY.contractId, invariant.address)
      }
      expect(dexBalance).toStrictEqual({ tokenX: 2499n, tokenY: 500n })
      // we run out of gas before completing the calculation, might be related to the performance of `prevInitialized`
      // in the particularly unlikely in the real world scenario of only uninitialized chunks
      expectVMError(
        VMError.OutOfGas,
        initSwap(invariant, swapper, poolKey, true, swapAmount, true, MinSqrtPrice)
      )
    }
  })

  test('swap not enough liquidity token y', async () => {
    // 6% fee
    const protocolFee = 6n * 10n ** (PercentageScale - 3n)
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
      const liquidity = 1000000n * 10n ** LiquidityScale

      const positionAmount = positionsAmount / 2n

      await initPosition(
        invariant,
        positionOwner,
        poolKey,
        positionAmount,
        positionAmount,
        lowerTickIndex,
        upperTickIndex,
        liquidity,
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
        liquidity,
        slippageLimit,
        slippageLimit
      )
    }

    // swap + check results
    {
      const swapper = await getSigner(ONE_ALPH * 1000n, 0)
      await withdrawTokens(swapper, [tokenY, swapAmount])

      const dexBalance = {
        tokenX: await balanceOf(tokenX.contractId, invariant.address),
        tokenY: await balanceOf(tokenY.contractId, invariant.address)
      }
      expect(dexBalance).toStrictEqual({ tokenX: 500n, tokenY: 2499n })

      expectError(
        InvariantError.TickLimitReached,
        initSwap(invariant, swapper, poolKey, false, swapAmount, true, MaxSqrtPrice),
        invariant
      )
    }
  })
})
