import { Address, HexString } from '@alephium/web3'
import {
  PoolKey as _PoolKey,
  FeeGrowth as _FeeGrowth,
  Liquidity as _Liquidity,
  Percentage as _Percentage,
  SqrtPrice as _SqrtPrice,
  TokenAmount as _TokenAmount,
  Pool as _Pool,
  Position as _Position,
  Tick as _Tick,
  FeeTier as _FeeTier,
  SwapResult as _SwapResult,
  CalculateSwapResult as _CalculateSwapResult,
  QuoteResult as _QuoteResult,
  LiquidityResult as _LiquidityResult,
  SingleTokenLiquidity as _SingleTokenLiquidity,
  LiquidityTick as _LiquidityTick
} from '../artifacts/ts/types'
import { InvariantError } from './consts'

type WrappedNumber = _FeeGrowth | _Liquidity | _Percentage | _SqrtPrice | _TokenAmount

type UnwrapNumbers<T> = {
  [P in keyof T]: T[P] extends WrappedNumber ? bigint : T[P]
}

export type TickVariant = LiquidityTick | Tick

export interface FeeTier {
  // percentage
  fee: bigint
  tickSpacing: bigint
}

export type PoolKey = {
  tokenX: Address
  tokenY: Address
  feeTier: FeeTier
}

export interface Pool {
  poolKey: PoolKey
  // liquidity
  liquidity: bigint
  sqrtPrice: bigint
  currentTickIndex: bigint
  // feeGrowth x2
  feeGrowthGlobalX: bigint
  feeGrowthGlobalY: bigint
  // tokenAmount x2
  feeProtocolTokenX: bigint
  feeProtocolTokenY: bigint
  startTimestamp: bigint
  lastTimestamp: bigint
  // address
  feeReceiver: Address
  // hexString
  reserveX: HexString
  reserveY: HexString
}

export interface Position {
  poolKey: PoolKey
  // liquidity
  liquidity: bigint
  lowerTickIndex: bigint
  upperTickIndex: bigint
  // feeGrowth x2
  feeGrowthInsideX: bigint
  feeGrowthInsideY: bigint
  lastBlockNumber: bigint
  // tokenAmount x2
  tokensOwedX: bigint
  tokensOwedY: bigint
  owner: Address
}

export type Tick = UnwrapNumbers<_Tick>
export type SwapResult = UnwrapNumbers<_SwapResult>
export type CalculateSwapResult = UnwrapNumbers<_CalculateSwapResult>
export type QuoteResult = UnwrapNumbers<_QuoteResult>
export type LiquidityResult = UnwrapNumbers<_LiquidityResult>
export type SingleTokenLiquidity = UnwrapNumbers<_SingleTokenLiquidity>
export type LiquidityTick = UnwrapNumbers<_LiquidityTick>

// stores bitmap chunks of ticks that have been initialized
export type Tickmap = Map<bigint, bigint>

export type SimulateSwapResult = CalculateSwapResult & {
  crossedTicks: TickVariant[]
  insufficientLiquidity: boolean
  stateOutdated: boolean
  swapStepLimitReached: boolean
}

export function wrapFeeTier(feeTier: FeeTier): _FeeTier {
  return { ...feeTier, fee: { v: feeTier.fee } }
}

export function wrapPoolKey(poolKey: PoolKey): _PoolKey {
  return { ...poolKey, feeTier: wrapFeeTier(poolKey.feeTier) }
}

export function unwrapFeeTier(feeTier: _FeeTier): FeeTier {
  return { ...feeTier, fee: feeTier.fee.v }
}

export function unwrapPoolKey(poolKey: _PoolKey): PoolKey {
  return { ...poolKey, feeTier: unwrapFeeTier(poolKey.feeTier) }
}

export function unwrapPool(pool: _Pool): Pool {
  const unwrapped = {
    poolKey: unwrapPoolKey(pool.poolKey),
    liquidity: pool.liquidity.v,
    sqrtPrice: pool.sqrtPrice.v,
    feeGrowthGlobalX: pool.feeGrowthGlobalX.v,
    feeGrowthGlobalY: pool.feeGrowthGlobalY.v,
    feeProtocolTokenX: pool.feeProtocolTokenX.v,
    feeProtocolTokenY: pool.feeProtocolTokenY.v
  }

  return { ...pool, ...unwrapped }
}

export function unwrapTick(tick: _Tick): Tick {
  const unwrapped = {
    liquidityChange: tick.liquidityChange.v,
    liquidityGross: tick.liquidityGross.v,
    sqrtPrice: tick.sqrtPrice.v,
    feeGrowthOutsideX: tick.feeGrowthOutsideX.v,
    feeGrowthOutsideY: tick.feeGrowthOutsideY.v
  }

  return { ...tick, ...unwrapped }
}

export function unwrapPosition(position: _Position): Position {
  const unwrapped = {
    poolKey: unwrapPoolKey(position.poolKey),
    liquidity: position.liquidity.v,
    feeGrowthInsideX: position.feeGrowthInsideX.v,
    feeGrowthInsideY: position.feeGrowthInsideY.v,
    tokensOwedX: position.tokensOwedX.v,
    tokensOwedY: position.tokensOwedY.v
  }

  return { ...position, ...unwrapped }
}

export function unwrapQuoteResult(quote: _QuoteResult): QuoteResult {
  const unwrapped = {
    amountIn: quote.amountIn.v,
    amountOut: quote.amountOut.v,
    targetSqrtPrice: quote.targetSqrtPrice.v
  }

  return { ...quote, ...unwrapped }
}

export function unwrapLiquidityResult(liquidityResult: _LiquidityResult): LiquidityResult {
  return {
    x: liquidityResult.x.v,
    y: liquidityResult.y.v,
    l: liquidityResult.l.v
  }
}

export function unwrapSingleTokenLiquidity(
  singleTokenLiquidity: _SingleTokenLiquidity
): SingleTokenLiquidity {
  return { l: singleTokenLiquidity.l.v, amount: singleTokenLiquidity.amount.v }
}

export function unwrapLiquidityTick(liquidityTick: _LiquidityTick): LiquidityTick {
  return { ...liquidityTick, liquidityChange: liquidityTick.liquidityChange.v }
}

function existsOnly<T>(entity: T, exists: boolean, errorCode: bigint): T {
  if (!exists) {
    throw new Error(`${errorCode}`)
  }
  return entity
}

export function decodePool(array: [boolean, _Pool]): Pool {
  return existsOnly(unwrapPool(array[1]), array[0], InvariantError.PoolNotFound)
}

export function decodeTick(array: [boolean, _Tick]): Tick {
  return existsOnly(unwrapTick(array[1]), array[0], InvariantError.InvalidTickIndex)
}

export function decodePosition(array: [boolean, _Position]): Position {
  return existsOnly(unwrapPosition(array[1]), array[0], InvariantError.PositionNotFound)
}
