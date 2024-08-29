import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { Invariant } from '../../../src/invariant'
import { Network } from '../../../src/network'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { getBasicFeeTickSpacing } from '../../../src/snippets'
import { TokenFaucetInstance } from '../../../artifacts/ts'
import { expectVMError, initTokensXY, withdrawTokens } from '../../../src/testUtils'
import { balanceOf, newFeeTier, newPoolKey } from '../../../src/utils'
import { MAX_LIQUIDITY_TICKS_QUERIED, VMError } from '../../../src/consts'
import { FeeTier, Liquidity, Percentage, PoolKey, TokenAmount } from '../../../src/types'
import { toSqrtPrice } from '../../../src'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let invariant: Invariant
let deployer: PrivateKeyWallet
let positionOwner: PrivateKeyWallet
let tokenX: TokenFaucetInstance
let tokenY: TokenFaucetInstance
let feeTier: FeeTier
let poolKey: PoolKey

describe('query liquidity ticks tests', () => {
  const initialFee = 0n as Percentage
  const [fee] = getBasicFeeTickSpacing()
  const tickSpacing = 1n
  const initSqrtPrice = toSqrtPrice(1n)
  const supply = (10n ** 10n) as TokenAmount

  beforeEach(async () => {
    deployer = await getSigner(ONE_ALPH * 1000n, 0)
    positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
    invariant = await Invariant.deploy(deployer, Network.Local, initialFee)
    ;[tokenX, tokenY] = await initTokensXY(deployer, supply)

    feeTier = await newFeeTier(fee, tickSpacing)
    poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    await invariant.addFeeTier(deployer, feeTier)
    await invariant.createPool(
      deployer,
      tokenX.contractId,
      tokenY.contractId,
      feeTier,
      initSqrtPrice
    )
    await withdrawTokens(positionOwner, [tokenX, supply], [tokenY, supply])
  })
  test('get liquidity ticks', async () => {
    const { sqrtPrice } = await invariant.getPool(poolKey)
    const [lowerTickIndex, upperTickIndex] = [-20n, -10n]
    const approveX = await balanceOf(tokenX.contractId, positionOwner.address)
    const approveY = await balanceOf(tokenY.contractId, positionOwner.address)
    await invariant.createPosition(
      positionOwner,
      poolKey,
      lowerTickIndex,
      upperTickIndex,
      10n as Liquidity,
      approveX,
      approveY,
      sqrtPrice,
      sqrtPrice
    )
    const ticksAmount = await invariant.getLiquidityTicksAmount(
      poolKey,
      lowerTickIndex,
      upperTickIndex
    )

    expect(ticksAmount).toBe(2n)
    const liquidityTicks = await invariant.getLiquidityTicks(poolKey, [
      lowerTickIndex,
      upperTickIndex
    ])
    const lowerTick = await invariant.getTick(poolKey, lowerTickIndex)
    const upperTick = await invariant.getTick(poolKey, upperTickIndex)

    expect(liquidityTicks.length).toBe(2)
    expect(lowerTick).toMatchObject(liquidityTicks[0])
    expect(upperTick).toMatchObject(liquidityTicks[1])
  })

  test('different tick spacing', async () => {
    const feeTier2TS = await newFeeTier(fee, 2n)
    const feeTier10TS = await newFeeTier(fee, 10n)

    const poolKey2TS = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier2TS)
    const poolKey10TS = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier10TS)

    await invariant.addFeeTier(deployer, feeTier2TS)
    await invariant.addFeeTier(deployer, feeTier10TS)

    await invariant.createPool(
      deployer,
      tokenX.contractId,
      tokenY.contractId,
      feeTier2TS,
      initSqrtPrice
    )
    await invariant.createPool(
      deployer,
      tokenX.contractId,
      tokenY.contractId,
      feeTier10TS,
      initSqrtPrice
    )

    const { sqrtPrice } = await invariant.getPool(poolKey)

    {
      const [lowerTickIndex, upperTickIndex] = [-10n, 30n]
      const approveX = await balanceOf(tokenX.contractId, positionOwner.address)
      const approveY = await balanceOf(tokenY.contractId, positionOwner.address)
      await invariant.createPosition(
        positionOwner,
        poolKey2TS,
        lowerTickIndex,
        upperTickIndex,
        10n as Liquidity,
        approveX,
        approveY,
        sqrtPrice,
        sqrtPrice
      )
      const ticksAmount = await invariant.getLiquidityTicksAmount(
        poolKey2TS,
        lowerTickIndex,
        upperTickIndex
      )

      expect(ticksAmount).toBe(2n)
      const liquidityTicks = await invariant.getLiquidityTicks(poolKey2TS, [
        lowerTickIndex,
        upperTickIndex
      ])
      const lowerTick = await invariant.getTick(poolKey2TS, lowerTickIndex)
      const upperTick = await invariant.getTick(poolKey2TS, upperTickIndex)

      expect(liquidityTicks.length).toBe(2)
      expect(lowerTick).toMatchObject(liquidityTicks[0])
      expect(upperTick).toMatchObject(liquidityTicks[1])
    }
    {
      const [lowerTickIndex, upperTickIndex] = [-20n, 40n]
      const approveX = await balanceOf(tokenX.contractId, positionOwner.address)
      const approveY = await balanceOf(tokenY.contractId, positionOwner.address)
      await invariant.createPosition(
        positionOwner,
        poolKey10TS,
        lowerTickIndex,
        upperTickIndex,
        10n as Liquidity,
        approveX,
        approveY,
        sqrtPrice,
        sqrtPrice
      )
      const ticksAmount = await invariant.getLiquidityTicksAmount(
        poolKey10TS,
        lowerTickIndex,
        upperTickIndex
      )

      expect(ticksAmount).toBe(2n)
      const liquidityTicks = await invariant.getLiquidityTicks(poolKey10TS, [
        lowerTickIndex,
        upperTickIndex
      ])
      const lowerTick = await invariant.getTick(poolKey10TS, lowerTickIndex)
      const upperTick = await invariant.getTick(poolKey10TS, upperTickIndex)

      expect(liquidityTicks.length).toBe(2)
      expect(lowerTick).toMatchObject(liquidityTicks[0])
      expect(upperTick).toMatchObject(liquidityTicks[1])
    }
  })
  test('get limit with spread between ticks', async () => {
    const { sqrtPrice } = await invariant.getPool(poolKey)

    const pairs = Number(MAX_LIQUIDITY_TICKS_QUERIED / 2n)
    const ticks = new Array(pairs)
      .fill(null)
      .map((_, index) => [BigInt((-index - 1) * 64), BigInt((index + 1) * 64)])

    for (const [lowerTick, upperTick] of ticks) {
      const approveX = await balanceOf(tokenX.contractId, positionOwner.address)
      const approveY = await balanceOf(tokenY.contractId, positionOwner.address)
      await invariant.createPosition(
        positionOwner,
        poolKey,
        lowerTick,
        upperTick,
        10n as Liquidity,
        approveX,
        approveY,
        sqrtPrice,
        sqrtPrice
      )
    }

    const [minInitializedTick, maxInitializedTick] = ticks[ticks.length - 1]
    const ticksAmount = await invariant.getLiquidityTicksAmount(
      poolKey,
      minInitializedTick,
      maxInitializedTick
    )
    expect(ticksAmount).toBe(MAX_LIQUIDITY_TICKS_QUERIED - 1n)

    const flattenTicks = ticks.flat()
    const liquidityTicks = await invariant.getLiquidityTicks(poolKey, flattenTicks)
    expect(liquidityTicks.length).toBe(Number(MAX_LIQUIDITY_TICKS_QUERIED - 1n))
  })

  test('find query limit', async () => {
    const { sqrtPrice } = await invariant.getPool(poolKey)

    const pairs = Number(MAX_LIQUIDITY_TICKS_QUERIED / 2n)
    const ticks = new Array(pairs)
      .fill(null)
      .map((_, index) => [BigInt(index * 2), BigInt(index * 2 + 1)])

    for (const [lowerTick, upperTick] of ticks) {
      const approveX = await balanceOf(tokenX.contractId, positionOwner.address)
      const approveY = await balanceOf(tokenY.contractId, positionOwner.address)
      await invariant.createPosition(
        positionOwner,
        poolKey,
        lowerTick,
        upperTick,
        10n as Liquidity,
        approveX,
        approveY,
        sqrtPrice,
        sqrtPrice
      )
    }

    const flattenTicks = ticks.flat()
    const upperTick = flattenTicks[flattenTicks.length - 1] + 1n
    flattenTicks.push(upperTick)

    const approveX = await balanceOf(tokenX.contractId, positionOwner.address)
    const approveY = await balanceOf(tokenY.contractId, positionOwner.address)
    await invariant.createPosition(
      positionOwner,
      poolKey,
      0n,
      upperTick,
      10n as Liquidity,
      approveX,
      approveY,
      sqrtPrice,
      sqrtPrice
    )

    const singleQueryLiquidityTicks = await invariant.getLiquidityTicks(poolKey, flattenTicks)
    const tickmap = await invariant.getFullTickmap(poolKey)
    const getAllLiquidityTicks = await invariant.getAllLiquidityTicks(poolKey, tickmap)
    expect(singleQueryLiquidityTicks.length).toBe(getAllLiquidityTicks.length)
    for (const [index, liquidityTick] of singleQueryLiquidityTicks.entries()) {
      expect(liquidityTick).toMatchObject(getAllLiquidityTicks[index])
    }
  })
  test('query over limit fails in single call - passes in multiple', async () => {
    const { sqrtPrice } = await invariant.getPool(poolKey)

    const pairs = Number(MAX_LIQUIDITY_TICKS_QUERIED / 2n) + 1
    const ticks = new Array(pairs)
      .fill(null)
      .map((_, index) => [BigInt(index * 2), BigInt(index * 2 + 1)])

    for (const [lowerTick, upperTick] of ticks) {
      const approveX = await balanceOf(tokenX.contractId, positionOwner.address)
      const approveY = await balanceOf(tokenY.contractId, positionOwner.address)
      await invariant.createPosition(
        positionOwner,
        poolKey,
        lowerTick,
        upperTick,
        10n as Liquidity,
        approveX,
        approveY,
        sqrtPrice,
        sqrtPrice
      )
    }

    const flattenTicks = ticks.flat()

    expectVMError(VMError.OutOfGas, invariant.getLiquidityTicks(poolKey, flattenTicks))
    const tickmap = await invariant.getFullTickmap(poolKey)
    const getAllLiquidityTicks = await invariant.getAllLiquidityTicks(poolKey, tickmap)
    expect(getAllLiquidityTicks.length).toBe(Number(MAX_LIQUIDITY_TICKS_QUERIED + 1n))
    for (const liquidityTick of getAllLiquidityTicks) {
      const tick = await invariant.getTick(poolKey, liquidityTick.index)
      expect(tick).toMatchObject(liquidityTick)
    }
  })
})
