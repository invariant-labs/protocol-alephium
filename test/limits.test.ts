import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { initDexAndTokens } from '../src/snippets'
import {
  GlobalMaxTick,
  GlobalMinTick,
  MaxSqrtPrice,
  MaxU256,
  MinSqrtPrice,
  PercentageScale
} from '../src/consts'
import {
  getPool,
  initFeeTier,
  initPool,
  initPosition,
  initSwap,
  withdrawTokens
} from '../src/testUtils'
import {
  calculateSqrtPrice,
  getDeltaY,
  getLiquidityByX,
  getLiquidityByY,
  getMaxTick
} from '../src/math'
import { balanceOf } from '../src/utils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let admin: PrivateKeyWallet

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
    const [invariant, tokenX, tokenY] = await initDexAndTokens(admin, MaxU256)

    const user = await getSigner(ONE_ALPH * 1000n, 0)
    await withdrawTokens(user, [tokenX, MaxU256], [tokenY, MaxU256])

    // 2^176
    const limitAmount = 95780971304118053647396689196894323976171195136475136n
    // 0.6% fee
    const [fee, tickSpacing] = [6n * 10n ** (PercentageScale - 3n), 1n]
    await initFeeTier(invariant, admin, fee, tickSpacing)

    const initTick = 0n
    const initSqrtPrice = await calculateSqrtPrice(initTick)

    await initPool(invariant, user, tokenX, tokenY, fee, tickSpacing, initSqrtPrice, initTick)

    const [lowerTick, upperTick] = [-tickSpacing, tickSpacing]
    const { sqrtPrice } = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)

    const { l: liquidityDelta } = await getLiquidityByX(
      limitAmount,
      lowerTick,
      upperTick,
      sqrtPrice,
      true
    )
    const y = await getDeltaY(await calculateSqrtPrice(lowerTick), sqrtPrice, liquidityDelta, true)
    const slippageLimit = initSqrtPrice

    await initPosition(
      invariant,
      user,
      tokenX,
      MaxU256,
      tokenY,
      MaxU256,
      fee,
      tickSpacing,
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
      tokenX: MaxU256 - limitAmount,
      tokenY: MaxU256 - y
    })

    const invariantBalance = {
      tokenX: await balanceOf(tokenX.contractId, invariant.address),
      tokenY: await balanceOf(tokenY.contractId, invariant.address)
    }

    expect(invariantBalance).toMatchObject({
      tokenX: limitAmount,
      tokenY: y
    })
  })
  test('deposit limits at upper limit', async () => {
    const [invariant, tokenX, tokenY] = await initDexAndTokens(admin, MaxU256)

    const user = await getSigner(ONE_ALPH * 1000n, 0)
    await withdrawTokens(user, [tokenX, MaxU256], [tokenY, MaxU256])

    // 2^236
    const limitAmount = 110427941548649020598956093796432407239217743554726184882600387580788736n
    // 0.6% fee
    const [fee, tickSpacing] = [6n * 10n ** (PercentageScale - 3n), 1n]
    await initFeeTier(invariant, admin, fee, tickSpacing)

    const initTick = await getMaxTick(tickSpacing)
    const initSqrtPrice = await calculateSqrtPrice(initTick)

    await initPool(invariant, user, tokenX, tokenY, fee, tickSpacing, initSqrtPrice, initTick)

    const { currentTickIndex, sqrtPrice } = await getPool(
      invariant,
      tokenX,
      tokenY,
      fee,
      tickSpacing
    )
    expect(currentTickIndex).toBe(initTick)
    expect(sqrtPrice).toBe(initSqrtPrice)

    const positionAmount = limitAmount - 1n
    const { l: liquidityDelta } = await getLiquidityByY(
      positionAmount,
      0n,
      GlobalMaxTick,
      sqrtPrice,
      false
    )

    const slippageLimit = sqrtPrice

    await initPosition(
      invariant,
      user,
      tokenX,
      MaxU256,
      tokenY,
      MaxU256,
      fee,
      tickSpacing,
      0n,
      GlobalMaxTick,
      liquidityDelta,
      slippageLimit,
      slippageLimit
    )
  })

  test('big deposit and swaps', async () => {
    const [invariant, tokenX, tokenY] = await initDexAndTokens(admin, MaxU256)

    const user = await getSigner(ONE_ALPH * 1000n, 0)
    await withdrawTokens(user, [tokenX, MaxU256], [tokenY, MaxU256])

    // 2^177
    const limitAmount = 191561942608236107294793378393788647952342390272950272n
    // 0.6% fee
    const [fee, tickSpacing] = [6n * 10n ** (PercentageScale - 3n), 1n]
    await initFeeTier(invariant, admin, fee, tickSpacing)

    const initTick = 0n
    const initSqrtPrice = await calculateSqrtPrice(initTick)

    await initPool(invariant, user, tokenX, tokenY, fee, tickSpacing, initSqrtPrice, initTick)

    const [lowerTick, upperTick] = [-tickSpacing, tickSpacing]
    const { sqrtPrice } = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)

    const posAmount = limitAmount / 2n
    const { l: liquidityDelta } = await getLiquidityByX(
      posAmount,
      lowerTick,
      upperTick,
      sqrtPrice,
      false
    )

    const y = await getDeltaY(await calculateSqrtPrice(lowerTick), sqrtPrice, liquidityDelta, true)

    const slippageLimit = initSqrtPrice
    await initPosition(
      invariant,
      user,
      tokenX,
      MaxU256,
      tokenY,
      MaxU256,
      fee,
      tickSpacing,
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
        tokenX: MaxU256 - posAmount,
        tokenY: MaxU256 - y
      })

      const invariantBalance = {
        tokenX: await balanceOf(tokenX.contractId, invariant.address),
        tokenY: await balanceOf(tokenY.contractId, invariant.address)
      }

      expect(invariantBalance).toMatchObject({
        tokenX: posAmount,
        tokenY: y
      })
    }

    const swapAmount = limitAmount / 8n

    for (let n = 1; n <= 4; ++n) {
      await initSwap(
        invariant,
        user,
        tokenX,
        tokenY,
        fee,
        tickSpacing,
        n % 2 === 0,
        swapAmount,
        true,
        n % 2 === 0 ? MinSqrtPrice : MaxSqrtPrice
      )
    }
  })
  test('full range with max liquidity', async () => {
    const [invariant, tokenX, tokenY] = await initDexAndTokens(admin, MaxU256)

    const user = await getSigner(ONE_ALPH * 1000n, 0)
    await withdrawTokens(user, [tokenX, MaxU256], [tokenY, MaxU256])

    // 2^237
    const liquidityLimitAmount =
      220855883097298041197912187592864814478435487109452369765200775161577472n
    // 0.6% fee
    const [fee, tickSpacing] = [6n * 10n ** (PercentageScale - 3n), 1n]
    await initFeeTier(invariant, admin, fee, tickSpacing)

    const initTick = await getMaxTick(tickSpacing)
    const initSqrtPrice = await calculateSqrtPrice(initTick)

    await initPool(invariant, user, tokenX, tokenY, fee, tickSpacing, initSqrtPrice, initTick)
    const { currentTickIndex, sqrtPrice } = await getPool(
      invariant,
      tokenX,
      tokenY,
      fee,
      tickSpacing
    )
    expect(currentTickIndex).toBe(initTick)
    expect(sqrtPrice).toBe(initSqrtPrice)

    const liquidityDelta = liquidityLimitAmount
    const slippageLimit = initSqrtPrice

    await initPosition(
      invariant,
      user,
      tokenX,
      MaxU256,
      tokenY,
      MaxU256,
      fee,
      tickSpacing,
      GlobalMinTick,
      GlobalMaxTick,
      liquidityDelta,
      slippageLimit,
      slippageLimit
    )

    const invariantBalance = {
      tokenX: await balanceOf(tokenX.contractId, invariant.address),
      tokenY: await balanceOf(tokenY.contractId, invariant.address)
    }

    expect(invariantBalance).toMatchObject({
      tokenX: 0n,
      tokenY: 144738750896072444118518848476700723725861030905971328860187553943253568n
    })
  })
})

