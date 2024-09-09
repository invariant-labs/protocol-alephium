import {
  ArithmeticError,
  CHUNK_SIZE,
  CLAMMError,
  DecimalError,
  FEE_GROWTH_SCALE,
  FIXED_POINT_DENOMINATOR,
  FIXED_POINT_SCALE,
  GLOBAL_MAX_TICK,
  GLOBAL_MIN_TICK,
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
  MAX_U256,
  MIN_SQRT_PRICE,
  PERCENTAGE_DENOMINATOR,
  PERCENTAGE_SCALE,
  PRICE_SCALE,
  SQRT_PRICE_DENOMINATOR,
  SQRT_PRICE_SCALE,
  UtilsError
} from './consts'
import {
  Pool,
  Position,
  Tick,
  LiquidityResult,
  SingleTokenLiquidity,
  FixedPoint,
  TokenAmount,
  FeeGrowth,
  Percentage,
  SqrtPrice,
  Liquidity,
  Price,
  TickVariant,
  LiquidityBreakpoint
} from './types'

export const calculateSqrtPrice = (tickIndex: bigint): SqrtPrice => {
  const tickIndexAbs = tickIndex < 0n ? -tickIndex : tickIndex

  let sqrtPrice = FIXED_POINT_DENOMINATOR as FixedPoint

  if (tickIndexAbs > GLOBAL_MAX_TICK) {
    throw new Error(String(DecimalError.TickOverBounds))
  }

  if (tickIndexAbs & 0x1n) {
    sqrtPrice = ((sqrtPrice * 1000049998750n) / FIXED_POINT_DENOMINATOR) as FixedPoint
  }
  if (tickIndexAbs & 0x2n) {
    sqrtPrice = ((sqrtPrice * 1000100000000n) / FIXED_POINT_DENOMINATOR) as FixedPoint
  }
  if (tickIndexAbs & 0x4n) {
    sqrtPrice = ((sqrtPrice * 1000200010000n) / FIXED_POINT_DENOMINATOR) as FixedPoint
  }
  if (tickIndexAbs & 0x8n) {
    sqrtPrice = ((sqrtPrice * 1000400060004n) / FIXED_POINT_DENOMINATOR) as FixedPoint
  }
  if (tickIndexAbs & 0x10n) {
    sqrtPrice = ((sqrtPrice * 1000800280056n) / FIXED_POINT_DENOMINATOR) as FixedPoint
  }
  if (tickIndexAbs & 0x20n) {
    sqrtPrice = ((sqrtPrice * 1001601200560n) / FIXED_POINT_DENOMINATOR) as FixedPoint
  }
  if (tickIndexAbs & 0x40n) {
    sqrtPrice = ((sqrtPrice * 1003204964963n) / FIXED_POINT_DENOMINATOR) as FixedPoint
  }
  if (tickIndexAbs & 0x80n) {
    sqrtPrice = ((sqrtPrice * 1006420201726n) / FIXED_POINT_DENOMINATOR) as FixedPoint
  }
  if (tickIndexAbs & 0x100n) {
    sqrtPrice = ((sqrtPrice * 1012881622442n) / FIXED_POINT_DENOMINATOR) as FixedPoint
  }
  if (tickIndexAbs & 0x200n) {
    sqrtPrice = ((sqrtPrice * 1025929181080n) / FIXED_POINT_DENOMINATOR) as FixedPoint
  }
  if (tickIndexAbs & 0x400n) {
    sqrtPrice = ((sqrtPrice * 1052530684591n) / FIXED_POINT_DENOMINATOR) as FixedPoint
  }
  if (tickIndexAbs & 0x800n) {
    sqrtPrice = ((sqrtPrice * 1107820842005n) / FIXED_POINT_DENOMINATOR) as FixedPoint
  }
  if (tickIndexAbs & 0x1000n) {
    sqrtPrice = ((sqrtPrice * 1227267017980n) / FIXED_POINT_DENOMINATOR) as FixedPoint
  }
  if (tickIndexAbs & 0x2000n) {
    sqrtPrice = ((sqrtPrice * 1506184333421n) / FIXED_POINT_DENOMINATOR) as FixedPoint
  }
  if (tickIndexAbs & 0x4000n) {
    sqrtPrice = ((sqrtPrice * 2268591246242n) / FIXED_POINT_DENOMINATOR) as FixedPoint
  }
  if (tickIndexAbs & 0x8000n) {
    sqrtPrice = ((sqrtPrice * 5146506242525n) / FIXED_POINT_DENOMINATOR) as FixedPoint
  }
  if (tickIndexAbs & 0x00010000n) {
    sqrtPrice = ((sqrtPrice * 26486526504348n) / FIXED_POINT_DENOMINATOR) as FixedPoint
  }
  if (tickIndexAbs & 0x00020000n) {
    sqrtPrice = ((sqrtPrice * 701536086265529n) / FIXED_POINT_DENOMINATOR) as FixedPoint
  }

  if (tickIndex >= 0n) {
    return rescale(sqrtPrice, FIXED_POINT_SCALE, SQRT_PRICE_SCALE) as SqrtPrice
  } else {
    let sqrtPriceInFixedPointScale = (FIXED_POINT_DENOMINATOR * FIXED_POINT_DENOMINATOR) / sqrtPrice
    return rescale(sqrtPriceInFixedPointScale, FIXED_POINT_SCALE, SQRT_PRICE_SCALE) as SqrtPrice
  }
}

