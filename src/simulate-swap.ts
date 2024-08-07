import { FeeTier } from '../artifacts/ts/types'
import {
  CHUNK_SIZE,
  DecimalError,
  FIXED_POINT_DENOMINATOR,
  FIXED_POINT_SCALE,
  GLOBAL_MAX_TICK,
  GLOBAL_MIN_TICK,
  HALF_CHUNK_SIZE,
  InvariantError,
  LIQUIDITY_DENOMINATOR,
  LIQUIDITY_SCALE,
  LOG2_ACCURACY,
  LOG2_DOUBLE_ONE,
  LOG2_HALF,
  LOG2_NEGATIVE_MAX_LOSE,
  LOG2_ONE,
  LOG2_SCALE,
  LOG2_SQRT10001,
  LOG2_TWO,
  LogError,
  MAX_SQRT_PRICE,
  MAX_TICK_CROSS,
  MAX_U256,
  MIN_SQRT_PRICE,
  PERCENTAGE_DENOMINATOR,
  SEARCH_RANGE,
  SQRT_PRICE_DENOMINATOR,
  SQRT_PRICE_SCALE,
  TOKEN_AMOUNT_DENOMINATOR,
  TOKEN_AMOUNT_SCALE
} from './consts'
import { Pool, SimulateSwapResult, SwapResult, Tickmap, TickVariant } from './types'

export const simulateSwap = (
  tickmap: Tickmap,
  feeTier: FeeTier,
  pool: Pool,
  ticks: TickVariant[],
  xToY: boolean,
  amount: bigint,
  byAmountIn: boolean,
  sqrtPriceLimit: bigint
): SimulateSwapResult => {
  if (amount === 0n) {
    throw new Error(String(InvariantError.ZeroAmount))
  }

  let sqrtPrice = pool.sqrtPrice
  const tickSpacing = feeTier.tickSpacing

  if (xToY) {
    if (sqrtPrice <= sqrtPriceLimit || sqrtPriceLimit > MAX_SQRT_PRICE) {
      throw new Error(String(InvariantError.WrongPriceLimit))
    }
  } else {
    if (sqrtPrice >= sqrtPriceLimit || sqrtPriceLimit < MIN_SQRT_PRICE) {
      throw new Error(String(InvariantError.WrongPriceLimit))
    }
  }

  const tickLimit = xToY ? getMinTick(tickSpacing) : getMaxTick(tickSpacing)

  let globalInsufficientLiquidity = false
  let stateOutdated = false
  let maxTicksCrossed = false
  let ticksCrossed: Array<TickVariant> = []

  let totalAmountIn = 0n
  let totalAmountOut = 0n
  let eventFeeAmount = 0n
  let remainingAmount: bigint = amount
  const eventStartSqrtPrice = sqrtPrice

  while (remainingAmount != 0n) {
    const currentTickIndex = pool.currentTickIndex
    const liquidity = pool.liquidity
    sqrtPrice = pool.sqrtPrice
    const [swapLimit, hasLimitingTick, limitingTickIndex, isInitialized, tickLimitReached] =
      getCloserLimit(sqrtPriceLimit, xToY, currentTickIndex, tickSpacing, tickmap)

    if (tickLimitReached) {
      globalInsufficientLiquidity = true
      break
    }

    const swapResult = computeSwapStep(
      sqrtPrice,
      swapLimit,
      liquidity,
      remainingAmount,
      byAmountIn,
      feeTier.fee.v
    )

    if (byAmountIn) {
      remainingAmount -= swapResult.amountIn + swapResult.feeAmount
    } else {
      remainingAmount -= swapResult.amountOut
    }

    // pool = await AddFee(pool, swapResult.feeAmount, xToY, protocolFee)
    pool.sqrtPrice = swapResult.nextSqrtPrice

    totalAmountIn += swapResult.amountIn + swapResult.feeAmount
    totalAmountOut += swapResult.amountOut
    eventFeeAmount += swapResult.feeAmount

    // fail if price would go over swap limit
    if (swapResult.nextSqrtPrice === sqrtPriceLimit && remainingAmount != 0n) {
      globalInsufficientLiquidity = true
      break
    }

    let tick: TickVariant | undefined
    if (hasLimitingTick) {
      if (isInitialized) {
        tick = ticks.find(t => t.index === limitingTickIndex)
        // tick not found despite of being reported as initialized - state mismatch
        if (!tick) {
          stateOutdated = true
          break
        }
      }
    }

    const [amountToAdd, amountAfterTickUpdate, hasCrossed, overOrUnderflow] = poolUpdateTick(
      pool,
      tick,
      swapResult.nextSqrtPrice,
      swapLimit,
      remainingAmount,
      byAmountIn,
      xToY,
      hasLimitingTick,
      isInitialized,
      limitingTickIndex
    )
    stateOutdated ||= overOrUnderflow
    if (stateOutdated) {
      break
    }

    remainingAmount = amountAfterTickUpdate
    totalAmountIn += amountToAdd

    if (hasCrossed && tick) {
      ticksCrossed.push(tick)
      if (ticksCrossed.length > MAX_TICK_CROSS) {
        maxTicksCrossed = true
        break
      }
    }

    const reachedTickLimit = xToY
      ? pool.currentTickIndex <= tickLimit
      : pool.currentTickIndex >= tickLimit

    if (reachedTickLimit) {
      globalInsufficientLiquidity = true
      break
    }
  }

  if (totalAmountOut === 0n) {
    throw new Error(String(InvariantError.NoGainSwap))
  }

  return {
    amountIn: totalAmountIn,
    amountOut: totalAmountOut,
    startSqrtPrice: eventStartSqrtPrice,
    targetSqrtPrice: pool.sqrtPrice,
    fee: eventFeeAmount,
    crossedTicks: ticksCrossed,
    globalInsufficientLiquidity,
    stateOutdated,
    maxTicksCrossed
  }
}

