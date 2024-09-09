import { Address, HexString } from '@alephium/web3'
import {
  PoolKey as _PoolKey,
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

export type SqrtPrice = bigint & { readonly brand: unique symbol }
export type Price = bigint & { readonly brand: unique symbol }
export type FeeGrowth = bigint & { readonly brand: unique symbol }
export type Liquidity = bigint & { readonly brand: unique symbol }
export type TokenAmount = bigint & { readonly brand: unique symbol }
export type Percentage = bigint & { readonly brand: unique symbol }
export type FixedPoint = bigint & { readonly brand: unique symbol }

export type TickVariant = LiquidityTick | Tick

export interface FeeTier {
  fee: Percentage
  tickSpacing: bigint
}

export type PoolKey = {
  tokenX: Address
  tokenY: Address
  feeTier: FeeTier
}

export interface Pool {
  poolKey: PoolKey
  liquidity: Liquidity
  sqrtPrice: SqrtPrice
  currentTickIndex: bigint
  feeGrowthGlobalX: FeeGrowth
  feeGrowthGlobalY: FeeGrowth
  feeProtocolTokenX: TokenAmount
  feeProtocolTokenY: TokenAmount
  startTimestamp: bigint
  lastTimestamp: bigint
  feeReceiver: Address
  reserveX: HexString
  reserveY: HexString
}

export interface Position {
  poolKey: PoolKey
  liquidity: Liquidity
  lowerTickIndex: bigint
  upperTickIndex: bigint
  feeGrowthInsideX: FeeGrowth
  feeGrowthInsideY: FeeGrowth
  lastBlockNumber: bigint
  tokensOwedX: TokenAmount
  tokensOwedY: TokenAmount
  owner: Address
}

export interface Tick {
  sign: boolean
  index: bigint
  liquidityChange: Liquidity
  liquidityGross: Liquidity
  sqrtPrice: SqrtPrice
  feeGrowthOutsideX: FeeGrowth
  feeGrowthOutsideY: FeeGrowth
  secondsOutside: bigint
}

export interface SwapResult {
  nextSqrtPrice: SqrtPrice
  amountIn: TokenAmount
  amountOut: TokenAmount
  feeAmount: TokenAmount
}

export interface CalculateSwapResult {
  amountIn: TokenAmount
  amountOut: TokenAmount
  startSqrtPrice: SqrtPrice
  targetSqrtPrice: SqrtPrice
  fee: TokenAmount
}

export interface QuoteResult {
  amountIn: TokenAmount
  amountOut: TokenAmount
  targetSqrtPrice: SqrtPrice
}

export interface LiquidityResult {
  x: TokenAmount
  y: TokenAmount
  l: Liquidity
}

export interface SingleTokenLiquidity {
  l: Liquidity
  amount: TokenAmount
}

export interface LiquidityTick {
  index: bigint
  liquidityChange: Liquidity
  sign: boolean
}

export interface LiquidityBreakpoint {
  liquidity: Liquidity
  index: bigint
}

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
  return { ...feeTier, fee: feeTier.fee.v as Percentage }
}

export function unwrapPoolKey(poolKey: _PoolKey): PoolKey {
  return { ...poolKey, feeTier: unwrapFeeTier(poolKey.feeTier) }
}

export function unwrapPool(pool: _Pool): Pool {
  const unwrapped = {
    poolKey: unwrapPoolKey(pool.poolKey),
    liquidity: pool.liquidity.v as Liquidity,
    sqrtPrice: pool.sqrtPrice.v as SqrtPrice,
    feeGrowthGlobalX: pool.feeGrowthGlobalX.v as FeeGrowth,
    feeGrowthGlobalY: pool.feeGrowthGlobalY.v as FeeGrowth,
    feeProtocolTokenX: pool.feeProtocolTokenX.v as TokenAmount,
    feeProtocolTokenY: pool.feeProtocolTokenY.v as TokenAmount
  }

  return { ...pool, ...unwrapped }
}

export function unwrapTick(tick: _Tick): Tick {
  const unwrapped = {
    liquidityChange: tick.liquidityChange.v as Liquidity,
    liquidityGross: tick.liquidityGross.v as Liquidity,
    sqrtPrice: tick.sqrtPrice.v as SqrtPrice,
    feeGrowthOutsideX: tick.feeGrowthOutsideX.v as FeeGrowth,
    feeGrowthOutsideY: tick.feeGrowthOutsideY.v as FeeGrowth
  }

  return { ...tick, ...unwrapped }
}

export function unwrapPosition(position: _Position): Position {
  const unwrapped = {
    poolKey: unwrapPoolKey(position.poolKey),
    liquidity: position.liquidity.v as Liquidity,
    feeGrowthInsideX: position.feeGrowthInsideX.v as FeeGrowth,
    feeGrowthInsideY: position.feeGrowthInsideY.v as FeeGrowth,
    tokensOwedX: position.tokensOwedX.v as TokenAmount,
    tokensOwedY: position.tokensOwedY.v as TokenAmount
  }

  return { ...position, ...unwrapped }
}

export function unwrapQuoteResult(quote: _QuoteResult): QuoteResult {
  const unwrapped = {
    amountIn: quote.amountIn.v as TokenAmount,
    amountOut: quote.amountOut.v as TokenAmount,
    targetSqrtPrice: quote.targetSqrtPrice.v as SqrtPrice
  }

  return { ...quote, ...unwrapped }
}

export function unwrapLiquidityResult(liquidityResult: _LiquidityResult): LiquidityResult {
  return {
    x: liquidityResult.x.v as TokenAmount,
    y: liquidityResult.y.v as TokenAmount,
    l: liquidityResult.l.v as Liquidity
  }
}

export function unwrapSingleTokenLiquidity(
  singleTokenLiquidity: _SingleTokenLiquidity
): SingleTokenLiquidity {
  return {
    l: singleTokenLiquidity.l.v as Liquidity,
    amount: singleTokenLiquidity.amount.v as TokenAmount
  }
}

export function unwrapLiquidityTick(liquidityTick: _LiquidityTick): LiquidityTick {
  return { ...liquidityTick, liquidityChange: liquidityTick.liquidityChange.v as Liquidity }
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