export const rescale = (fromValue: bigint, fromScale: bigint, expectedScale: bigint): bigint => {
  if (expectedScale > fromScale) {
    const multiplierScale = expectedScale - fromScale
    return fromValue * 10n ** multiplierScale
  } else {
    const denominatorScale = fromScale - expectedScale
    return fromValue / 10n ** denominatorScale
  }
}

export const getLiquidityByX = (
  x: TokenAmount,
  lowerTick: bigint,
  upperTick: bigint,
  currentSqrtPrice: SqrtPrice,
  roundingUp: boolean
): SingleTokenLiquidity => {
  if (lowerTick < GLOBAL_MIN_TICK || upperTick > GLOBAL_MAX_TICK) {
    throw new Error(InvariantError.InvalidTickIndex.toString())
  }
  const lowerSqrtPrice = calculateSqrtPrice(lowerTick)
  const upperSqrtPrice = calculateSqrtPrice(upperTick)

  return getLiquidityByXSqrtPrice(x, lowerSqrtPrice, upperSqrtPrice, currentSqrtPrice, roundingUp)
}

const getLiquidityByXSqrtPrice = (
  x: TokenAmount,
  lowerSqrtPrice: SqrtPrice,
  upperSqrtPrice: SqrtPrice,
  currentSqrtPrice: SqrtPrice,
  roundingUp: boolean
): SingleTokenLiquidity => {
  if (upperSqrtPrice < currentSqrtPrice) {
    throw new Error(UtilsError.UpperLTCurrentSqrtPrice.toString())
  }

  if (currentSqrtPrice < lowerSqrtPrice) {
    const nominator = mulDiv(lowerSqrtPrice, upperSqrtPrice, SQRT_PRICE_DENOMINATOR)
    const denominator = upperSqrtPrice - lowerSqrtPrice
    const liquidity = ((nominator * x * LIQUIDITY_DENOMINATOR) / denominator) as Liquidity
    return { l: liquidity, amount: 0n as TokenAmount }
  } else {
    const nominator = mulDiv(currentSqrtPrice, upperSqrtPrice, SQRT_PRICE_DENOMINATOR)
    const denominator = upperSqrtPrice - currentSqrtPrice
    const liquidity = ((nominator * x * LIQUIDITY_DENOMINATOR) / denominator) as Liquidity
    const sqrtPriceDiff = (currentSqrtPrice - lowerSqrtPrice) as SqrtPrice
    const y = calculateY(sqrtPriceDiff, liquidity, roundingUp)
    return { l: liquidity, amount: y }
  }
}

const calculateY = (
  sqrtPriceDiff: SqrtPrice,
  liquidity: Liquidity,
  roundingUp: boolean
): TokenAmount => {
  const shiftedLiquidity = liquidity / LIQUIDITY_DENOMINATOR
  if (roundingUp) {
    return ((sqrtPriceDiff * shiftedLiquidity + SQRT_PRICE_DENOMINATOR - 1n) /
      SQRT_PRICE_DENOMINATOR) as TokenAmount
  } else {
    return ((sqrtPriceDiff * shiftedLiquidity) / SQRT_PRICE_DENOMINATOR) as TokenAmount
  }
}