const getCloserLimit = (
  sqrtPriceLimit: bigint,
  xToY: boolean,
  currentTickIndex: bigint,
  tickSpacing: bigint,
  tickmap: Tickmap
): [bigint, boolean, bigint, boolean, boolean] => {
  let closestTickBool = false
  let closestTickIndex = 0n

  if (xToY) {
    const [closestTickBoolXtoY, closestTickIndexXtoY] = prevInitialized(
      currentTickIndex,
      tickSpacing,
      tickmap
    )
    closestTickBool = closestTickBoolXtoY
    closestTickIndex = closestTickIndexXtoY
  } else {
    const [closestTickBoolYtoX, closestTickIndexYtoX] = nextInitialized(
      currentTickIndex,
      tickSpacing,
      tickmap
    )
    closestTickBool = closestTickBoolYtoX
    closestTickIndex = closestTickIndexYtoX
  }

  if (closestTickBool) {
    const sqrtPriceExist = calculateSqrtPrice(closestTickIndex)
    if ((xToY && sqrtPriceExist > sqrtPriceLimit) || (!xToY && sqrtPriceExist < sqrtPriceLimit)) {
      return [sqrtPriceExist, true, closestTickIndex, true, false]
    } else {
      return [sqrtPriceLimit, false, 0n, false, false]
    }
  } else {
    const index = getSearchLimit(currentTickIndex, tickSpacing, !xToY)
    const sqrtPriceNotExist = calculateSqrtPrice(index)

    if (currentTickIndex === index) {
      return [sqrtPriceLimit, false, 0n, false, true]
    }

    if (
      (xToY && sqrtPriceNotExist > sqrtPriceLimit) ||
      (!xToY && sqrtPriceNotExist < sqrtPriceLimit)
    ) {
      return [sqrtPriceNotExist, true, index, false, false]
    } else {
      return [sqrtPriceLimit, false, 0n, false, false]
    }
  }
}

const nextInitialized = (
  tick: bigint,
  tickSpacing: bigint,
  tickmap: Tickmap
): [boolean, bigint] => {
  const limit = getSearchLimit(tick, tickSpacing, true)

  if (tick + tickSpacing > GLOBAL_MAX_TICK) {
    return [false, 0n]
  }

  let [chunk, bit] = tickToPosition(tick + tickSpacing, tickSpacing)
  const [limitingChunk, limitingBit] = tickToPosition(limit, tickSpacing)

  while (chunk < limitingChunk || (chunk == limitingChunk && bit <= limitingBit)) {
    const chunkVal = tickmap.get(chunk)
    let shifted = (chunkVal ?? 0n) >> bit

    if (shifted != 0n) {
      while (shifted % 2n == 0n) {
        shifted = shifted >> 1n
        bit = bit + 1n
      }

      if (chunk < limitingChunk || (chunk == limitingChunk && bit <= limitingBit)) {
        const index = chunk * CHUNK_SIZE + bit

        return [true, (index - GLOBAL_MAX_TICK / tickSpacing) * tickSpacing]
      } else {
        return [false, 0n]
      }
    }

    chunk += 1n
    bit = 0n
  }
  return [false, 0n]
}