const bigDepositOneAndSwapTheOther = async (xToY: boolean) => {
  const [invariant, tokenX, tokenY] = await initDexAndTokens(admin, MaxU256)

  const user = await getSigner(ONE_ALPH * 1000n, 0)
  await withdrawTokens(user, [tokenX, MaxU256], [tokenY, MaxU256])

  // 2^206
  const limitAmount = 102844034832575377634685573909834406561420991602098741459288064n
  // 0.6% fee
  const [fee, tickSpacing] = [6n * 10n ** (PercentageScale - 3n), 1n]
  await initFeeTier(invariant, admin, fee, tickSpacing)

  const initTick = 0n
  const initSqrtPrice = await calculateSqrtPrice(initTick)

  await initPool(invariant, user, tokenX, tokenY, fee, tickSpacing, initSqrtPrice, initTick)

  const [lowerTick, upperTick] = xToY ? [-tickSpacing, 0n] : [0n, tickSpacing]
  const { sqrtPrice } = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)

  const { l: liquidityDelta } = xToY
    ? await getLiquidityByY(limitAmount, lowerTick, upperTick, sqrtPrice, true)
    : await getLiquidityByX(limitAmount, lowerTick, upperTick, sqrtPrice, true)
  const slippageLimit = initSqrtPrice

  await initPosition(
    invariant,
    user,
    tokenX,
    MaxU256,
    tokenY,
    MaxU256,
    fee,
    tickSpacing,
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
          tokenY: 115792089237316092579536152433310273167696074831234002618465981909171670351871n
        }
      : {
          tokenX: 115792089237316092579536152433310273167696074831234002618465981909171670351871n,
          tokenY: 115792089237316195423570985008687907853269984665640564039457584007913129639935n
        }

    expect(userBalance).toMatchObject(expectedBalance)
  }

  await initSwap(
    invariant,
    user,
    tokenX,
    tokenY,
    fee,
    tickSpacing,
    xToY,
    limitAmount,
    true,
    xToY ? MinSqrtPrice : MaxSqrtPrice
  )

  {
    const userBalance = {
      tokenX: await balanceOf(tokenX.contractId, user.address),
      tokenY: await balanceOf(tokenY.contractId, user.address)
    }
    const expectedAmount =
      115792089237316092579536152433310273167696074831234002618465981909171670351871n
    if (xToY) {
      expect(userBalance.tokenX).toBe(expectedAmount)
      expect(userBalance.tokenY).not.toBe(0n)
    } else {
      expect(userBalance.tokenX).not.toBe(0n)
      expect(userBalance.tokenY).toBe(expectedAmount)
    }
  }
}