export const getLiquidityByY = (
  y: TokenAmount,
  lowerTick: bigint,
  upperTick: bigint,
  currentSqrtPrice: SqrtPrice,
  roundingUp: boolean
): SingleTokenLiquidity => {
  if (lowerTick < GLOBAL_MIN_TICK || upperTick > GLOBAL_MAX_TICK) {
    throw new Error(InvariantError.InvalidTickIndex.toString())
  }
  const lowerSqrtPrice = calculateSqrtPrice(lowerTick)
  const upperSqrtPrice = calculateSqrtPrice(upperTick)

  return getLiquidityByYSqrtPrice(y, lowerSqrtPrice, upperSqrtPrice, currentSqrtPrice, roundingUp)
}

const getLiquidityByYSqrtPrice = (
  y: TokenAmount,
  lowerSqrtPrice: SqrtPrice,
  upperSqrtPrice: SqrtPrice,
  currentSqrtPrice: SqrtPrice,
  roundingUp: boolean
): SingleTokenLiquidity => {
  if (currentSqrtPrice < lowerSqrtPrice) {
    throw new Error(UtilsError.CurrentLTLowerSqrtPrice.toString())
  }

  let sqrtPriceDiff = 0n as SqrtPrice
  let liquidity = 0n as Liquidity

  if (upperSqrtPrice <= currentSqrtPrice) {
    sqrtPriceDiff = (upperSqrtPrice - lowerSqrtPrice) as SqrtPrice
    liquidity = ((y * SQRT_PRICE_DENOMINATOR * LIQUIDITY_DENOMINATOR) / sqrtPriceDiff) as Liquidity
    return { l: liquidity, amount: 0n as TokenAmount }
  } else {
    sqrtPriceDiff = (currentSqrtPrice - lowerSqrtPrice) as SqrtPrice
    liquidity = ((y * SQRT_PRICE_DENOMINATOR * LIQUIDITY_DENOMINATOR) / sqrtPriceDiff) as Liquidity
    const denominator = ((currentSqrtPrice * upperSqrtPrice) / SQRT_PRICE_DENOMINATOR) as SqrtPrice
    const nominator = (upperSqrtPrice - currentSqrtPrice) as SqrtPrice
    const x = calculateX(nominator, denominator, liquidity, roundingUp)
    return { l: liquidity, amount: x }
  }
}

const calculateX = (
  nominator: SqrtPrice,
  denominator: SqrtPrice,
  liquidity: Liquidity,
  roundingUp: boolean
): TokenAmount => {
  const common = mulDiv(liquidity, nominator, denominator)
  if (roundingUp) {
    return ((common + LIQUIDITY_DENOMINATOR - 1n) / LIQUIDITY_DENOMINATOR) as TokenAmount
  } else {
    return (common / LIQUIDITY_DENOMINATOR) as TokenAmount
  }
}

export const getLiquidity = (
  x: TokenAmount,
  y: TokenAmount,
  lowerTick: bigint,
  upperTick: bigint,
  currentSqrtPrice: SqrtPrice,
  roundingUp: boolean
): LiquidityResult => {
  if (lowerTick < GLOBAL_MIN_TICK || upperTick > GLOBAL_MAX_TICK) {
    throw new Error(UtilsError.InvalidTickIndex.toString())
  }

  const lowerSqrtPrice = calculateSqrtPrice(lowerTick)
  const upperSqrtPrice = calculateSqrtPrice(upperTick)

  if (upperSqrtPrice < currentSqrtPrice) {
    const resultByY = getLiquidityByYSqrtPrice(
      y,
      lowerSqrtPrice,
      upperSqrtPrice,
      currentSqrtPrice,
      roundingUp
    )
    return { x: resultByY.amount, y, l: resultByY.l }
  } else if (currentSqrtPrice < lowerSqrtPrice) {
    const resultByX = getLiquidityByXSqrtPrice(
      x,
      lowerSqrtPrice,
      upperSqrtPrice,
      currentSqrtPrice,
      roundingUp
    )
    return { x, y: resultByX.amount, l: resultByX.l }
  }

  const resultByX = getLiquidityByXSqrtPrice(
    x,
    lowerSqrtPrice,
    upperSqrtPrice,
    currentSqrtPrice,
    roundingUp
  )
  const resultByY = getLiquidityByYSqrtPrice(
    y,
    lowerSqrtPrice,
    upperSqrtPrice,
    currentSqrtPrice,
    roundingUp
  )

  if (resultByY.l < resultByX.l) {
    return { x: resultByY.amount, y: resultByX.amount, l: resultByY.l }
  } else {
    return { x: resultByY.amount, y: resultByX.amount, l: resultByX.l }
  }
}

