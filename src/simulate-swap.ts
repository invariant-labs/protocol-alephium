import {
  CHUNK_SIZE,
  GLOBAL_MAX_TICK,
  GLOBAL_MIN_TICK,
  HALF_CHUNK_SIZE,
  InvariantError,
  LIQUIDITY_DENOMINATOR,
  LIQUIDITY_SCALE,
  MAX_SQRT_PRICE,
  MAX_SWAP_STEPS,
  MAX_U256,
  MIN_SQRT_PRICE,
  PERCENTAGE_DENOMINATOR,
  SEARCH_RANGE,
  SQRT_PRICE_DENOMINATOR,
  SQRT_PRICE_SCALE,
  TOKEN_AMOUNT_DENOMINATOR,
  TOKEN_AMOUNT_SCALE
} from './consts'
import {
  calculateSqrtPrice,
  getDeltaX,
  getDeltaY,
  getMaxTick,
  getMinTick,
  getTickAtSqrtPrice,
  rescale,
  tickToPosition
} from './math'
import {
  Liquidity,
  Percentage,
  Pool,
  SimulateSwapResult,
  SqrtPrice,
  SwapResult,
  Tickmap,
  TickVariant,
  TokenAmount
} from './types'

export const simulateSwap = (
  tickmap: Tickmap,
  pool: Pool,
  ticks: TickVariant[],
  xToY: boolean,
  amount: TokenAmount,
  byAmountIn: boolean,
  sqrtPriceLimit: SqrtPrice
): SimulateSwapResult => {
  const feeTier = pool.poolKey.feeTier

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

  let insufficientLiquidity = false
  let stateOutdated = false
  let swapStepLimitReached = false
  let ticksCrossed: Array<TickVariant> = []
  let swapSteps = 0

  let totalAmountIn = 0n as TokenAmount
  let totalAmountOut = 0n as TokenAmount
  let eventFeeAmount = 0n as TokenAmount
  let remainingAmount: TokenAmount = amount
  const eventStartSqrtPrice = sqrtPrice

  while (remainingAmount != 0n) {
    const currentTickIndex = pool.currentTickIndex
    const liquidity = pool.liquidity
    sqrtPrice = pool.sqrtPrice
    const getCloserLimitResult = getCloserLimit(
      sqrtPriceLimit,
      xToY,
      currentTickIndex,
      tickSpacing,
      tickmap
    )

    if (getCloserLimitResult.tickLimitReached) {
      insufficientLiquidity = true
      break
    }

    const swapResult = computeSwapStep(
      sqrtPrice,
      getCloserLimitResult.swapLimit,
      liquidity,
      remainingAmount,
      byAmountIn,
      feeTier.fee
    )
    swapSteps += 1

    if (byAmountIn) {
      remainingAmount = (remainingAmount -
        (swapResult.amountIn + swapResult.feeAmount)) as TokenAmount
    } else {
      remainingAmount = (remainingAmount - swapResult.amountOut) as TokenAmount
    }

    // pool = await AddFee(pool, swapResult.feeAmount, xToY, protocolFee)
    pool.sqrtPrice = swapResult.nextSqrtPrice

    totalAmountIn = (totalAmountIn + swapResult.amountIn + swapResult.feeAmount) as TokenAmount
    totalAmountOut = (totalAmountOut + swapResult.amountOut) as TokenAmount
    eventFeeAmount = (eventFeeAmount + swapResult.feeAmount) as TokenAmount

    // fail if price would go over swap limit
    if (swapResult.nextSqrtPrice === sqrtPriceLimit && remainingAmount != 0n) {
      insufficientLiquidity = true
      break
    }

    let tick: TickVariant | undefined
    if (getCloserLimitResult.hasLimitingTick) {
      if (getCloserLimitResult.isInitialized) {
        tick = ticks.find(t => t.index === getCloserLimitResult.limitingTickIndex)
        // tick not found despite of being reported as initialized - state mismatch
        if (!tick) {
          stateOutdated = true
          break
        }
      }
    }

    const poolUpdateTickResult = poolUpdateTick(
      pool,
      tick,
      swapResult.nextSqrtPrice,
      getCloserLimitResult.swapLimit,
      remainingAmount,
      byAmountIn,
      xToY,
      getCloserLimitResult.hasLimitingTick,
      getCloserLimitResult.isInitialized,
      getCloserLimitResult.limitingTickIndex
    )
    stateOutdated ||= poolUpdateTickResult.stateInconsistency
    if (stateOutdated) {
      break
    }

    remainingAmount = poolUpdateTickResult.amountAfterTickUpdate
    totalAmountIn = (totalAmountIn + poolUpdateTickResult.amountToAdd) as TokenAmount

    if (poolUpdateTickResult.hasCrossed && tick) {
      ticksCrossed.push(tick)
    }

    const reachedTickLimit = xToY
      ? pool.currentTickIndex <= tickLimit
      : pool.currentTickIndex >= tickLimit

    if (reachedTickLimit) {
      insufficientLiquidity = true
      break
    }

    if (swapSteps > MAX_SWAP_STEPS) {
      swapStepLimitReached = true
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
    insufficientLiquidity,
    stateOutdated,
    swapStepLimitReached
  }
}

type getCloserLimitResult = {
  swapLimit: SqrtPrice
  hasLimitingTick: boolean
  limitingTickIndex: bigint
  isInitialized: boolean
  tickLimitReached: boolean
}

const getCloserLimit = (
  sqrtPriceLimit: SqrtPrice,
  xToY: boolean,
  currentTickIndex: bigint,
  tickSpacing: bigint,
  tickmap: Tickmap
): getCloserLimitResult => {
  const [closestTickBool, closestTickIndex] = xToY
    ? prevInitialized(currentTickIndex, tickSpacing, tickmap)
    : nextInitialized(currentTickIndex, tickSpacing, tickmap)

  if (closestTickBool) {
    const sqrtPriceExist = calculateSqrtPrice(closestTickIndex)
    if ((xToY && sqrtPriceExist > sqrtPriceLimit) || (!xToY && sqrtPriceExist < sqrtPriceLimit)) {
      return {
        swapLimit: sqrtPriceExist,
        hasLimitingTick: true,
        limitingTickIndex: closestTickIndex,
        isInitialized: true,
        tickLimitReached: false
      }
    } else {
      return {
        swapLimit: sqrtPriceLimit,
        hasLimitingTick: false,
        limitingTickIndex: 0n,
        isInitialized: false,
        tickLimitReached: false
      }
    }
  } else {
    const index = getSearchLimit(currentTickIndex, tickSpacing, !xToY)
    const sqrtPriceNotExist = calculateSqrtPrice(index)

    if (currentTickIndex === index) {
      return {
        swapLimit: sqrtPriceLimit,
        hasLimitingTick: false,
        limitingTickIndex: 0n,
        isInitialized: false,
        tickLimitReached: true
      }
    }

    if (
      (xToY && sqrtPriceNotExist > sqrtPriceLimit) ||
      (!xToY && sqrtPriceNotExist < sqrtPriceLimit)
    ) {
      return {
        swapLimit: sqrtPriceNotExist,
        hasLimitingTick: true,
        limitingTickIndex: index,
        isInitialized: false,
        tickLimitReached: false
      }
    } else {
      return {
        swapLimit: sqrtPriceLimit,
        hasLimitingTick: false,
        limitingTickIndex: 0n,
        isInitialized: false,
        tickLimitReached: false
      }
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
        shifted >>= 1n
        bit += 1n
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

    let part: bigint
    let part_bit: bigint

    if (bit >= HALF_CHUNK_SIZE) {
      part = upper
      part_bit = bit - HALF_CHUNK_SIZE
    } else {
      part = lower
      part_bit = bit
    }

    let mask = 1n << part_bit
    while (part_bit > 0n && !(part & mask)) {
      mask >>= 1n
      part_bit -= 1n
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

const getSearchLimit = (tick: bigint, tickSpacing: bigint, up: boolean): bigint => {
  const index = tick / tickSpacing

  let limit: bigint
  if (up) {
    const rangeLimitUp = index + SEARCH_RANGE
    const sqrtPriceLimitUp = GLOBAL_MAX_TICK / tickSpacing
    limit = rangeLimitUp < sqrtPriceLimitUp ? rangeLimitUp : sqrtPriceLimitUp
  } else {
    const rangeLimitDown = index - SEARCH_RANGE
    const sqrtPriceLimitDown = GLOBAL_MIN_TICK / tickSpacing
    limit = rangeLimitDown > sqrtPriceLimitDown ? rangeLimitDown : sqrtPriceLimitDown
  }
  return limit * tickSpacing
}

const computeSwapStep = (
  currentSqrtPrice: SqrtPrice,
  targetSqrtPrice: SqrtPrice,
  liquidity: Liquidity,
  amount: TokenAmount,
  byAmountIn: boolean,
  fee: Percentage
): SwapResult => {
  if (liquidity === 0n) {
    return {
      nextSqrtPrice: targetSqrtPrice,
      amountIn: 0n as TokenAmount,
      amountOut: 0n as TokenAmount,
      feeAmount: 0n as TokenAmount
    }
  }

  const xToY = currentSqrtPrice >= targetSqrtPrice

  let nextSqrtPrice: SqrtPrice
  let amountIn = 0n as TokenAmount
  let amountOut = 0n as TokenAmount

  if (byAmountIn) {
    const amountAfterFee = ((amount * (PERCENTAGE_DENOMINATOR - fee)) /
      PERCENTAGE_DENOMINATOR) as TokenAmount
    amountIn = xToY
      ? getDeltaX(targetSqrtPrice, currentSqrtPrice, liquidity, true)
      : getDeltaY(currentSqrtPrice, targetSqrtPrice, liquidity, true)
    nextSqrtPrice =
      amountAfterFee >= amountIn
        ? targetSqrtPrice
        : getNextSqrtPriceFromInput(currentSqrtPrice, liquidity, amountAfterFee, xToY)
  } else {
    amountOut = xToY
      ? getDeltaY(targetSqrtPrice, currentSqrtPrice, liquidity, false)
      : getDeltaX(currentSqrtPrice, targetSqrtPrice, liquidity, false)
    nextSqrtPrice =
      amount >= amountOut
        ? targetSqrtPrice
        : getNextSqrtPriceFromOutput(currentSqrtPrice, liquidity, amount, xToY)
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

  let feeAmount: TokenAmount
  if (byAmountIn && nextSqrtPrice !== targetSqrtPrice) {
    feeAmount = (amount - amountIn) as TokenAmount
  } else {
    feeAmount = ((PERCENTAGE_DENOMINATOR - 1n + amountIn * fee) /
      PERCENTAGE_DENOMINATOR) as TokenAmount
  }

  return {
    nextSqrtPrice: nextSqrtPrice,
    amountIn: amountIn,
    amountOut: amountOut,
    feeAmount: feeAmount
  }
}

const getNextSqrtPriceFromInput = (
  startingSqrtPrice: SqrtPrice,
  liquidity: Liquidity,
  amount: TokenAmount,
  xToY: boolean
): SqrtPrice => {
  if (xToY) {
    return getNextSqrtPriceXUp(startingSqrtPrice, liquidity, amount, true)
  } else {
    return getNextSqrtPriceYDown(startingSqrtPrice, liquidity, amount, true)
  }
}

const getNextSqrtPriceFromOutput = (
  startingSqrtPrice: SqrtPrice,
  liquidity: Liquidity,
  amount: TokenAmount,
  xToY: boolean
): SqrtPrice => {
  if (xToY) {
    return getNextSqrtPriceYDown(startingSqrtPrice, liquidity, amount, false)
  } else {
    return getNextSqrtPriceXUp(startingSqrtPrice, liquidity, amount, false)
  }
}

const getNextSqrtPriceXUp = (
  startingSqrtPrice: SqrtPrice,
  liquidity: Liquidity,
  x: TokenAmount,
  addX: Boolean
): SqrtPrice => {
  if (x === 0n) {
    return startingSqrtPrice
  }

  const deltaSqrtPrice = rescale(liquidity, LIQUIDITY_SCALE, SQRT_PRICE_SCALE)

  let denominator: bigint
  if (addX) {
    denominator = deltaSqrtPrice + mulDiv(startingSqrtPrice, x, TOKEN_AMOUNT_DENOMINATOR)
  } else {
    denominator = deltaSqrtPrice - mulDiv(startingSqrtPrice, x, TOKEN_AMOUNT_DENOMINATOR)
  }

  const nominator = mulDivUp(startingSqrtPrice, liquidity, LIQUIDITY_DENOMINATOR)

  return divUp(nominator, denominator, SQRT_PRICE_DENOMINATOR) as SqrtPrice
}

const getNextSqrtPriceYDown = (
  startingSqrtPrice: SqrtPrice,
  liquidity: Liquidity,
  y: TokenAmount,
  addY: Boolean
): SqrtPrice => {
  const numerator = rescale(y, TOKEN_AMOUNT_SCALE, SQRT_PRICE_SCALE)
  const denominator = rescale(liquidity, LIQUIDITY_SCALE, SQRT_PRICE_SCALE)

  if (addY) {
    return (startingSqrtPrice + div(numerator, denominator, SQRT_PRICE_DENOMINATOR)) as SqrtPrice
  } else {
    return (startingSqrtPrice - divUp(numerator, denominator, SQRT_PRICE_DENOMINATOR)) as SqrtPrice
  }
}

type poolUpdateTickResult = {
  amountToAdd: TokenAmount
  amountAfterTickUpdate: TokenAmount
  hasCrossed: boolean
  stateInconsistency: boolean
}

// in the OG code, the remainingAmount is declared as mut, but we modify it outside right after the call to this function
const poolUpdateTick = (
  pool: Pool,
  tick: TickVariant | undefined,
  nextSqrtPrice: SqrtPrice,
  swapLimit: SqrtPrice,
  remainingAmount: TokenAmount,
  byAmountIn: boolean,
  xToY: boolean,
  hasLimitingTick: boolean,
  isLimitingTickInitialized: boolean,
  limitingTickIndex: bigint
): poolUpdateTickResult => {
  let hasCrossed = false
  let stateInconsistency = false
  let totalAmount = 0n as TokenAmount

  // if there's no tick we do not have to check for initialization
  if (!tick || swapLimit !== nextSqrtPrice) {
    pool.currentTickIndex = getTickAtSqrtPrice(nextSqrtPrice, pool.poolKey.feeTier.tickSpacing)
    return {
      amountToAdd: totalAmount,
      amountAfterTickUpdate: remainingAmount,
      hasCrossed,
      stateInconsistency
    }
  }

  const isEnoughAmountToCross = isEnoughAmountToChangePrice(
    remainingAmount,
    nextSqrtPrice,
    pool.liquidity,
    pool.poolKey.feeTier.fee,
    byAmountIn,
    xToY
  )

  if (tick && hasLimitingTick && isLimitingTickInitialized) {
    if (!xToY || isEnoughAmountToCross) {
      const [add, liquidityDelta] = cross(tick, pool.currentTickIndex)
      // liquidity update
      if (add) {
        pool.liquidity = (pool.liquidity + liquidityDelta) as Liquidity
      } else {
        pool.liquidity = (pool.liquidity - liquidityDelta) as Liquidity
      }
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
        remainingAmount = 0n as TokenAmount
      }
    }
  }

  if (xToY && isEnoughAmountToCross) {
    pool.currentTickIndex = limitingTickIndex - pool.poolKey.feeTier.tickSpacing
  } else {
    pool.currentTickIndex = limitingTickIndex
  }

  return {
    amountToAdd: totalAmount,
    amountAfterTickUpdate: remainingAmount,
    hasCrossed,
    stateInconsistency
  }
}

const isEnoughAmountToChangePrice = (
  amount: TokenAmount,
  startingSqrtPrice: SqrtPrice,
  liquidity: Liquidity,
  fee: Percentage,
  byAmountIn: boolean,
  xToY: boolean
): boolean => {
  if (liquidity === 0n) {
    return true
  }

  let nextSqrtPrice: SqrtPrice
  if (byAmountIn) {
    const amountAfterFee = mulDiv(
      amount,
      PERCENTAGE_DENOMINATOR - fee,
      PERCENTAGE_DENOMINATOR
    ) as TokenAmount
    nextSqrtPrice = getNextSqrtPriceFromInput(startingSqrtPrice, liquidity, amountAfterFee, xToY)
  } else {
    nextSqrtPrice = getNextSqrtPriceFromOutput(startingSqrtPrice, liquidity, amount, xToY)
  }

  return startingSqrtPrice !== nextSqrtPrice
}

const cross = (tick: TickVariant, currentTick: bigint): [boolean, Liquidity] => {
  const isBelowCurrent = currentTick >= tick.index

  return [(isBelowCurrent && !tick.sign) || (!isBelowCurrent && tick.sign), tick.liquidityChange]
}

const mulDiv = (a: bigint, b: bigint, bDenominator: bigint): bigint => {
  return (a * b) / bDenominator
}

const mulDivUp = (a: bigint, b: bigint, bDenominator: bigint): bigint => {
  return (bDenominator - 1n + a * b) / bDenominator
}

const div = (a: bigint, b: bigint, bDenominator: bigint): bigint => {
  return (a * bDenominator) / b
}

const divUp = (a: bigint, b: bigint, bDenominator: bigint): bigint => {
  return (b - 1n + a * bDenominator) / b
}
