import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { initDexAndTokens } from '../../../src/snippets'
import {
  GLOBAL_MAX_TICK,
  GLOBAL_MIN_TICK,
  MAX_SQRT_PRICE,
  MAX_U256,
  MIN_SQRT_PRICE
} from '../../../src/consts'
import {
  getPool,
  getReserveBalances,
  initFeeTier,
  initPool,
  initPosition,
  initSwap,
  withdrawTokens
} from '../../../src/testUtils'
import {
  calculateSqrtPrice,
  getDeltaY,
  getLiquidityByX,
  getLiquidityByY,
  getMaxTick,
  toPercentage
} from '../../../src/math'
import { balanceOf, newFeeTier, newPoolKey } from '../../../src/utils'
import { Liquidity, TokenAmount } from '../../../src'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let admin: PrivateKeyWallet

const withdrawAmount = MAX_U256 as TokenAmount
describe('limits tests', () => {
  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
  })

  test('big deposit x and swap y', async () => {
    await bigDepositOneAndSwapTheOther(true)
  })
  test('big deposit y and swap x', async () => {
    await bigDepositOneAndSwapTheOther(false)
  })
  test('big deposit both tokens', async () => {
    const [invariant, tokenX, tokenY] = await initDexAndTokens(admin, withdrawAmount)

    const user = await getSigner(ONE_ALPH * 1000n, 0)
    await withdrawTokens(user, [tokenX, withdrawAmount], [tokenY, withdrawAmount])

    const limitAmount = (2n ** 176n) as TokenAmount
    const [fee, tickSpacing] = [toPercentage(6n, 3n), 1n]
    const feeTier = newFeeTier(fee, tickSpacing)
    const poolKey = newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)
    await initFeeTier(invariant, admin, feeTier)

    const initTick = 0n
    const initSqrtPrice = calculateSqrtPrice(initTick)

    await initPool(invariant, user, tokenX, tokenY, feeTier, initSqrtPrice, initTick)

    const [lowerTick, upperTick] = [-tickSpacing, tickSpacing]
    const { sqrtPrice } = await getPool(invariant, poolKey)

    const { l: liquidityDelta } = getLiquidityByX(
      limitAmount,
      lowerTick,
      upperTick,
      sqrtPrice,
      true
    )
    const y = getDeltaY(calculateSqrtPrice(lowerTick), sqrtPrice, liquidityDelta, true)
    const slippageLimit = initSqrtPrice

    await initPosition(
      invariant,
      user,
      poolKey,
      withdrawAmount,
      withdrawAmount,
      lowerTick,
      upperTick,
      liquidityDelta,
      slippageLimit,
      slippageLimit
    )

    const userBalance = {
      tokenX: await balanceOf(tokenX.contractId, user.address),
      tokenY: await balanceOf(tokenY.contractId, user.address)
    }
    expect(userBalance).toMatchObject({
      tokenX: MAX_U256 - limitAmount,
      tokenY: MAX_U256 - y
    })

    const invariantBalance = await getReserveBalances(invariant, poolKey)

    expect(invariantBalance).toMatchObject({
      x: limitAmount,
      y: y
    })
  })

  test('deposit limits at upper limit', async () => {
    const [invariant, tokenX, tokenY] = await initDexAndTokens(admin, withdrawAmount)

    const user = await getSigner(ONE_ALPH * 1000n, 0)
    await withdrawTokens(user, [tokenX, withdrawAmount], [tokenY, withdrawAmount])

    const [fee, tickSpacing] = [toPercentage(6n, 3n), 1n]
    const feeTier = newFeeTier(fee, tickSpacing)
    const poolKey = newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)
    await initFeeTier(invariant, admin, feeTier)

    const initTick = getMaxTick(tickSpacing)
    const initSqrtPrice = calculateSqrtPrice(initTick)

    await initPool(invariant, user, tokenX, tokenY, feeTier, initSqrtPrice, initTick)

    const { currentTickIndex, sqrtPrice } = await getPool(invariant, poolKey)
    expect(currentTickIndex).toBe(initTick)
    expect(sqrtPrice).toBe(initSqrtPrice)

    const { l: liquidityDelta } = getLiquidityByY(
      MAX_U256 as TokenAmount,
      0n,
      GLOBAL_MAX_TICK,
      sqrtPrice,
      false
    )

    const slippageLimit = sqrtPrice

    await initPosition(
      invariant,
      user,
      poolKey,
      withdrawAmount,
      withdrawAmount,
      0n,
      GLOBAL_MAX_TICK,
      liquidityDelta,
      slippageLimit,
      slippageLimit
    )
  })

  test('big deposit and swaps', async () => {
    const [invariant, tokenX, tokenY] = await initDexAndTokens(admin, withdrawAmount)

    const user = await getSigner(ONE_ALPH * 1000n, 0)
    await withdrawTokens(user, [tokenX, withdrawAmount], [tokenY, withdrawAmount])

    const limitAmount = 2n ** 177n
    const [fee, tickSpacing] = [toPercentage(6n, 3n), 1n]
    const feeTier = newFeeTier(fee, tickSpacing)
    const poolKey = newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)
    await initFeeTier(invariant, admin, feeTier)

    const initTick = 0n
    const initSqrtPrice = calculateSqrtPrice(initTick)

    await initPool(invariant, user, tokenX, tokenY, feeTier, initSqrtPrice, initTick)

    const [lowerTick, upperTick] = [-tickSpacing, tickSpacing]
    const { sqrtPrice } = await getPool(invariant, poolKey)

    const posAmount = (limitAmount / 2n) as TokenAmount
    const { l: liquidityDelta } = getLiquidityByX(posAmount, lowerTick, upperTick, sqrtPrice, false)

    const y = getDeltaY(calculateSqrtPrice(lowerTick), sqrtPrice, liquidityDelta, true)

    const slippageLimit = initSqrtPrice
    await initPosition(
      invariant,
      user,
      poolKey,
      withdrawAmount,
      withdrawAmount,
      lowerTick,
      upperTick,
      liquidityDelta,
      slippageLimit,
      slippageLimit
    )

    {
      const userBalance = {
        tokenX: await balanceOf(tokenX.contractId, user.address),
        tokenY: await balanceOf(tokenY.contractId, user.address)
      }
      expect(userBalance).toMatchObject({
        tokenX: MAX_U256 - posAmount,
        tokenY: MAX_U256 - y
      })

      const invariantBalance = await getReserveBalances(invariant, poolKey)

      expect(invariantBalance).toMatchObject({
        x: posAmount,
        y
      })
    }

    const swapAmount = (limitAmount / 8n) as TokenAmount

    for (let n = 1; n <= 4; ++n) {
      await initSwap(
        invariant,
        user,
        poolKey,
        n % 2 === 0,
        swapAmount,
        true,
        n % 2 === 0 ? MIN_SQRT_PRICE : MAX_SQRT_PRICE
      )
    }
  })
  test('full range with max liquidity', async () => {
    const [invariant, tokenX, tokenY] = await initDexAndTokens(admin, withdrawAmount)

    const user = await getSigner(ONE_ALPH * 1000n, 0)
    await withdrawTokens(user, [tokenX, withdrawAmount], [tokenY, withdrawAmount])

    const [fee, tickSpacing] = [toPercentage(6n, 3n), 1n]
    const feeTier = newFeeTier(fee, tickSpacing)
    const poolKey = newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)
    await initFeeTier(invariant, admin, feeTier)

    const initTick = getMaxTick(tickSpacing)
    const initSqrtPrice = calculateSqrtPrice(initTick)

    await initPool(invariant, user, tokenX, tokenY, feeTier, initSqrtPrice, initTick)
    const { currentTickIndex, sqrtPrice } = await getPool(invariant, poolKey)
    expect(currentTickIndex).toBe(initTick)
    expect(sqrtPrice).toBe(initSqrtPrice)
    const slippageLimit = initSqrtPrice

    const { l: liquidityDelta } = getLiquidityByY(
      MAX_U256 as TokenAmount,
      GLOBAL_MIN_TICK,
      GLOBAL_MAX_TICK,
      sqrtPrice,
      false
    )

    await initPosition(
      invariant,
      user,
      poolKey,
      withdrawAmount,
      withdrawAmount,
      GLOBAL_MIN_TICK,
      GLOBAL_MAX_TICK,
      liquidityDelta,
      slippageLimit,
      slippageLimit
    )

    const invariantBalance = await getReserveBalances(invariant, poolKey)

    expect(invariantBalance).toMatchObject({
      x: 0n,
      y: 115792089237316195423570985008687907853269984665640564039457584007912814743330n
    })
  })
})