export const getDeltaX = (
  sqrtPriceA: SqrtPrice,
  sqrtPriceB: SqrtPrice,
  liquidity: Liquidity,
  roundingUp: boolean
): TokenAmount => {
  const deltaSqrtPrice = sqrtPriceA > sqrtPriceB ? sqrtPriceA - sqrtPriceB : sqrtPriceB - sqrtPriceA

  const nominator = mulDiv(deltaSqrtPrice, liquidity, LIQUIDITY_DENOMINATOR)
  if (roundingUp) {
    const denominator = mulDiv(sqrtPriceA, sqrtPriceB, SQRT_PRICE_DENOMINATOR)
    const result = divToTokenUp(nominator, denominator)
    if (result > MAX_U256) {
      throw new Error(ArithmeticError.CastOverflow.toString())
    }
    return result
  } else {
    const denominatorUp = mulDivUp(sqrtPriceA, sqrtPriceB, SQRT_PRICE_DENOMINATOR)
    const result = divToToken(nominator, denominatorUp)
    if (result > MAX_U256) {
      throw new Error(ArithmeticError.CastOverflow.toString())
    }
    return result
  }
}

export const getDeltaY = (
  sqrtPriceA: SqrtPrice,
  sqrtPriceB: SqrtPrice,
  liquidity: Liquidity,
  roundingUp: boolean
): TokenAmount => {
  const deltaSqrtPrice = sqrtPriceA > sqrtPriceB ? sqrtPriceA - sqrtPriceB : sqrtPriceB - sqrtPriceA

  if (roundingUp) {
    let result = mulDiv(deltaSqrtPrice, liquidity, LIQUIDITY_DENOMINATOR)
    result = divUp(result, SQRT_PRICE_DENOMINATOR, 1n)
    if (result > MAX_U256) {
      throw new Error(ArithmeticError.CastOverflow.toString())
    }
    return result as TokenAmount
  } else {
    let result = mulDiv(deltaSqrtPrice, liquidity, LIQUIDITY_DENOMINATOR)
    result = div(result, SQRT_PRICE_DENOMINATOR, 1n)
    if (result > MAX_U256) {
      throw new Error(ArithmeticError.CastOverflow.toString())
    }
    return result as TokenAmount
  }
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

const divToTokenUp = (a: bigint, b: bigint): TokenAmount => {
  let result = a * SQRT_PRICE_DENOMINATOR
  result += b - 1n
  result /= b
  result += SQRT_PRICE_DENOMINATOR - 1n
  result /= SQRT_PRICE_DENOMINATOR
  return result as TokenAmount
}

const divToToken = (a: bigint, b: bigint): TokenAmount => {
  let result = a * SQRT_PRICE_DENOMINATOR
  result /= b
  result /= SQRT_PRICE_DENOMINATOR
  return result as TokenAmount
}

export const getMaxTick = (tickSpacing: bigint): bigint => {
  return (GLOBAL_MAX_TICK / tickSpacing) * tickSpacing
}

export const getMinTick = (tickSpacing: bigint): bigint => {
  return (GLOBAL_MIN_TICK / tickSpacing) * tickSpacing
}

export const getMaxChunk = (tickSpacing: bigint): bigint => {
  const maxTick = getMaxTick(tickSpacing)
  const maxBitmapIndex = (maxTick + GLOBAL_MAX_TICK) / tickSpacing
  return maxBitmapIndex / CHUNK_SIZE
}

export const calculateTick = (sqrtPrice: SqrtPrice, tickSpacing: bigint): bigint => {
  return getTickAtSqrtPrice(sqrtPrice, tickSpacing)
}

export const getMaxSqrtPrice = (tickSpacing: bigint): SqrtPrice => {
  return calculateSqrtPrice(getMaxTick(tickSpacing))
}

export const getMinSqrtPrice = (tickSpacing: bigint): SqrtPrice => {
  return calculateSqrtPrice(getMinTick(tickSpacing))
}

export const isTokenX = (candidate: string, compareTo: string): boolean => {
  if (candidate === compareTo) {
    throw new Error(InvariantError.TokensAreSame.toString())
  }

  if (candidate.length != 64 || candidate.length !== compareTo.length) {
    throw new Error(
      'Invalid Contract ID length [required 64]: ' + candidate.length + ' or ' + compareTo.length
    )
  }
  return candidate < compareTo
}

export const getTickAtSqrtPrice = (sqrtPrice: bigint, tickSpacing: bigint): bigint => {
  if (sqrtPrice > MAX_SQRT_PRICE || sqrtPrice < MIN_SQRT_PRICE) {
    throw new Error(String(LogError.SqrtPriceOutOfRange))
  }

  const sqrtPriceX32 = sqrtPriceToX32(sqrtPrice)
  const [log2Sign, log2SqrtPrice] = log2IterativeApproximationX32(sqrtPriceX32)

  let absFloorTick: bigint
  let nearerTick: bigint
  let fartherTick: bigint
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

  let accurateTick: bigint
  if (log2Sign) {
    const fartherTickSqrtPriceDecimal = calculateSqrtPrice(fartherTick)
    accurateTick =
      sqrtPrice >= fartherTickSqrtPriceDecimal ? fartherTickWithSpacing : nearerTickWithSpacing
  } else {
    const nearerTickSqrtPriceDecimal = calculateSqrtPrice(nearerTick)
    accurateTick =
      sqrtPrice >= nearerTickSqrtPriceDecimal ? nearerTickWithSpacing : fartherTickWithSpacing
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
      result |= delta
      y >>= 1n
    }
    delta >>= 1n
  }
  return [sign, result]
}