const prevInitialized = (
  tick: bigint,
  tickSpacing: bigint,
  tickmap: Tickmap
): [boolean, bigint] => {
  const limit = getSearchLimit(tick, tickSpacing, false)
  let [chunk, bit] = tickToPosition(tick, tickSpacing)
  const [limitingChunk, limitingBit] = tickToPosition(limit, tickSpacing)

  while (chunk > limitingChunk || (chunk === limitingChunk && bit >= limitingBit)) {
    const value = tickmap.get(chunk) ?? 0n

    const upper = (value >> HALF_CHUNK_SIZE) & 0xffffffffffffffffffffffffffffffffn
    const lower = value & 0xffffffffffffffffffffffffffffffffn

    let part = 0n
    let part_bit = 0n

    if (bit >= HALF_CHUNK_SIZE) {
      part = upper
      part_bit = bit - HALF_CHUNK_SIZE
    } else {
      part = lower
      part_bit = bit
    }

    let mask = 1n << part_bit
    while (part_bit > 0n && !(part & mask)) {
      mask = mask >> 1n
      part_bit = part_bit - 1n
    }

    if (part & mask) {
      if (bit >= HALF_CHUNK_SIZE) {
        bit = part_bit + HALF_CHUNK_SIZE
      } else {
        bit = part_bit
      }
      if (chunk > limitingChunk || (chunk == limitingChunk && bit >= limitingBit)) {
        const index = chunk * CHUNK_SIZE + bit
        return [true, (index - GLOBAL_MAX_TICK / tickSpacing) * tickSpacing]
      } else {
        return [false, 0n]
      }
    }

    // check lower part
    if (bit == HALF_CHUNK_SIZE) {
      part = lower
      part_bit = HALF_CHUNK_SIZE - 1n
      mask = 1n << part_bit

      while (part_bit > 0n && !(part & mask)) {
        mask = mask >> 1n
        part_bit -= 1n
      }

      if (part & mask) {
        bit = part_bit
        if (chunk > limitingChunk || (chunk == limitingChunk && bit >= limitingBit)) {
          let index = chunk * CHUNK_SIZE + bit
          return [true, (index - GLOBAL_MAX_TICK / tickSpacing) * tickSpacing]
        } else {
          return [false, 0n]
        }
      }
    }

    // move to next chunk
    if (chunk > 0n) {
      chunk -= 1n
    } else {
      return [false, 0n]
    }
    bit = CHUNK_SIZE - 1n
  }
  return [false, 0n]
}

const tickToPosition = (tick: bigint, tickSpacing: bigint): [bigint, bigint] => {
  if (tick < GLOBAL_MIN_TICK || tick > GLOBAL_MAX_TICK) {
    throw new Error(String(InvariantError.InvalidTickIndex))
  }

  const bitmapIndex = (tick + GLOBAL_MAX_TICK) / tickSpacing
  const chunk = bitmapIndex / CHUNK_SIZE
  const bit = bitmapIndex % CHUNK_SIZE

  return [chunk, bit]
}

const getSearchLimit = (tick: bigint, tickSpacing: bigint, up: boolean): bigint => {
  const index = tick / tickSpacing

  let limit = 0n
  if (up) {
    const rangeLimitUp = index + SEARCH_RANGE
    const sqrtPriceLimitUp = GLOBAL_MAX_TICK / tickSpacing

    if (rangeLimitUp < sqrtPriceLimitUp) {
      limit = rangeLimitUp
    } else {
      limit = sqrtPriceLimitUp
    }
  } else {
    const rangeLimitDown = index - SEARCH_RANGE
    const sqrtPriceLimitDown = GLOBAL_MIN_TICK / tickSpacing

    if (rangeLimitDown > sqrtPriceLimitDown) {
      limit = rangeLimitDown
    } else {
      limit = sqrtPriceLimitDown
    }
  }
  return limit * tickSpacing
}