const bigDepositOneAndSwapTheOther = async (xToY: boolean) => {
  const [invariant, tokenX, tokenY] = await initDexAndTokens(admin, withdrawAmount)

  const user = await getSigner(ONE_ALPH * 1000n, 0)
  await withdrawTokens(user, [tokenX, withdrawAmount], [tokenY, withdrawAmount])

  const limitAmount = (2n ** 178n) as TokenAmount
  const [fee, tickSpacing] = [toPercentage(6n, 3n), 1n]
  const feeTier = newFeeTier(fee, tickSpacing)
  const poolKey = newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)
  await initFeeTier(invariant, admin, feeTier)

  const initTick = 0n
  const initSqrtPrice = calculateSqrtPrice(initTick)

  await initPool(invariant, user, tokenX, tokenY, feeTier, initSqrtPrice, initTick)

  const [lowerTick, upperTick] = xToY ? [-tickSpacing, 0n] : [0n, tickSpacing]
  const { sqrtPrice } = await getPool(invariant, poolKey)

  const { l: liquidityDelta } = xToY
    ? getLiquidityByY(limitAmount, lowerTick, upperTick, sqrtPrice, true)
    : getLiquidityByX(limitAmount, lowerTick, upperTick, sqrtPrice, true)
  const slippageLimit = initSqrtPrice

  await initPosition(
    invariant,
    user,
    poolKey,
    withdrawAmount,
    withdrawAmount,
    lowerTick,
    upperTick,
    liquidityDelta,
    slippageLimit,
    slippageLimit
  )

  {
    const userBalance = {
      tokenX: await balanceOf(tokenX.contractId, user.address),
      tokenY: await balanceOf(tokenY.contractId, user.address)
    }
    const expectedBalance = xToY
      ? {
          tokenX: 115792089237316195423570985008687907853269984665640564039457584007913129639935n,
          tokenY: 115792089237316195423570601884802691381055395078883776462161679323132583739391n
        }
      : {
          tokenX: 115792089237316195423570601884802691381055395078883776462161679323132583739391n,
          tokenY: 115792089237316195423570985008687907853269984665640564039457584007913129639935n
        }

    expect(userBalance).toMatchObject(expectedBalance)
  }

  await initSwap(
    invariant,
    user,
    poolKey,
    xToY,
    limitAmount,
    true,
    xToY ? MIN_SQRT_PRICE : MAX_SQRT_PRICE
  )

  {
    const userBalance = {
      tokenX: await balanceOf(tokenX.contractId, user.address),
      tokenY: await balanceOf(tokenY.contractId, user.address)
    }
    const expectedAmount =
      115792089237316195423570601884802691381055395078883776462161679323132583739391n
    if (xToY) {
      expect(userBalance.tokenX).toBe(expectedAmount)
      expect(userBalance.tokenY).not.toBe(0n)
    } else {
      expect(userBalance.tokenX).not.toBe(0n)
      expect(userBalance.tokenY).toBe(expectedAmount)
    }
  }
}