const log2FloorX32 = (sqrtPriceX32: bigint): bigint => {
  let msb = 0n

  if (sqrtPriceX32 >= 1n << 32n) {
    sqrtPriceX32 >>= 32n
    msb |= 32n
  }
  if (sqrtPriceX32 >= 1n << 16n) {
    sqrtPriceX32 >>= 16n
    msb |= 16n
  }
  if (sqrtPriceX32 >= 1n << 8n) {
    sqrtPriceX32 >>= 8n
    msb |= 8n
  }
  if (sqrtPriceX32 >= 1n << 4n) {
    sqrtPriceX32 >>= 4n
    msb |= 4n
  }
  if (sqrtPriceX32 >= 1n << 2n) {
    sqrtPriceX32 >>= 2n
    msb |= 2n
  }
  if (sqrtPriceX32 >= 1n << 1n) {
    msb |= 1n
  }

  return msb
}

const alignTickToSpacing = (accurateTick: bigint, tickSpacing: bigint): bigint => {
  if (accurateTick > 0n) {
    return accurateTick - (accurateTick % tickSpacing)
  } else {
    const positiveTick = -accurateTick
    const remainder = positiveTick % tickSpacing
    let substrahend = remainder ? tickSpacing - remainder : 0n
    return accurateTick - substrahend
  }
}

export const tickToPosition = (tick: bigint, tickSpacing: bigint): [bigint, bigint] => {
  if (tick < GLOBAL_MIN_TICK || tick > GLOBAL_MAX_TICK) {
    throw new Error(String(InvariantError.InvalidTickIndex))
  }
  if (tick % tickSpacing) {
    throw new Error(String(InvariantError.TickAndTickSpacingMismatch))
  }

  const bitmapIndex = (tick + GLOBAL_MAX_TICK) / tickSpacing
  const chunk = bitmapIndex / CHUNK_SIZE
  const bit = bitmapIndex % CHUNK_SIZE

  return [chunk, bit]
}

export const calculateFee = (
  pool: Pool,
  position: Position,
  lowerTick: Tick,
  upperTick: Tick
): [TokenAmount, TokenAmount] => {
  const [feeGrowthInsideX, feeGrowthInsideY] = calculateFeeGrowthInside(
    lowerTick.index,
    upperTick.index,
    pool.currentTickIndex,
    pool.feeGrowthGlobalX,
    pool.feeGrowthGlobalY,
    lowerTick.feeGrowthOutsideX,
    lowerTick.feeGrowthOutsideY,
    upperTick.feeGrowthOutsideX,
    upperTick.feeGrowthOutsideY
  )

  const tokensOwedX = toFee(
    wrapNegative(feeGrowthInsideX - position.feeGrowthInsideX) as FeeGrowth,
    position.liquidity
  ) as TokenAmount

  const tokensOwedY = toFee(
    wrapNegative(feeGrowthInsideY - position.feeGrowthInsideY) as FeeGrowth,
    position.liquidity
  ) as TokenAmount

  return [tokensOwedX, tokensOwedY]
}