const computeSwapStep = (
  currentSqrtPrice: bigint,
  targetSqrtPrice: bigint,
  liquidity: bigint,
  amount: bigint,
  byAmountIn: boolean,
  fee: bigint
): SwapResult => {
  if (liquidity === 0n) {
    return {
      nextSqrtPrice: targetSqrtPrice,
      amountIn: 0n,
      amountOut: 0n,
      feeAmount: 0n
    }
  }

  const xToY = currentSqrtPrice >= targetSqrtPrice

  let nextSqrtPrice = 0n
  let amountIn = 0n
  let amountOut = 0n

  if (byAmountIn) {
    const amountAfterFee = (amount * (PERCENTAGE_DENOMINATOR - fee)) / PERCENTAGE_DENOMINATOR

    if (xToY) {
      amountIn = getDeltaX(targetSqrtPrice, currentSqrtPrice, liquidity, true)
    } else {
      amountIn = getDeltaY(currentSqrtPrice, targetSqrtPrice, liquidity, true)
    }

    if (amountAfterFee >= amountIn) {
      nextSqrtPrice = targetSqrtPrice
    } else {
      nextSqrtPrice = getNextSqrtPriceFromInput(currentSqrtPrice, liquidity, amountAfterFee, xToY)
    }
  } else {
    if (xToY) {
      amountOut = getDeltaY(targetSqrtPrice, currentSqrtPrice, liquidity, false)
    } else {
      amountOut = getDeltaX(currentSqrtPrice, targetSqrtPrice, liquidity, false)
    }

    if (amount >= amountOut) {
      nextSqrtPrice = targetSqrtPrice
    } else {
      nextSqrtPrice = getNextSqrtPriceFromOutput(currentSqrtPrice, liquidity, amount, xToY)
    }
  }

  const notMax = targetSqrtPrice !== nextSqrtPrice

  if (xToY) {
    if (notMax || !byAmountIn) {
      amountIn = getDeltaX(nextSqrtPrice, currentSqrtPrice, liquidity, true)
    }
    if (notMax || byAmountIn) {
      amountOut = getDeltaY(nextSqrtPrice, currentSqrtPrice, liquidity, false)
    }
  } else {
    if (notMax || !byAmountIn) {
      amountIn = getDeltaY(currentSqrtPrice, nextSqrtPrice, liquidity, true)
    }
    if (notMax || byAmountIn) {
      amountOut = getDeltaX(currentSqrtPrice, nextSqrtPrice, liquidity, false)
    }
  }

  // trim dust in case of specifying exact amount out
  if (!byAmountIn && amountOut > amount) {
    amountOut = amount
  }

  let feeAmount = 0n
  if (byAmountIn && nextSqrtPrice !== targetSqrtPrice) {
    feeAmount = amount - amountIn
  } else {
    feeAmount = (PERCENTAGE_DENOMINATOR - 1n + amountIn * fee) / PERCENTAGE_DENOMINATOR
  }

  return {
    nextSqrtPrice: nextSqrtPrice,
    amountIn: amountIn,
    amountOut: amountOut,
    feeAmount: feeAmount
  }
}

const getDeltaX = (
  sqrtPriceA: bigint,
  sqrtPriceB: bigint,
  liquidity: bigint,
  roundingUp: boolean
): bigint => {
  let deltaSqrtPrice = sqrtPriceA > sqrtPriceB ? sqrtPriceA - sqrtPriceB : sqrtPriceB - sqrtPriceA

  const nominator = mulDiv(deltaSqrtPrice, liquidity, LIQUIDITY_DENOMINATOR)
  if (roundingUp) {
    const denominator = mulDiv(sqrtPriceA, sqrtPriceB, SQRT_PRICE_DENOMINATOR)
    return divToTokenUp(nominator, denominator)
  } else {
    const denominatorUp = mulDivUp(sqrtPriceA, sqrtPriceB, SQRT_PRICE_DENOMINATOR)
    return divToToken(nominator, denominatorUp)
  }
}

