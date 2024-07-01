import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { balanceOf, deployInvariant } from '../src/utils'
import {
  getBasicFeeTickSpacing,
  initBasicPool,
  initBasicPosition,
  initBasicSwap,
  initDexAndTokens
} from '../src/snippets'
import {
  expectError,
  getPool,
  getTick,
  initFeeTier,
  initPositionWithLiquidity,
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
  PercentageScale
} from '../src/consts'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let admin: PrivateKeyWallet

describe('swap tests', () => {
  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
  })

  test('swap', async () => {
    const [fee, tickSpacing] = getBasicFeeTickSpacing()
    const [invariant, tokenX, tokenY] = await initDexAndTokens(admin)
    await initFeeTier(invariant, admin, fee, tickSpacing)
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
    await initFeeTier(invariant, admin, fee, tickSpacing)

    await initBasicPool(invariant, admin, tokenX, tokenY)
    // positions
    const [lowerTickIndex, middleTickIndex, upperTickIndex] = [-20n, -10n, 10n]
    {
      const positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
      await withdrawTokens(positionOwner, [tokenX, positionsAmount], [tokenY, positionsAmount])

      const poolBefore = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
      const slippageLimit = poolBefore.sqrtPrice
      const liquidity = 1000000n * 10n ** LiquidityScale

      const positionAmount = positionsAmount / 2n

      await initPositionWithLiquidity(
        invariant,
        positionOwner,
        tokenX,
        positionAmount,
        tokenY,
        positionAmount,
        fee,
        tickSpacing,
        lowerTickIndex,
        upperTickIndex,
        liquidity,
        1n,
        slippageLimit,
        slippageLimit
      )

      await initPositionWithLiquidity(
        invariant,
        positionOwner,
        tokenX,
        positionAmount,
        tokenY,
        positionAmount,
        fee,
        tickSpacing,
        lowerTickIndex - 20n,
        middleTickIndex,
        liquidity,
        2n,
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

      const poolBefore = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)

      const slippage = MinSqrtPrice
      await initSwap(
        invariant,
        swapper,
        tokenX,
        tokenY,
        fee,
        tickSpacing,
        true,
        swapAmount,
        true,
        slippage
      )

      // check balances
      const dexDelta = {
        tokenX: dexBalanceBefore.tokenX - (await balanceOf(tokenX.contractId, invariant.address)),
        tokenY: dexBalanceBefore.tokenY - (await balanceOf(tokenY.contractId, invariant.address))
      }
      expect(dexDelta).toMatchObject({ tokenX: -swapAmount, tokenY: swapAmount - 10n })

      const swapperBalance = {
        tokenX: await balanceOf(tokenX.contractId, swapper.address),
        tokenY: await balanceOf(tokenY.contractId, swapper.address)
      }
      expect(swapperBalance).toMatchObject({ tokenX: 0n, tokenY: swapAmount - 10n })

      // check pool
      const poolAfter = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
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
      const lowerTick = await getTick(invariant, tokenX, tokenY, fee, tickSpacing, lowerTickIndex)
      expect(lowerTick).toMatchObject({ exist: true, feeGrowthOutsideX: 0n })

      const middleTick = await getTick(invariant, tokenX, tokenY, fee, tickSpacing, middleTickIndex)
      expect(middleTick).toMatchObject({ exist: true, feeGrowthOutsideX: 3n * 10n ** 22n })

      const upperTick = await getTick(invariant, tokenX, tokenY, fee, tickSpacing, upperTickIndex)
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
    await initFeeTier(invariant, admin, fee, tickSpacing)

    await initBasicPool(invariant, admin, tokenX, tokenY)
    // positions
    const [lowerTickIndex, middleTickIndex, upperTickIndex] = [-10n, 10n, 20n]
    {
      const positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
      await withdrawTokens(positionOwner, [tokenX, positionsAmount], [tokenY, positionsAmount])

      const poolBefore = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
      const slippageLimit = poolBefore.sqrtPrice
      const liquidity = 1000000n * 10n ** LiquidityScale

      const positionAmount = positionsAmount / 2n

      await initPositionWithLiquidity(
        invariant,
        positionOwner,
        tokenX,
        positionAmount,
        tokenY,
        positionAmount,
        fee,
        tickSpacing,
        lowerTickIndex,
        upperTickIndex,
        liquidity,
        1n,
        slippageLimit,
        slippageLimit
      )

      await initPositionWithLiquidity(
        invariant,
        positionOwner,
        tokenX,
        positionAmount,
        tokenY,
        positionAmount,
        fee,
        tickSpacing,
        middleTickIndex,
        upperTickIndex + 20n,
        liquidity,
        2n,
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

      const poolBefore = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)

      const slippage = (
        await quote(
          invariant,
          tokenX,
          tokenY,
          fee,
          tickSpacing,
          false,
          swapAmount,
          true,
          MaxSqrtPrice
        )
      ).targetSqrtPrice
      await initSwap(
        invariant,
        swapper,
        tokenX,
        tokenY,
        fee,
        tickSpacing,
        false,
        swapAmount,
        true,
        slippage
      )

      // check balances
      const dexDelta = {
        tokenX: dexBalanceBefore.tokenX - (await balanceOf(tokenX.contractId, invariant.address)),
        tokenY: dexBalanceBefore.tokenY - (await balanceOf(tokenY.contractId, invariant.address))
      }
      expect(dexDelta).toMatchObject({ tokenX: swapAmount - 10n, tokenY: -swapAmount })

      const swapperBalance = {
        tokenX: await balanceOf(tokenX.contractId, swapper.address),
        tokenY: await balanceOf(tokenY.contractId, swapper.address)
      }
      expect(swapperBalance).toMatchObject({ tokenX: swapAmount - 10n, tokenY: 0n })

      // check pool
      const poolAfter = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
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
      const lowerTick = await getTick(invariant, tokenX, tokenY, fee, tickSpacing, lowerTickIndex)
      expect(lowerTick).toMatchObject({ exist: true, feeGrowthOutsideY: 0n })

      const middleTick = await getTick(invariant, tokenX, tokenY, fee, tickSpacing, middleTickIndex)
      expect(middleTick).toMatchObject({ exist: true, feeGrowthOutsideY: 3n * 10n ** 22n })

      const upperTick = await getTick(invariant, tokenX, tokenY, fee, tickSpacing, upperTickIndex)
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
    await initFeeTier(invariant, admin, fee, tickSpacing)
    await initBasicPool(invariant, admin, tokenX, tokenY)

    // positions
    const [lowerTickIndex, middleTickIndex, upperTickIndex] = [-10n, 10n, 20n]
    {
      const positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
      await withdrawTokens(positionOwner, [tokenX, positionsAmount], [tokenY, positionsAmount])

      const poolBefore = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
      const slippageLimit = poolBefore.sqrtPrice
      const liquidity = 1000000n * 10n ** LiquidityScale

      const positionAmount = positionsAmount / 2n

      await initPositionWithLiquidity(
        invariant,
        positionOwner,
        tokenX,
        positionAmount,
        tokenY,
        positionAmount,
        fee,
        tickSpacing,
        lowerTickIndex,
        upperTickIndex,
        liquidity,
        1n,
        slippageLimit,
        slippageLimit
      )

      await initPositionWithLiquidity(
        invariant,
        positionOwner,
        tokenX,
        positionAmount,
        tokenY,
        positionAmount,
        fee,
        tickSpacing,
        middleTickIndex,
        upperTickIndex + 20n,
        liquidity,
        2n,
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
      // TODO: expectError - currently without it due to the bug in Alephium's error checking function giving us false positive
      await initSwap(
        invariant,
        swapper,
        tokenX,
        tokenY,
        fee,
        tickSpacing,
        true,
        swapAmount,
        true,
        MinSqrtPrice
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
    await initFeeTier(invariant, admin, fee, tickSpacing)

    await initBasicPool(invariant, admin, tokenX, tokenY)
    // positions
    const [lowerTickIndex, middleTickIndex, upperTickIndex] = [-20n, -10n, 10n]
    {
      const positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
      await withdrawTokens(positionOwner, [tokenX, positionsAmount], [tokenY, positionsAmount])

      const poolBefore = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
      const slippageLimit = poolBefore.sqrtPrice
      const liquidity = 1000000n * 10n ** LiquidityScale

      const positionAmount = positionsAmount / 2n

      await initPositionWithLiquidity(
        invariant,
        positionOwner,
        tokenX,
        positionAmount,
        tokenY,
        positionAmount,
        fee,
        tickSpacing,
        lowerTickIndex,
        upperTickIndex,
        liquidity,
        1n,
        slippageLimit,
        slippageLimit
      )

      await initPositionWithLiquidity(
        invariant,
        positionOwner,
        tokenX,
        positionAmount,
        tokenY,
        positionAmount,
        fee,
        tickSpacing,
        lowerTickIndex - 20n,
        middleTickIndex,
        liquidity,
        2n,
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
        InvariantError.LimitReached,
        initSwap(
          invariant,
          swapper,
          tokenX,
          tokenY,
          fee,
          tickSpacing,
          false,
          swapAmount,
          true,
          MaxSqrtPrice
        ),
        invariant
      )
    }
  })
})