const toFee = (feeGrowth: FeeGrowth, liquidity: Liquidity): TokenAmount => {
  return mulDiv(feeGrowth, liquidity, 10n ** (FEE_GROWTH_SCALE + LIQUIDITY_SCALE)) as TokenAmount
}

const calculateFeeGrowthInside = (
  tickLowerIndex: bigint,
  tickUpperIndex: bigint,
  tickCurrent: bigint,
  globalFeeGrowthX: FeeGrowth,
  globalFeeGrowthY: FeeGrowth,
  tickLowerFeeGrowthOutsideX: FeeGrowth,
  tickLowerFeeGrowthOutsideY: FeeGrowth,
  tickUpperFeeGrowthOutsideX: FeeGrowth,
  tickUpperFeeGrowthOutsideY: FeeGrowth
): [FeeGrowth, FeeGrowth] => {
  const currentAboveLower = tickCurrent >= tickLowerIndex
  const currentBelowUpper = tickCurrent < tickUpperIndex

  let feeGrowthBelowX = tickLowerFeeGrowthOutsideX
  let feeGrowthBelowY = tickLowerFeeGrowthOutsideY

  let feeGrowthAboveX = tickUpperFeeGrowthOutsideX
  let feeGrowthAboveY = tickUpperFeeGrowthOutsideY

  if (!currentAboveLower) {
    feeGrowthBelowX = (globalFeeGrowthX - tickLowerFeeGrowthOutsideX) as FeeGrowth
    feeGrowthBelowY = (globalFeeGrowthY - tickLowerFeeGrowthOutsideY) as FeeGrowth
  }

  if (!currentBelowUpper) {
    feeGrowthAboveX = (globalFeeGrowthX - tickUpperFeeGrowthOutsideX) as FeeGrowth
    feeGrowthAboveY = (globalFeeGrowthY - tickUpperFeeGrowthOutsideY) as FeeGrowth
  }

  const feeGrowthInsideX = wrapNegative(
    globalFeeGrowthX - feeGrowthBelowX - feeGrowthAboveX
  ) as FeeGrowth
  const feeGrowthInsideY = wrapNegative(
    globalFeeGrowthY - feeGrowthBelowY - feeGrowthAboveY
  ) as FeeGrowth

  return [feeGrowthInsideX, feeGrowthInsideY]
}

const wrapNegative = (a: bigint): bigint => {
  let buffer = a
  while (buffer < 0n) {
    buffer += MAX_U256 + 1n
  }
  return buffer
}

export const calculateTokenAmounts = (
  pool: Pool,
  position: Position
): [TokenAmount, TokenAmount, boolean] => {
  return calculateAmountDelta(
    pool.currentTickIndex,
    pool.sqrtPrice,
    position.liquidity,
    false,
    position.upperTickIndex,
    position.lowerTickIndex
  )
}

export const calculateAmountDelta = (
  currentTickIndex: bigint,
  currentSqrtPrice: SqrtPrice,
  liquidityDelta: Liquidity,
  liquiditySign: boolean,
  upperTick: bigint,
  lowerTick: bigint
): [TokenAmount, TokenAmount, boolean] => {
  if (upperTick <= lowerTick) {
    throw new Error(CLAMMError.InvalidTickIndex.toString())
  }

  let amountX = 0n as TokenAmount
  let amountY = 0n as TokenAmount
  let updateLiquidity = false

  if (currentTickIndex < lowerTick) {
    amountX = getDeltaX(
      calculateSqrtPrice(lowerTick),
      calculateSqrtPrice(upperTick),
      liquidityDelta,
      liquiditySign
    )
  } else if (currentTickIndex < upperTick) {
    amountX = getDeltaX(
      currentSqrtPrice,
      calculateSqrtPrice(upperTick),
      liquidityDelta,
      liquiditySign
    )
    amountY = getDeltaY(
      calculateSqrtPrice(lowerTick),
      currentSqrtPrice,
      liquidityDelta,
      liquiditySign
    )
    updateLiquidity = true
  } else {
    amountY = getDeltaY(
      calculateSqrtPrice(lowerTick),
      calculateSqrtPrice(upperTick),
      liquidityDelta,
      liquiditySign
    )
  }
  return [amountX, amountY, updateLiquidity]
}