const getDeltaY = (
  sqrtPriceA: bigint,
  sqrtPriceB: bigint,
  liquidity: bigint,
  roundingUp: boolean
): bigint => {
  let deltaSqrtPrice = sqrtPriceA > sqrtPriceB ? sqrtPriceA - sqrtPriceB : sqrtPriceB - sqrtPriceA

  let result = 0n
  if (roundingUp) {
    result = mulDiv(deltaSqrtPrice, liquidity, LIQUIDITY_DENOMINATOR)
    result = divUp(result, SQRT_PRICE_DENOMINATOR, 1n)
    return result
  } else {
    result = mulDiv(deltaSqrtPrice, liquidity, LIQUIDITY_DENOMINATOR)
    result = div(result, SQRT_PRICE_DENOMINATOR, 1n)
    return result
  }
}

const getNextSqrtPriceFromInput = (
  startingSqrtPrice: bigint,
  liquidity: bigint,
  amount: bigint,
  xToY: boolean
): bigint => {
  if (xToY) {
    return getNextSqrtPriceXUp(startingSqrtPrice, liquidity, amount, true)
  } else {
    return getNextSqrtPriceYDown(startingSqrtPrice, liquidity, amount, true)
  }
}

const getNextSqrtPriceFromOutput = (
  startingSqrtPrice: bigint,
  liquidity: bigint,
  amount: bigint,
  xToY: boolean
): bigint => {
  if (xToY) {
    return getNextSqrtPriceYDown(startingSqrtPrice, liquidity, amount, false)
  } else {
    return getNextSqrtPriceXUp(startingSqrtPrice, liquidity, amount, false)
  }
}

const getNextSqrtPriceXUp = (
  startingSqrtPrice: bigint,
  liquidity: bigint,
  x: bigint,
  addX: Boolean
): bigint => {
  if (x === 0n) {
    return startingSqrtPrice
  }

  const deltaSqrtPrice = rescale(liquidity, LIQUIDITY_SCALE, SQRT_PRICE_SCALE)

  let denominator = 0n
  if (addX) {
    denominator = deltaSqrtPrice + mulDiv(startingSqrtPrice, x, TOKEN_AMOUNT_DENOMINATOR)
  } else {
    denominator = deltaSqrtPrice - mulDiv(startingSqrtPrice, x, TOKEN_AMOUNT_DENOMINATOR)
  }

  const nominator = mulDivUp(startingSqrtPrice, liquidity, LIQUIDITY_DENOMINATOR)

  return divUp(nominator, denominator, SQRT_PRICE_DENOMINATOR)
}

const getNextSqrtPriceYDown = (
  startingSqrtPrice: bigint,
  liquidity: bigint,
  y: bigint,
  addY: Boolean
): bigint => {
  const numerator = rescale(y, TOKEN_AMOUNT_SCALE, SQRT_PRICE_SCALE)
  const denominator = rescale(liquidity, LIQUIDITY_SCALE, SQRT_PRICE_SCALE)

  if (addY) {
    return startingSqrtPrice + div(numerator, denominator, SQRT_PRICE_DENOMINATOR)
  } else {
    return startingSqrtPrice - divUp(numerator, denominator, SQRT_PRICE_DENOMINATOR)
  }
}

// in the OG code, the remainingAmount is declared as mut, but we modify it outside right after the call to this function
const poolUpdateTick = (
  pool: Pool,
  tick: TickVariant | undefined,
  nextSqrtPrice: bigint,
  swapLimit: bigint,
  remainingAmount: bigint,
  byAmountIn: boolean,
  xToY: boolean,
  hasLimitingTick: boolean,
  isLimitingTickInitialized: boolean,
  limitingTickIndex: bigint
): [bigint, bigint, boolean, boolean] => {
  let hasCrossed = false
  let stateInconsistency = false
  let totalAmount = 0n

  // if there's no tick we do not have to check for initialization
  if (!tick || swapLimit !== nextSqrtPrice) {
    pool.currentTickIndex = getTickAtSqrtPrice(nextSqrtPrice, pool.poolKey.feeTier.tickSpacing)
    return [totalAmount, remainingAmount, hasCrossed, stateInconsistency]
  }

  const isEnoughAmountToCross = isEnoughAmountToChangePrice(
    remainingAmount,
    nextSqrtPrice,
    pool.liquidity,
    pool.poolKey.feeTier.fee.v,
    byAmountIn,
    xToY
  )

  if (tick && hasLimitingTick && isLimitingTickInitialized) {
    if (!xToY || isEnoughAmountToCross) {
      const [add, liquidityDelta] = cross(tick, pool.currentTickIndex)
      poolCrossLiquidityUpdate(pool, add, liquidityDelta)
      hasCrossed = true
      if (pool.liquidity < 0n || pool.liquidity > MAX_U256) {
        stateInconsistency = true
      }
    } else {
      if (remainingAmount !== 0n) {
        if (byAmountIn) {
          //   await poolAddFee(pool, remainingAmount, xToY, protocolFee)
          totalAmount = remainingAmount
        }
        remainingAmount = 0n
      }
    }
  }

  if (xToY && isEnoughAmountToCross) {
    pool.currentTickIndex = limitingTickIndex - pool.poolKey.feeTier.tickSpacing
  } else {
    pool.currentTickIndex = limitingTickIndex
  }

  return [totalAmount, remainingAmount, hasCrossed, stateInconsistency]
}

