import { ONE_ALPH, web3 } from '@alephium/web3'
import { FungibleToken } from '../../../src/fungible-token'
import { Invariant } from '../../../src/invariant'
import { getSigner } from '@alephium/web3-test'
import {
  calculateSqrtPrice,
  getMaxSqrtPrice,
  getMinSqrtPrice,
  toLiquidity,
  toPercentage,
  toSqrtPrice
} from '../../../src/math'
import {
  filterTickmap,
  filterTicks,
  newFeeTier,
  newPoolKey,
  simulateInvariantSwap
} from '../../../src/utils'
import { expectError, expectVMError } from '../../../src/testUtils'
import {
  ArithmeticError,
  InvariantError,
  MAX_SQRT_PRICE,
  MAX_SWAP_STEPS,
  MAX_U256,
  MIN_SQRT_PRICE,
  SEARCH_RANGE,
  VMError
} from '../../../src/consts'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { FeeTier, Percentage, PoolKey, TokenAmount } from '../../../src/types'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let invariant: Invariant
let deployer: PrivateKeyWallet
let token: FungibleToken
let token0: string
let token1: string

let feeTier: FeeTier
let poolKey: PoolKey

describe('simulateInvariantSwap tests', () => {
  const protocolFee = toPercentage(1n, 2n)
  const suppliedAmount = 1000000000n as TokenAmount

  beforeEach(async () => {
    deployer = await getSigner(ONE_ALPH * 1000n, 0)
    invariant = await Invariant.deploy(deployer, protocolFee)
    feeTier = newFeeTier(toPercentage(1n, 2n), 1n)

    token = FungibleToken.load()
    token0 = await FungibleToken.deploy(deployer, suppliedAmount, 'Coin', 'COIN', 0n)
    token1 = await FungibleToken.deploy(deployer, suppliedAmount, 'Coin', 'COIN', 0n)
    poolKey = newPoolKey(token0, token1, feeTier)

    await invariant.addFeeTier(deployer, feeTier)
    await invariant.createPool(deployer, poolKey, toSqrtPrice(1n))

    const positionAmount = (suppliedAmount / 2n) as TokenAmount
    await invariant.createPosition(
      deployer,
      poolKey,
      -10n,
      10n,
      toLiquidity(10000000n),
      positionAmount,
      positionAmount,
      toSqrtPrice(1n),
      0n as Percentage
    )
  })
  describe('reaches price limit', () => {
    test('X to Y by amount in', async () => {
      const pool = await invariant.getPool(poolKey)

      const sqrtPriceLimit = calculateSqrtPrice(
        pool.currentTickIndex - feeTier.tickSpacing * SEARCH_RANGE * MAX_SWAP_STEPS
      )

      const amountIn = 6000n as TokenAmount
      const byAmountIn = true
      const xToY = true

      const tickmap = filterTickmap(
        await invariant.getFullTickmap(poolKey),
        poolKey.feeTier.tickSpacing,
        pool.currentTickIndex,
        xToY
      )

      const ticks = filterTicks(
        await invariant.getAllLiquidityTicks(poolKey, tickmap),
        pool.currentTickIndex,
        xToY
      )

      const simulation = simulateInvariantSwap(
        tickmap,
        pool,
        ticks,
        xToY,
        amountIn,
        byAmountIn,
        sqrtPriceLimit
      )

      expect(simulation.stateOutdated).toBeFalsy()
      expect(simulation.swapStepLimitReached).toBeFalsy()
      expect(simulation.insufficientLiquidity).toBeTruthy()
      expect(simulation.crossedTicks.length).toBe(1)

      const swapper = await getSigner(ONE_ALPH * 1000n, 0)
      await token.mint(swapper, amountIn, poolKey.tokenX)

      await expectError(
        InvariantError.PriceLimitReached,
        invariant.swap(swapper, poolKey, xToY, amountIn, byAmountIn, sqrtPriceLimit, amountIn),
        invariant.instance
      )
    })

    test('Y to X by amount in', async () => {
      const pool = await invariant.getPool(poolKey)

      const sqrtPriceLimit = calculateSqrtPrice(
        pool.currentTickIndex + feeTier.tickSpacing * SEARCH_RANGE * MAX_SWAP_STEPS
      )
      const amountIn = 6000n as TokenAmount
      const byAmountIn = true
      const xToY = false

      const tickmap = filterTickmap(
        await invariant.getFullTickmap(poolKey),
        poolKey.feeTier.tickSpacing,
        pool.currentTickIndex,
        xToY
      )

      const ticks = filterTicks(
        await invariant.getAllLiquidityTicks(poolKey, tickmap),
        pool.currentTickIndex,
        xToY
      )

      const simulation = simulateInvariantSwap(
        tickmap,
        pool,
        ticks,
        xToY,
        amountIn,
        byAmountIn,
        sqrtPriceLimit
      )

      expect(simulation.stateOutdated).toBeFalsy()
      expect(simulation.swapStepLimitReached).toBeFalsy()
      expect(simulation.insufficientLiquidity).toBeTruthy()
      expect(simulation.crossedTicks.length).toBe(1)

      const swapper = await getSigner(ONE_ALPH * 1000n, 0)
      await token.mint(swapper, amountIn, poolKey.tokenY)

      await expectError(
        InvariantError.PriceLimitReached,
        invariant.swap(swapper, poolKey, xToY, amountIn, byAmountIn, sqrtPriceLimit, amountIn),
        invariant.instance
      )
    })

    test('Y to X', async () => {
      const pool = await invariant.getPool(poolKey)
      const sqrtPriceLimit = calculateSqrtPrice(
        pool.currentTickIndex + feeTier.tickSpacing * SEARCH_RANGE * MAX_SWAP_STEPS
      )
      const amountIn = 5000n as TokenAmount
      const byAmountIn = false
      const xToY = false
      const tickmap = filterTickmap(
        await invariant.getFullTickmap(poolKey),
        poolKey.feeTier.tickSpacing,
        pool.currentTickIndex,
        xToY
      )

      const ticks = filterTicks(
        await invariant.getAllLiquidityTicks(poolKey, tickmap),
        pool.currentTickIndex,
        xToY
      )

      const simulation = simulateInvariantSwap(
        tickmap,
        pool,
        ticks,
        xToY,
        amountIn,
        byAmountIn,
        sqrtPriceLimit
      )

      expect(simulation.stateOutdated).toBeFalsy()
      expect(simulation.swapStepLimitReached).toBeFalsy()
      expect(simulation.insufficientLiquidity).toBeTruthy()
      expect(simulation.crossedTicks.length).toBe(1)

      const swapper = await getSigner(ONE_ALPH * 1000n, 0)
      await token.mint(swapper, amountIn, poolKey.tokenY)

      await expectError(
        InvariantError.PriceLimitReached,
        invariant.swap(swapper, poolKey, xToY, amountIn, byAmountIn, sqrtPriceLimit),
        invariant.instance
      )
    })

    test('X to Y', async () => {
      const pool = await invariant.getPool(poolKey)
      const sqrtPriceLimit = calculateSqrtPrice(
        pool.currentTickIndex - feeTier.tickSpacing * SEARCH_RANGE * MAX_SWAP_STEPS
      )
      const amountIn = 5000n as TokenAmount
      const byAmountIn = false
      const xToY = true

      const tickmap = filterTickmap(
        await invariant.getFullTickmap(poolKey),
        poolKey.feeTier.tickSpacing,
        pool.currentTickIndex,
        xToY
      )

      const ticks = filterTicks(
        await invariant.getAllLiquidityTicks(poolKey, tickmap),
        pool.currentTickIndex,
        xToY
      )

      const simulation = simulateInvariantSwap(
        tickmap,
        pool,
        ticks,
        xToY,
        amountIn,
        byAmountIn,
        sqrtPriceLimit
      )

      expect(simulation.stateOutdated).toBeFalsy()
      expect(simulation.swapStepLimitReached).toBeFalsy()
      expect(simulation.insufficientLiquidity).toBeTruthy()
      expect(simulation.crossedTicks.length).toBe(1)

      const swapper = await getSigner(ONE_ALPH * 1000n, 0)
      await token.mint(swapper, amountIn, poolKey.tokenX)

      await expectError(
        InvariantError.PriceLimitReached,
        invariant.swap(swapper, poolKey, xToY, amountIn, byAmountIn, sqrtPriceLimit),
        invariant.instance
      )
    })
  })

  describe('matches the price', () => {
    test('X to Y by amount in', async () => {
      const pool = await invariant.getPool(poolKey)
      const sqrtPriceLimit = getMinSqrtPrice(feeTier.tickSpacing)
      const amountIn = 4999n as TokenAmount
      const byAmountIn = true
      const xToY = true
      const tickmap = filterTickmap(
        await invariant.getFullTickmap(poolKey),
        poolKey.feeTier.tickSpacing,
        pool.currentTickIndex,
        xToY
      )
      const ticks = filterTicks(
        await invariant.getAllLiquidityTicks(poolKey, tickmap),
        pool.currentTickIndex,
        xToY
      )
      const simulation = simulateInvariantSwap(
        tickmap,
        pool,
        ticks,
        xToY,
        amountIn,
        byAmountIn,
        sqrtPriceLimit
      )

      const swapper = await getSigner(ONE_ALPH * 1000n, 0)
      await token.mint(swapper, amountIn, poolKey.tokenX)

      const poolBefore = await invariant.getPool(poolKey)
      await invariant.swap(swapper, poolKey, xToY, amountIn, byAmountIn, sqrtPriceLimit)

      const { sqrtPrice: targetSqrtPrice } = await invariant.getPool(poolKey)

      const tokenXBefore = await token.getBalanceOf(deployer.address, poolKey.tokenX)
      await invariant.claimFee(deployer, 0n)
      await invariant.withdrawProtocolFee(deployer, poolKey)
      const tokenXAfter = await token.getBalanceOf(deployer.address, poolKey.tokenX)

      const swapResult = {
        insufficientLiquidity: false,
        stateOutdated: false,
        swapStepLimitReached: false,
        amountIn,
        amountOut: await token.getBalanceOf(swapper.address, poolKey.tokenY),
        startSqrtPrice: poolBefore.sqrtPrice,
        targetSqrtPrice,
        fee: tokenXAfter - tokenXBefore
      }

      expect(simulation).toMatchObject(swapResult)
      expect(simulation.crossedTicks.length).toBe(0)
    })
    test('Y to X by amount in', async () => {
      const pool = await invariant.getPool(poolKey)
      const sqrtPriceLimit = getMaxSqrtPrice(feeTier.tickSpacing)
      const amountIn = 4999n as TokenAmount
      const byAmountIn = true
      const xToY = false
      const tickmap = filterTickmap(
        await invariant.getFullTickmap(poolKey),
        poolKey.feeTier.tickSpacing,
        pool.currentTickIndex,
        xToY
      )
      const ticks = filterTicks(
        await invariant.getAllLiquidityTicks(poolKey, tickmap),
        pool.currentTickIndex,
        xToY
      )
      const simulation = simulateInvariantSwap(
        tickmap,
        pool,
        ticks,
        xToY,
        amountIn,
        byAmountIn,
        sqrtPriceLimit
      )

      const swapper = await getSigner(ONE_ALPH * 1000n, 0)
      await token.mint(swapper, amountIn, poolKey.tokenY)

      const poolBefore = await invariant.getPool(poolKey)
      await invariant.swap(swapper, poolKey, xToY, amountIn, byAmountIn, sqrtPriceLimit)
      const { sqrtPrice: targetSqrtPrice } = await invariant.getPool(poolKey)

      const tokenYBefore = await token.getBalanceOf(deployer.address, poolKey.tokenY)
      await invariant.claimFee(deployer, 0n)
      await invariant.withdrawProtocolFee(deployer, poolKey)
      const tokenYAfter = await token.getBalanceOf(deployer.address, poolKey.tokenY)

      const swapResult = {
        insufficientLiquidity: false,
        stateOutdated: false,
        swapStepLimitReached: false,
        amountIn,
        amountOut: await token.getBalanceOf(swapper.address, poolKey.tokenX),
        startSqrtPrice: poolBefore.sqrtPrice,
        targetSqrtPrice,
        fee: tokenYAfter - tokenYBefore
      }

      expect(simulation).toMatchObject(swapResult)
      expect(simulation.crossedTicks.length).toBe(0)
    })
    test('Y to X', async () => {
      const pool = await invariant.getPool(poolKey)
      const sqrtPriceLimit = getMaxSqrtPrice(feeTier.tickSpacing)

      const amountOut = 4888n as TokenAmount
      const byAmountIn = false
      const xToY = false

      const tickmap = filterTickmap(
        await invariant.getFullTickmap(poolKey),
        poolKey.feeTier.tickSpacing,
        pool.currentTickIndex,
        xToY
      )
      const ticks = filterTicks(
        await invariant.getAllLiquidityTicks(poolKey, tickmap),
        pool.currentTickIndex,
        xToY
      )
      const simulation = simulateInvariantSwap(
        tickmap,
        pool,
        ticks,
        xToY,
        amountOut,
        byAmountIn,
        sqrtPriceLimit
      )

      const swapper = await getSigner(ONE_ALPH * 1000n, 0)
      const amountMinted = (amountOut * 2n) as TokenAmount
      await token.mint(swapper, amountMinted, poolKey.tokenY)

      const { sqrtPrice: startSqrtPrice } = await invariant.getPool(poolKey)
      await invariant.swap(
        swapper,
        poolKey,
        xToY,
        amountOut,
        byAmountIn,
        sqrtPriceLimit,
        amountMinted
      )
      const { sqrtPrice: targetSqrtPrice } = await invariant.getPool(poolKey)

      const tokenYBefore = await token.getBalanceOf(deployer.address, poolKey.tokenY)
      await invariant.claimFee(deployer, 0n)
      await invariant.withdrawProtocolFee(deployer, poolKey)
      const tokenYAfter = await token.getBalanceOf(deployer.address, poolKey.tokenY)

      expect(simulation).toMatchObject({
        insufficientLiquidity: false,
        stateOutdated: false,
        swapStepLimitReached: false,
        amountIn: amountMinted - (await token.getBalanceOf(swapper.address, poolKey.tokenY)),
        amountOut: await token.getBalanceOf(swapper.address, poolKey.tokenX),
        startSqrtPrice,
        targetSqrtPrice,
        fee: tokenYAfter - tokenYBefore
      })
      expect(simulation.crossedTicks.length).toBe(0)
    })
    test('X to Y', async () => {
      const pool = await invariant.getPool(poolKey)
      const sqrtPriceLimit = getMinSqrtPrice(feeTier.tickSpacing)
      const amountOut = 4888n as TokenAmount
      const byAmountIn = false
      const xToY = true
      const tickmap = filterTickmap(
        await invariant.getFullTickmap(poolKey),
        poolKey.feeTier.tickSpacing,
        pool.currentTickIndex,
        xToY
      )
      const ticks = filterTicks(
        await invariant.getAllLiquidityTicks(poolKey, tickmap),
        pool.currentTickIndex,
        xToY
      )
      const simulation = simulateInvariantSwap(
        tickmap,
        pool,
        ticks,
        xToY,
        amountOut,
        byAmountIn,
        sqrtPriceLimit
      )

      const swapper = await getSigner(ONE_ALPH * 1000n, 0)
      const amountMinted = (amountOut * 2n) as TokenAmount
      await token.mint(swapper, amountMinted, poolKey.tokenX)

      const { sqrtPrice: startSqrtPrice } = await invariant.getPool(poolKey)
      await invariant.swap(
        swapper,
        poolKey,
        xToY,
        amountOut,
        byAmountIn,
        sqrtPriceLimit,
        amountMinted
      )
      const { sqrtPrice: targetSqrtPrice } = await invariant.getPool(poolKey)

      const tokenXBefore = await token.getBalanceOf(deployer.address, poolKey.tokenX)
      await invariant.claimFee(deployer, 0n)
      await invariant.withdrawProtocolFee(deployer, poolKey)
      const tokenXAfter = await token.getBalanceOf(deployer.address, poolKey.tokenX)

      expect(simulation).toMatchObject({
        insufficientLiquidity: false,
        stateOutdated: false,
        swapStepLimitReached: false,
        amountIn: amountMinted - (await token.getBalanceOf(swapper.address, poolKey.tokenX)),
        amountOut: await token.getBalanceOf(swapper.address, poolKey.tokenY),
        startSqrtPrice,
        targetSqrtPrice,
        fee: tokenXAfter - tokenXBefore
      })
      expect(simulation.crossedTicks.length).toBe(0)
    })
  })

  describe('outdated data in', () => {
    test('pool', async () => {
      const pool = await invariant.getPool(poolKey)

      const sqrtPriceLimit = getMaxSqrtPrice(feeTier.tickSpacing)
      const amountIn = 6000n as TokenAmount
      const byAmountIn = true
      const xToY = false

      const positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
      const suppliedAmount = 1000000n as TokenAmount
      await token.mint(positionOwner, suppliedAmount, poolKey.tokenX)
      await token.mint(positionOwner, suppliedAmount, poolKey.tokenY)
      await invariant.createPosition(
        positionOwner,
        poolKey,
        -10n,
        10n,
        toLiquidity(100000000n),
        suppliedAmount,
        suppliedAmount,
        toSqrtPrice(1n),
        0n as Percentage
      )

      const tickmap = filterTickmap(
        await invariant.getFullTickmap(poolKey),
        poolKey.feeTier.tickSpacing,
        pool.currentTickIndex,
        xToY
      )

      const ticks = filterTicks(
        await invariant.getAllLiquidityTicks(poolKey, tickmap),
        pool.currentTickIndex,
        xToY
      )

      const simulation = simulateInvariantSwap(
        tickmap,
        pool,
        ticks,
        xToY,
        amountIn,
        byAmountIn,
        sqrtPriceLimit
      )

      expect(simulation.insufficientLiquidity).toBeFalsy()
      expect(simulation.swapStepLimitReached).toBeFalsy()
      expect(simulation.stateOutdated).toBeTruthy()
      expect(simulation.crossedTicks.length).toBe(0)
    })

    test('tickmap', async () => {
      const pool = await invariant.getPool(poolKey)

      const sqrtPriceLimit = getMaxSqrtPrice(feeTier.tickSpacing)
      const amountIn = 6000n as TokenAmount
      const byAmountIn = true
      const xToY = false

      const tickmap = filterTickmap(
        await invariant.getFullTickmap(poolKey),
        poolKey.feeTier.tickSpacing,
        pool.currentTickIndex,
        xToY
      )

      const positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
      const suppliedAmount = 1000000n as TokenAmount
      await token.mint(positionOwner, suppliedAmount, poolKey.tokenX)
      await token.mint(positionOwner, suppliedAmount, poolKey.tokenY)
      await invariant.createPosition(
        positionOwner,
        poolKey,
        -20n,
        10n,
        toLiquidity(100000000n),
        suppliedAmount,
        suppliedAmount,
        toSqrtPrice(1n),
        0n as Percentage
      )

      const ticks = filterTicks(
        await invariant.getAllLiquidityTicks(poolKey, tickmap),
        pool.currentTickIndex,
        xToY
      )

      const simulation = simulateInvariantSwap(
        tickmap,
        pool,
        ticks,
        xToY,
        amountIn,
        byAmountIn,
        sqrtPriceLimit
      )

      expect(simulation.insufficientLiquidity).toBeFalsy()
      expect(simulation.swapStepLimitReached).toBeFalsy()
      expect(simulation.stateOutdated).toBeTruthy()
      expect(simulation.crossedTicks.length).toBe(0)
    })

    test('ticks', async () => {
      const sqrtPriceLimit = getMinSqrtPrice(feeTier.tickSpacing)
      const amountIn = 20000n as TokenAmount
      const byAmountIn = true
      const xToY = true

      const positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
      const suppliedAmount = 1000000n as TokenAmount
      await token.mint(positionOwner, suppliedAmount, poolKey.tokenX)
      await token.mint(positionOwner, suppliedAmount, poolKey.tokenY)
      await invariant.createPosition(
        positionOwner,
        poolKey,
        -20n,
        10n,
        toLiquidity(10000000n),
        suppliedAmount,
        suppliedAmount,
        toSqrtPrice(1n),
        0n as Percentage
      )

      const pool = await invariant.getPool(poolKey)
      const ticks = filterTicks(
        await invariant.getLiquidityTicks(poolKey, [10n, -10n]),
        pool.currentTickIndex,
        xToY
      )

      const tickmap = filterTickmap(
        await invariant.getFullTickmap(poolKey),
        poolKey.feeTier.tickSpacing,
        pool.currentTickIndex,
        xToY
      )

      const simulation = simulateInvariantSwap(
        tickmap,
        pool,
        ticks,
        xToY,
        amountIn,
        byAmountIn,
        sqrtPriceLimit
      )

      expect(simulation).toMatchObject({
        insufficientLiquidity: false,
        stateOutdated: true,
        swapStepLimitReached: false
      })
      expect(simulation.crossedTicks.length).toBe(1)
    })
  })
  it('max ticks crossed', async function () {
    const sqrtPriceLimit = getMinSqrtPrice(feeTier.tickSpacing)
    const amountIn = 3000000n as TokenAmount
    const byAmountIn = true
    const xToY = true

    const mintAmount = (1n << 120n) as TokenAmount
    await token.mint(deployer, mintAmount, token0)
    await token.mint(deployer, mintAmount, token1)

    const liquidityDelta = toLiquidity(10000000n)
    const spotSqrtPrice = toSqrtPrice(1n)

    const indexes: bigint[] = []

    for (let i = -40n; i < 5; i += 1n) {
      indexes.push(i + 1n)
      await invariant.createPosition(
        deployer,
        poolKey,
        i,
        i + 1n,
        liquidityDelta,
        mintAmount,
        mintAmount,
        spotSqrtPrice,
        0n as Percentage
      )
    }

    const pool = await invariant.getPool(poolKey)

    const tickmap = filterTickmap(
      await invariant.getFullTickmap(poolKey),
      poolKey.feeTier.tickSpacing,
      pool.currentTickIndex,
      xToY
    )

    const ticks = filterTicks(
      await invariant.getAllLiquidityTicks(poolKey, tickmap),
      pool.currentTickIndex,
      xToY
    )

    const simulation = simulateInvariantSwap(
      tickmap,
      pool,
      ticks,
      xToY,
      amountIn,
      byAmountIn,
      sqrtPriceLimit
    )

    expect(simulation).toMatchObject({
      insufficientLiquidity: false,
      stateOutdated: false,
      swapStepLimitReached: true
    })
    expect(simulation.crossedTicks.length).toBe(Number(MAX_SWAP_STEPS) + 1)
  })
  describe('max token amount', () => {
    test('X to Y by amount in', async () => {
      const pool = await invariant.getPool(poolKey)

      const amountIn = MAX_U256 as TokenAmount
      const byAmountIn = true
      const xToY = true

      const tickmap = filterTickmap(
        await invariant.getFullTickmap(poolKey),
        poolKey.feeTier.tickSpacing,
        pool.currentTickIndex,
        xToY
      )
      const ticks = filterTicks(
        await invariant.getAllLiquidityTicks(poolKey, tickmap),
        pool.currentTickIndex,
        xToY
      )

      const simulation = simulateInvariantSwap(
        tickmap,
        pool,
        ticks,
        xToY,
        amountIn,
        byAmountIn,
        MIN_SQRT_PRICE
      )

      expect(simulation).toMatchObject({
        insufficientLiquidity: false,
        stateOutdated: false,
        swapStepLimitReached: true
      })
      expect(simulation.crossedTicks.length).toBe(1)

      const swapper = await getSigner(ONE_ALPH * 1000n, 0)
      await token.mint(swapper, suppliedAmount, poolKey.tokenX)

      await expectVMError(
        VMError.NotEnoughBalance,
        invariant.swap(swapper, poolKey, xToY, amountIn, byAmountIn, MIN_SQRT_PRICE, suppliedAmount)
      )
    })

    test('X to Y by amount out', async () => {
      const pool = await invariant.getPool(poolKey)

      const amountIn = MAX_U256 as TokenAmount
      const byAmountIn = false
      const xToY = true

      const tickmap = filterTickmap(
        await invariant.getFullTickmap(poolKey),
        poolKey.feeTier.tickSpacing,
        pool.currentTickIndex,
        xToY
      )
      const ticks = filterTicks(
        await invariant.getAllLiquidityTicks(poolKey, tickmap),
        pool.currentTickIndex,
        xToY
      )

      const simulation = simulateInvariantSwap(
        tickmap,
        pool,
        ticks,
        xToY,
        amountIn,
        byAmountIn,
        MIN_SQRT_PRICE
      )
      expect(simulation).toMatchObject({
        insufficientLiquidity: false,
        stateOutdated: false,
        swapStepLimitReached: true
      })
      expect(simulation.crossedTicks.length).toBe(1)

      const swapper = await getSigner(ONE_ALPH * 1000n, 0)
      await token.mint(swapper, suppliedAmount, poolKey.tokenX)

      await expectError(
        ArithmeticError.CastOverflow,
        invariant.swap(swapper, poolKey, xToY, amountIn, byAmountIn, MIN_SQRT_PRICE, suppliedAmount)
      )
    })

    test('Y to X by amount in', async () => {
      const pool = await invariant.getPool(poolKey)
      const amountIn = MAX_U256 as TokenAmount
      const byAmountIn = true
      const xToY = false

      const tickmap = filterTickmap(
        await invariant.getFullTickmap(poolKey),
        poolKey.feeTier.tickSpacing,
        pool.currentTickIndex,
        xToY
      )
      const ticks = filterTicks(
        await invariant.getAllLiquidityTicks(poolKey, tickmap),
        pool.currentTickIndex,
        xToY
      )

      const simulation = simulateInvariantSwap(
        tickmap,
        pool,
        ticks,
        xToY,
        amountIn,
        byAmountIn,
        MAX_SQRT_PRICE
      )

      expect(simulation).toMatchObject({
        insufficientLiquidity: false,
        stateOutdated: false,
        swapStepLimitReached: true
      })
      expect(simulation.crossedTicks.length).toBe(1)

      const swapper = await getSigner(ONE_ALPH * 1000n, 0)
      await token.mint(swapper, suppliedAmount, poolKey.tokenY)

      await expectVMError(
        VMError.NotEnoughBalance,
        invariant.swap(swapper, poolKey, xToY, amountIn, byAmountIn, MAX_SQRT_PRICE, suppliedAmount)
      )
    })

    it('Y to X by amount out', async () => {
      const pool = await invariant.getPool(poolKey)

      const amountIn = MAX_U256 as TokenAmount
      const byAmountIn = false
      const xToY = false

      const tickmap = filterTickmap(
        await invariant.getFullTickmap(poolKey),
        poolKey.feeTier.tickSpacing,
        pool.currentTickIndex,
        xToY
      )
      const ticks = filterTicks(
        await invariant.getAllLiquidityTicks(poolKey, tickmap),
        pool.currentTickIndex,
        xToY
      )

      const simulation = simulateInvariantSwap(
        tickmap,
        pool,
        ticks,
        xToY,
        amountIn,
        byAmountIn,
        MAX_SQRT_PRICE
      )

      expect(simulation).toMatchObject({
        insufficientLiquidity: false,
        stateOutdated: false,
        swapStepLimitReached: true
      })
      expect(simulation.crossedTicks.length).toBe(1)

      const swapper = await getSigner(ONE_ALPH * 1000n, 0)
      await token.mint(swapper, suppliedAmount, poolKey.tokenY)

      // in CLAMM.isEnoughAmountToChangePrice:
      // deltaSqrtPrice < bigMulDiv256(startingSqrtPrice, x, TOKEN_AMOUNT_DENOMINATOR)
      // arithmetic error - subUnderflow
      await expectVMError(
        VMError.ArithmeticError,
        invariant.swap(swapper, poolKey, xToY, amountIn, byAmountIn, MAX_SQRT_PRICE, suppliedAmount)
      )
    })
  })
})