export const bitPositionToTick = (chunk: bigint, bit: bigint, tickSpacing: bigint): bigint => {
  const tickRangeLimit = GLOBAL_MAX_TICK - (GLOBAL_MAX_TICK % tickSpacing)
  return chunk * CHUNK_SIZE * tickSpacing + bit * tickSpacing - tickRangeLimit
}

const sqrt = (value: bigint): bigint => {
  if (value < 0n) {
    throw 'square root of negative numbers is not supported'
  }

  if (value < 2n) {
    return value
  }

  return newtonIteration(value, 1n)
}

const newtonIteration = (n: bigint, x0: bigint): bigint => {
  const x1 = (n / x0 + x0) >> 1n
  if (x0 === x1 || x0 === x1 - 1n) {
    return x0
  }
  return newtonIteration(n, x1)
}

export const sqrtPriceToPrice = (sqrtPrice: SqrtPrice): Price => {
  return ((sqrtPrice * sqrtPrice) / SQRT_PRICE_DENOMINATOR) as Price
}

export const priceToSqrtPrice = (price: Price): SqrtPrice => {
  return sqrt(price * SQRT_PRICE_DENOMINATOR) as SqrtPrice
}

export const calculateSqrtPriceAfterSlippage = (
  sqrtPrice: SqrtPrice,
  slippage: Percentage,
  up: boolean
): SqrtPrice => {
  if (slippage === 0n) {
    return sqrtPrice
  }

  const multiplier = PERCENTAGE_DENOMINATOR + (up ? slippage : -slippage)
  const price = sqrtPriceToPrice(sqrtPrice)
  const priceWithSlippage = (price * multiplier * PERCENTAGE_DENOMINATOR) as Price
  const sqrtPriceWithSlippage = priceToSqrtPrice(priceWithSlippage) / PERCENTAGE_DENOMINATOR

  return sqrtPriceWithSlippage as SqrtPrice
}

export const calculatePriceImpact = (
  startingSqrtPrice: SqrtPrice,
  endingSqrtPrice: SqrtPrice
): Percentage => {
  const startingPrice = startingSqrtPrice * startingSqrtPrice
  const endingPrice = endingSqrtPrice * endingSqrtPrice
  const diff = startingPrice - endingPrice

  const nominator = diff > 0n ? diff : -diff
  const denominator = startingPrice > endingPrice ? startingPrice : endingPrice

  return ((nominator * PERCENTAGE_DENOMINATOR) / denominator) as Percentage
}

export const calculateTickDelta = (
  tickSpacing: bigint,
  minimumRange: number,
  concentration: number
) => {
  const tickSpacingN = Number(tickSpacing)
  const base = Math.pow(1.0001, -(tickSpacingN / 4))
  const logArg =
    (1 - 1 / (concentration * CONCENTRATION_FACTOR)) /
    Math.pow(1.0001, (-tickSpacingN * minimumRange) / 4)

  return Math.ceil(Math.log(logArg) / Math.log(base) / 2)
}

export const calculateTokenAmountsWithSlippage = (
  tickSpacing: bigint,
  currentSqrtPrice: SqrtPrice,
  liquidity: Liquidity,
  lowerTickIndex: bigint,
  upperTickIndex: bigint,
  slippage: Percentage,
  roundingUp: boolean
): [bigint, bigint] => {
  const lowerBound = calculateSqrtPriceAfterSlippage(currentSqrtPrice, slippage, false)
  const upperBound = calculateSqrtPriceAfterSlippage(currentSqrtPrice, slippage, true)

  const currentTickIndex = calculateTick(currentSqrtPrice, tickSpacing)

  const [lowerX, lowerY] = calculateAmountDelta(
    currentTickIndex,
    lowerBound,
    liquidity,
    roundingUp,
    upperTickIndex,
    lowerTickIndex
  )
  const [upperX, upperY] = calculateAmountDelta(
    currentTickIndex,
    upperBound,
    liquidity,
    roundingUp,
    upperTickIndex,
    lowerTickIndex
  )

  const x = lowerX > upperX ? lowerX : upperX
  const y = lowerY > upperY ? lowerY : upperY
  return [x, y]
}