const isEnoughAmountToChangePrice = (
  amount: bigint,
  startingSqrtPrice: bigint,
  liquidity: bigint,
  fee: bigint,
  byAmountIn: boolean,
  xToY: boolean
): boolean => {
  if (liquidity === 0n) {
    return true
  }

  let nextSqrtPrice = 0n
  if (byAmountIn) {
    const amountAfterFee = mulDiv(amount, PERCENTAGE_DENOMINATOR - fee, PERCENTAGE_DENOMINATOR)
    nextSqrtPrice = getNextSqrtPriceFromInput(startingSqrtPrice, liquidity, amountAfterFee, xToY)
  } else {
    nextSqrtPrice = getNextSqrtPriceFromOutput(startingSqrtPrice, liquidity, amount, xToY)
  }

  return startingSqrtPrice !== nextSqrtPrice
}

const cross = (tick: TickVariant, currentTick: bigint): [boolean, bigint] => {
  const isBelowCurrent = currentTick >= tick.index

  return [(isBelowCurrent && !tick.sign) || (!isBelowCurrent && tick.sign), tick.liquidityChange]
}

const poolCrossLiquidityUpdate = (pool: Pool, add: boolean, liquidityDelta: bigint) => {
  if (add) {
    pool.liquidity += liquidityDelta
  } else {
    pool.liquidity -= liquidityDelta
  }
}

