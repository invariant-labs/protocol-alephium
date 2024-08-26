import {
  FeeGrowth,
  Liquidity,
  Percentage,
  SqrtPrice,
  TokenAmount,
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

type WrappedNumber = FeeGrowth | Liquidity | Percentage | SqrtPrice | TokenAmount

type UnwrapNumbers<T> = {
  [P in keyof T]: T[P] extends WrappedNumber ? bigint : T[P]
}

export type TickVariant = LiquidityTick | Tick

export type Pool = UnwrapNumbers<_Pool>
export type Tick = UnwrapNumbers<_Tick>
export type Position = UnwrapNumbers<_Position>
export type FeeTier = UnwrapNumbers<_FeeTier>
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

export function unwrapPool(pool: _Pool): Pool {
  const unwrapped = {
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
    liquidity: position.liquidity.v,
    feeGrowthInsideX: position.feeGrowthInsideX.v,
    feeGrowthInsideY: position.feeGrowthInsideY.v,
    tokensOwedX: position.tokensOwedX.v,
    tokensOwedY: position.tokensOwedY.v
  }

  return { ...position, ...unwrapped }
}

export function unwrapFeeTier(feeTier: _FeeTier): FeeTier {
  return { ...feeTier, fee: feeTier.fee.v }
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
  return { x: liquidityResult.x.v, y: liquidityResult.y.v, l: liquidityResult.l.v }
}

export function unwrapSingleTokenLiquidity(
  singleTokenLiquidity: _SingleTokenLiquidity
): SingleTokenLiquidity {
  return { l: singleTokenLiquidity.l.v, amount: singleTokenLiquidity.amount.v }
}

export function unwrapLiquidityTick(liquidityTick: _LiquidityTick): LiquidityTick {
  return { ...liquidityTick, liquidityChange: liquidityTick.liquidityChange.v }
}

function createEntityProxy<T>(entity: T, exists: boolean) {
  return new Proxy(
    { ...entity, exists },
    {
      get(target, prop, receiver) {
        if (!exists && prop !== 'exists' && prop in target) {
          throw new Error(`Entity does not exist, cannot access property "${String(prop)}"`)
        }
        return Reflect.get(target, prop, receiver)
      }
    }
  )
}

export function decodePool(array: [boolean, _Pool]): Pool {
  return createEntityProxy(unwrapPool(array[1]), array[0])
}

export function decodeTick(array: [boolean, _Tick]): Tick {
  return createEntityProxy(unwrapTick(array[1]), array[0])
}

export function decodePosition(array: [boolean, _Position]): Position {
  return createEntityProxy(unwrapPosition(array[1]), array[0])
}
