import { CLAMM, Invariant } from '../artifacts/ts'

export * from '../artifacts/ts/constants'

export const {
  SEARCH_RANGE,
  CHUNKS_PER_BATCH,
  CHUNK_SIZE
} = Invariant.consts

export const { WORD_SIZE } = CLAMM.consts

export const MAX_BATCHES_QUERIED = 18n
export const MAX_POOL_KEYS_QUERIED = 117n
export const MAX_POSITIONS_QUERIED = 83n
export const MAX_LIQUIDITY_TICKS_QUERIED = 269n

export enum VMError {
  ArithmeticError = 'ArithmeticError',
  OutOfGas = 'OutOfGas',
  MaxStoredAssets = 'max token number is 8'
}