const calculateSqrtPrice = (tickIndex: bigint): bigint => {
  const tickIndexAbs = tickIndex < 0n ? -tickIndex : tickIndex

  let sqrtPrice = FIXED_POINT_DENOMINATOR

  if (tickIndexAbs > GLOBAL_MAX_TICK) {
    throw new Error(String(DecimalError.TickOverBounds))
  }

  if (tickIndexAbs & 0x1n) {
    sqrtPrice = (sqrtPrice * 1000049998750n) / FIXED_POINT_DENOMINATOR
  }
  if (tickIndexAbs & 0x2n) {
    sqrtPrice = (sqrtPrice * 1000100000000n) / FIXED_POINT_DENOMINATOR
  }
  if (tickIndexAbs & 0x4n) {
    sqrtPrice = (sqrtPrice * 1000200010000n) / FIXED_POINT_DENOMINATOR
  }
  if (tickIndexAbs & 0x8n) {
    sqrtPrice = (sqrtPrice * 1000400060004n) / FIXED_POINT_DENOMINATOR
  }
  if (tickIndexAbs & 0x10n) {
    sqrtPrice = (sqrtPrice * 1000800280056n) / FIXED_POINT_DENOMINATOR
  }
  if (tickIndexAbs & 0x20n) {
    sqrtPrice = (sqrtPrice * 1001601200560n) / FIXED_POINT_DENOMINATOR
  }
  if (tickIndexAbs & 0x40n) {
    sqrtPrice = (sqrtPrice * 1003204964963n) / FIXED_POINT_DENOMINATOR
  }
  if (tickIndexAbs & 0x80n) {
    sqrtPrice = (sqrtPrice * 1006420201726n) / FIXED_POINT_DENOMINATOR
  }
  if (tickIndexAbs & 0x100n) {
    sqrtPrice = (sqrtPrice * 1012881622442n) / FIXED_POINT_DENOMINATOR
  }
  if (tickIndexAbs & 0x200n) {
    sqrtPrice = (sqrtPrice * 1025929181080n) / FIXED_POINT_DENOMINATOR
  }
  if (tickIndexAbs & 0x400n) {
    sqrtPrice = (sqrtPrice * 1052530684591n) / FIXED_POINT_DENOMINATOR
  }
  if (tickIndexAbs & 0x800n) {
    sqrtPrice = (sqrtPrice * 1107820842005n) / FIXED_POINT_DENOMINATOR
  }
  if (tickIndexAbs & 0x1000n) {
    sqrtPrice = (sqrtPrice * 1227267017980n) / FIXED_POINT_DENOMINATOR
  }
  if (tickIndexAbs & 0x2000n) {
    sqrtPrice = (sqrtPrice * 1506184333421n) / FIXED_POINT_DENOMINATOR
  }
  if (tickIndexAbs & 0x4000n) {
    sqrtPrice = (sqrtPrice * 2268591246242n) / FIXED_POINT_DENOMINATOR
  }
  if (tickIndexAbs & 0x8000n) {
    sqrtPrice = (sqrtPrice * 5146506242525n) / FIXED_POINT_DENOMINATOR
  }
  if (tickIndexAbs & 0x00010000n) {
    sqrtPrice = (sqrtPrice * 26486526504348n) / FIXED_POINT_DENOMINATOR
  }
  if (tickIndexAbs & 0x00020000n) {
    sqrtPrice = (sqrtPrice * 701536086265529n) / FIXED_POINT_DENOMINATOR
  }

  if (tickIndex >= 0n) {
    return rescale(sqrtPrice, FIXED_POINT_SCALE, SQRT_PRICE_SCALE)
  } else {
    let sqrtPriceInFixedPointScale = (FIXED_POINT_DENOMINATOR * FIXED_POINT_DENOMINATOR) / sqrtPrice
    return rescale(sqrtPriceInFixedPointScale, FIXED_POINT_SCALE, SQRT_PRICE_SCALE)
  }
}

const rescale = (fromValue: bigint, fromScale: bigint, expectedScale: bigint): bigint => {
  if (expectedScale > fromScale) {
    const multiplierScale = expectedScale - fromScale
    return fromValue * 10n ** multiplierScale
  } else {
    const denominatorScale = fromScale - expectedScale
    return fromValue / 10n ** denominatorScale
  }
}

const divToTokenUp = (nominator: bigint, denominator: bigint): bigint => {
  let result = nominator * SQRT_PRICE_DENOMINATOR
  result += denominator - 1n
  result /= denominator
  result += SQRT_PRICE_DENOMINATOR - 1n
  result /= SQRT_PRICE_DENOMINATOR
  return result
}

const divToToken = (nominator: bigint, denominator: bigint): bigint => {
  let result = nominator * SQRT_PRICE_DENOMINATOR
  result /= denominator
  result /= SQRT_PRICE_DENOMINATOR
  return result
}

const mulDiv = (a: bigint, b: bigint, denominator: bigint): bigint => {
  return (a * b) / denominator
}

const mulDivUp = (a: bigint, b: bigint, denominator: bigint): bigint => {
  return (denominator - 1n + a * b) / denominator
}

const div = (a: bigint, b: bigint, denominator: bigint): bigint => {
  return (a * denominator) / b
}

const divUp = (a: bigint, b: bigint, denominator: bigint): bigint => {
  return (b - 1n + a * denominator) / b
}

const getMaxTick = (tickSpacing: bigint): bigint => {
  return (GLOBAL_MAX_TICK / tickSpacing) * tickSpacing
}

const getMinTick = (tickSpacing: bigint): bigint => {
  return (GLOBAL_MIN_TICK / tickSpacing) * tickSpacing
}

