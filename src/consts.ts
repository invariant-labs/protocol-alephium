import { CLAMM, Invariant } from '../artifacts/ts'
import {
  MIN_SQRT_PRICE as _MIN_SQRT_PRICE,
  MAX_SQRT_PRICE as _MAX_SQRT_PRICE,
  SQRT_PRICE_DENOMINATOR as _SQRT_PRICE_DENOMINATOR,
  FEE_GROWTH_DENOMINATOR as _FEE_GROWTH_DENOMINATOR,
  LIQUIDITY_DENOMINATOR as _LIQUIDITY_DENOMINATOR,
  TOKEN_AMOUNT_DENOMINATOR as _TOKEN_AMOUNT_DENOMINATOR,
  PERCENTAGE_DENOMINATOR as _PERCENTAGE_DENOMINATOR,
  FIXED_POINT_DENOMINATOR as _FIXED_POINT_DENOMINATOR,
  SQRT_PRICE_SCALE
} from '../artifacts/ts/constants'
import { Network } from './network'
import {
  FeeGrowth,
  FixedPoint,
  Liquidity,
  Percentage,
  Price,
  SqrtPrice,
  TokenAmount
} from './types'

export * from '../artifacts/ts/constants'

export const MIN_SQRT_PRICE = _MIN_SQRT_PRICE as SqrtPrice
export const MAX_SQRT_PRICE = _MAX_SQRT_PRICE as SqrtPrice
export const SQRT_PRICE_DENOMINATOR = _SQRT_PRICE_DENOMINATOR as SqrtPrice
export const FEE_GROWTH_DENOMINATOR = _FEE_GROWTH_DENOMINATOR as FeeGrowth
export const LIQUIDITY_DENOMINATOR = _LIQUIDITY_DENOMINATOR as Liquidity
export const TOKEN_AMOUNT_DENOMINATOR = _TOKEN_AMOUNT_DENOMINATOR as TokenAmount
export const PERCENTAGE_DENOMINATOR = _PERCENTAGE_DENOMINATOR as Percentage
export const FIXED_POINT_DENOMINATOR = _FIXED_POINT_DENOMINATOR as FixedPoint

export const { SEARCH_RANGE, CHUNKS_PER_BATCH, HALF_CHUNK_SIZE, CHUNK_SIZE } = Invariant.consts

export const {
  WORD_SIZE,
  LOG2_ONE,
  LOG2_DOUBLE_ONE,
  LOG2_SCALE,
  LOG2_HALF,
  LOG2_ACCURACY,
  LOG2_TWO,
  LOG2_SQRT10001,
  LOG2_NEGATIVE_MAX_LOSE
} = CLAMM.consts

export const PRICE_SCALE = SQRT_PRICE_SCALE
export const PRICE_DENOMINATOR = _SQRT_PRICE_DENOMINATOR as Price

export const MAX_BATCHES_QUERIED = 18n
export const MAX_POOL_KEYS_RETURNED = 117n
export const POSITIONS_ENTRIES_LIMIT = 83n
export const MAX_LIQUIDITY_TICKS_QUERIED = 269n

export enum VMError {
  ArithmeticError = 'ArithmeticError',
  OutOfGas = 'OutOfGas',
  NotEnoughBalance = 'Not enough approved balance for address',
  MaxStoredAssets = 'max token number is 8',
  VMExecutionError = 'VM execution error: Assertion Failed in Contract'
}

export const INVARIANT_ADDRESS = {
  [Network.Devnet]: '',
  [Network.Testnet]: '242VBmymDnYfBcy33Dz7x5McrgxuJ16YXhipm4cQYtHKd',
  [Network.Mainnet]: ''
}
export const BTC_ID = {
  [Network.Devnet]: '',
  [Network.Testnet]: '5fcbb6c36160db6275900637cc842e1f0a5bd97f2a030153a4fae717260c2700',
  [Network.Mainnet]: ''
}
export const ETH_ID = {
  [Network.Devnet]: '',
  [Network.Testnet]: 'd92ea47be07234444f92ae84ef91bdcea7e5965097e4ac987a747cf073d15800',
  [Network.Mainnet]: ''
}
export const USDC_ID = {
  [Network.Devnet]: '',
  [Network.Testnet]: 'ec3547bffc2e9841a26cb4511fe6339a8b7a41435fb4be3242a8a73c0629c200',
  [Network.Mainnet]: ''
}
export const USDT_ID = {
  [Network.Devnet]: '',
  [Network.Testnet]: '042843b9e853fca28f425f8d2d96e9cd089e4e76c755c60cf795b704ede4dc00',
  [Network.Mainnet]: ''
}
export const SOL_ID = {
  [Network.Devnet]: '',
  [Network.Testnet]: 'c925472266dbd7f2e01313ad787cfb12b7f4be6776e9a3b02daed9dde7706200',
  [Network.Mainnet]: ''
}