/// get in name, but does computation
export const getConcentrationArray = (
  tickSpacing: bigint,
  minimumRange: number,
  currentTick: number
): number[] => {
  const concentrations: number[] = []
  const tickSpacingN = Number(tickSpacing)
  let counter = 0
  let concentration = 0
  let lastConcentration = calculateConcentration(tickSpacingN, minimumRange, counter) + 1
  let concentrationDelta = 1

  while (concentrationDelta >= 1) {
    concentration = calculateConcentration(tickSpacingN, minimumRange, counter)
    concentrations.push(concentration)
    concentrationDelta = lastConcentration - concentration
    lastConcentration = concentration
    counter++
  }
  concentration = Math.ceil(concentrations[concentrations.length - 1])

  while (concentration > 1) {
    concentrations.push(concentration)
    concentration--
  }
  const maxTick = Number(alignTickToSpacing(getMaxTick(1n), tickSpacing))
  if ((minimumRange / 2) * tickSpacingN > maxTick - Math.abs(currentTick)) {
    throw new Error(String(InvariantError.TickLimitReached))
  }
  const limitIndex =
    (maxTick - Math.abs(currentTick) - (minimumRange / 2) * tickSpacingN) / tickSpacingN

  return concentrations.slice(0, limitIndex)
}

const CONCENTRATION_FACTOR = 1.00001526069123
const calculateConcentration = (tickSpacing: number, minimumRange: number, n: number) => {
  const concentration = 1 / (1 - Math.pow(1.0001, (-tickSpacing * (minimumRange + 2 * n)) / 4))
  return concentration / CONCENTRATION_FACTOR
}

export const calculateLiquidityBreakpoints = (ticks: TickVariant[]): LiquidityBreakpoint[] => {
  let currentLiquidity = 0n as Liquidity

  return ticks.map(tick => {
    currentLiquidity = (currentLiquidity +
      tick.liquidityChange * (tick.sign ? 1n : -1n)) as Liquidity
    return {
      liquidity: currentLiquidity,
      index: tick.index
    }
  })
}

export const toLiquidity = (value: bigint, offset = 0n): Liquidity => {
  if (offset > LIQUIDITY_SCALE)
    throw new Error(`offset must be less than or equal to ${LIQUIDITY_SCALE}`)
  return (value * 10n ** (LIQUIDITY_SCALE - offset)) as Liquidity
}

export const toSqrtPrice = (value: bigint, offset = 0n): SqrtPrice => {
  if (offset > SQRT_PRICE_SCALE)
    throw new Error(`offset must be less than or equal to ${SQRT_PRICE_SCALE}`)
  return (value * 10n ** (SQRT_PRICE_SCALE - offset)) as SqrtPrice
}

export const toPrice = (value: bigint, offset = 0n): Price => {
  if (offset > PRICE_SCALE) throw new Error(`offset must be less than or equal to ${PRICE_SCALE}`)
  return (value * 10n ** (PRICE_SCALE - offset)) as Price
}

export const toPercentage = (value: bigint, offset = 0n): Percentage => {
  if (offset > PERCENTAGE_SCALE)
    throw new Error(`offset must be less than or equal to ${PERCENTAGE_SCALE}`)
  return (value * 10n ** (PERCENTAGE_SCALE - offset)) as Percentage
}

export const toFeeGrowth = (value: bigint, offset = 0n): FeeGrowth => {
  if (offset > FEE_GROWTH_SCALE)
    throw new Error(`offset must be less than or equal to ${FEE_GROWTH_SCALE}`)
  return (value * 10n ** (FEE_GROWTH_SCALE - offset)) as FeeGrowth
}

export const toTokenAmount = (value: bigint, decimals: bigint, offset = 0n): TokenAmount => {
  if (offset > decimals) throw new Error(`offset must be less than or equal to ${decimals}`)
  return (value * 10n ** (decimals - offset)) as TokenAmount
}

export const toFixedPoint = (value: bigint, offset = 0n): FixedPoint => {
  if (offset > FIXED_POINT_SCALE)
    throw new Error(`offset must be less than or equal to ${FIXED_POINT_SCALE}`)
  return (value * 10n ** (FIXED_POINT_SCALE - offset)) as FixedPoint
}