const getTickAtSqrtPrice = (sqrtPrice: bigint, tickSpacing: bigint): bigint => {
  if (sqrtPrice > MAX_SQRT_PRICE || sqrtPrice < MIN_SQRT_PRICE) {
    throw new Error(String(LogError.SqrtPriceOutOfRange))
  }

  const sqrtPriceX32 = sqrtPriceToX32(sqrtPrice)
  const [log2Sign, log2SqrtPrice] = log2IterativeApproximationX32(sqrtPriceX32)

  let absFloorTick = 0n
  let nearerTick = 0n
  let fartherTick = 0n
  if (log2Sign) {
    absFloorTick = log2SqrtPrice / LOG2_SQRT10001
    nearerTick = absFloorTick
    fartherTick = absFloorTick + 1n
  } else {
    absFloorTick = (log2SqrtPrice + LOG2_NEGATIVE_MAX_LOSE) / LOG2_SQRT10001
    nearerTick = -absFloorTick
    fartherTick = -absFloorTick - 1n
  }

  const nearerTickWithSpacing = alignTickToSpacing(nearerTick, tickSpacing)
  const fartherTickWithSpacing = alignTickToSpacing(fartherTick, tickSpacing)
  if (fartherTickWithSpacing === nearerTickWithSpacing) {
    return nearerTickWithSpacing
  }

  let accurateTick = 0n
  if (log2Sign) {
    const fartherTickSqrtPriceDecimal = calculateSqrtPrice(fartherTick)
    if (sqrtPrice >= fartherTickSqrtPriceDecimal) {
      accurateTick = fartherTickWithSpacing
    } else {
      accurateTick = nearerTickWithSpacing
    }
  } else {
    const nearerTickSqrtPriceDecimal = calculateSqrtPrice(nearerTick)
    if (nearerTickSqrtPriceDecimal <= sqrtPrice) {
      accurateTick = nearerTickWithSpacing
    } else {
      accurateTick = fartherTickWithSpacing
    }
  }

  if (tickSpacing > 1n) {
    return alignTickToSpacing(accurateTick, tickSpacing)
  } else {
    return accurateTick
  }
}

const sqrtPriceToX32 = (val: bigint): bigint => {
  return (val * LOG2_ONE) / SQRT_PRICE_DENOMINATOR
}

const log2IterativeApproximationX32 = (sqrtPriceX32: bigint): [boolean, bigint] => {
  let sign = true
  if (sqrtPriceX32 < LOG2_ONE) {
    sign = false
    sqrtPriceX32 = LOG2_DOUBLE_ONE / (sqrtPriceX32 + 1n)
  }

  const log2Floor = log2FloorX32(sqrtPriceX32 >> LOG2_SCALE)
  let result = log2Floor << LOG2_SCALE
  let y = sqrtPriceX32 >> log2Floor

  if (y == LOG2_ONE) {
    return [sign, result]
  }
  let delta = LOG2_HALF
  while (delta > LOG2_ACCURACY) {
    y = (y * y) / LOG2_ONE
    if (y >= LOG2_TWO) {
      result = result | delta
      y = y >> 1n
    }
    delta = delta >> 1n
  }
  return [sign, result]
}

const log2FloorX32 = (sqrtPriceX32: bigint): bigint => {
  let msb = 0n

  if (sqrtPriceX32 >= 1n << 32n) {
    sqrtPriceX32 = sqrtPriceX32 >> 32n
    msb = msb | 32n
  }
  if (sqrtPriceX32 >= 1n << 16n) {
    sqrtPriceX32 = sqrtPriceX32 >> 16n
    msb = msb | 16n
  }
  if (sqrtPriceX32 >= 1n << 8n) {
    sqrtPriceX32 = sqrtPriceX32 >> 8n
    msb = msb | 8n
  }
  if (sqrtPriceX32 >= 1n << 4n) {
    sqrtPriceX32 = sqrtPriceX32 >> 4n
    msb = msb | 4n
  }
  if (sqrtPriceX32 >= 1n << 2n) {
    sqrtPriceX32 = sqrtPriceX32 >> 2n
    msb = msb | 2n
  }
  if (sqrtPriceX32 >= 1n << 1n) {
    msb = msb | 1n
  }

  return msb
}

const alignTickToSpacing = (accurateTick: bigint, tickSpacing: bigint): bigint => {
  if (accurateTick > 0n) {
    return accurateTick - (accurateTick % tickSpacing)
  } else {
    const positiveTick = -accurateTick
    const remainder = positiveTick % tickSpacing
    let substrahend = 0n
    if (remainder != 0n) {
      substrahend = tickSpacing - remainder
    }
    return accurateTick - substrahend
  }
}
