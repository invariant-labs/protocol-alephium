import {
  NodeProvider,
  codec,
  SignerProvider,
  ZERO_ADDRESS,
  node,
  web3,
  SignExecuteScriptTxResult,
  bs58,
  hexToBinUnsafe,
  ALPH_TOKEN_ID,
  stringToHex,
  HexString
} from '@alephium/web3'
import { Reserve } from '../artifacts/ts'
import { TokenFaucet } from '../artifacts/ts/TokenFaucet'
import { FeeTier as _FeeTier, FeeTiers, PoolKey as _PoolKey } from '../artifacts/ts/types'
import {
  CHUNK_SIZE,
  CHUNKS_PER_BATCH,
  GLOBAL_MAX_TICK,
  InvariantError,
  MAX_FEE_TIERS,
  MAX_SWAP_STEPS,
  PERCENTAGE_DENOMINATOR
} from './consts'
import { Network } from './network'
import {
  FeeGrowth,
  FeeTier,
  Liquidity,
  LiquidityTick,
  Percentage,
  Pool,
  PoolKey,
  Position,
  SimulateSwapResult,
  SqrtPrice,
  Tickmap,
  TickVariant,
  TokenAmount
} from './types'
import { getMaxTick, getMinTick, isTokenX, tickToPosition } from './math'
import { simulateSwap } from './simulate-swap'

const BREAK_BYTES = '627265616b'

export const EMPTY_FEE_TIERS: FeeTiers = {
  feeTiers: new Array<_FeeTier>(Number(MAX_FEE_TIERS)).fill({
    fee: { v: 0n },
    tickSpacing: 0n
  })
} as FeeTiers

export interface Page {
  index: number
  entries: [Position, Pool][]
}

function isConfirmed(txStatus: node.TxStatus): txStatus is node.Confirmed {
  return txStatus.type === 'Confirmed'
}

async function _waitTxConfirmed(
  provider: NodeProvider,
  txId: string,
  confirmations: number
): Promise<node.Confirmed> {
  const status = await provider.transactions.getTransactionsStatus({
    txId: txId
  })
  if (isConfirmed(status) && status.chainConfirmations >= confirmations) {
    return status
  }
  await new Promise(r => setTimeout(r, 1000))
  return _waitTxConfirmed(provider, txId, confirmations)
}

export async function waitTxConfirmed<T extends { txId: string }>(promise: Promise<T>): Promise<T> {
  const result = await promise
  await _waitTxConfirmed(web3.getCurrentNodeProvider(), result.txId, 1)
  return result
}

export const deployReserve = async (signer: SignerProvider) => {
  const deployResult = await waitTxConfirmed(
    Reserve.deploy(signer, {
      initialFields: {
        invariant: ZERO_ADDRESS,
        assetsStored: 0n
      }
    })
  )
  return Reserve.at(deployResult.contractInstance.address)
}

export async function deployTokenFaucet(
  signer: SignerProvider,
  name: string,
  symbol: string,
  decimals: bigint,
  supply: TokenAmount
) {
  return await waitTxConfirmed(
    TokenFaucet.deploy(signer, {
      initialFields: {
        name: stringToHex(name),
        symbol: stringToHex(symbol),
        decimals,
        supply,
        balance: supply
      },
      issueTokenAmount: supply
    })
  )
}

export function simulateInvariantSwap(
  tickmap: Tickmap,
  pool: Pool,
  ticks: TickVariant[],
  xToY: boolean,
  amount: TokenAmount,
  byAmountIn: boolean,
  sqrtPriceLimit: SqrtPrice
): SimulateSwapResult {
  return simulateSwap(tickmap, pool, ticks, xToY, amount, byAmountIn, sqrtPriceLimit)
}

export async function balanceOf(tokenId: string, address: string): Promise<TokenAmount> {
  const balances = await web3.getCurrentNodeProvider().addresses.getAddressesAddressBalance(address)
  if (tokenId == ALPH_TOKEN_ID) {
    return BigInt(balances.balance) as TokenAmount
  }
  const balance = balances.tokenBalances?.find(t => t.id === tokenId)
  return (balance === undefined ? 0n : BigInt(balance.amount)) as TokenAmount
}

export function decodeFeeTiers(string: string) {
  const parts = string.split(BREAK_BYTES)
  const feeTiers: any[] = []

  for (let i = 0; i < parts.length - 1; i += 2) {
    const feeTier = {
      fee: decodeU256(parts[i]),
      tickSpacing: decodeU256(parts[i + 1])
    }

    feeTiers.push(feeTier)
  }

  return feeTiers
}

export function decodePools(string: string): Array<Pool> {
  const offset = 16
  const parts = string.split(BREAK_BYTES)
  const pools: any[] = []
  for (let i = 0; i < parts.length - 1; i += offset) {
    const pool: Pool = {
      poolKey: {
        tokenX: parts[i],
        tokenY: parts[i + 1],
        feeTier: {
          fee: decodeU256(parts[i + 2]) as Percentage,
          tickSpacing: decodeU256(parts[i + 3])
        }
      },
      liquidity: decodeU256(parts[i + 4]) as Liquidity,
      sqrtPrice: decodeU256(parts[i + 5]) as SqrtPrice,
      currentTickIndex: decodeI256(parts[i + 6]),
      feeGrowthGlobalX: decodeU256(parts[i + 7]) as FeeGrowth,
      feeGrowthGlobalY: decodeU256(parts[i + 8]) as FeeGrowth,
      feeProtocolTokenX: decodeU256(parts[i + 9]) as TokenAmount,
      feeProtocolTokenY: decodeU256(parts[i + 10]) as TokenAmount,
      startTimestamp: decodeU256(parts[i + 11]),
      lastTimestamp: decodeU256(parts[i + 12]),
      feeReceiver: AddressFromByteVec(parts[i + 13]),
      reserveX: parts[i + 14],
      reserveY: parts[i + 15]
    }
    pools.push(pool)
  }
  return pools
}

export const decodePoolKeys = (string: string): Array<PoolKey> => {
  const parts = string.split(BREAK_BYTES)
  const poolKeys: any[] = []

  for (let i = 0; i < parts.length - 1; i += 4) {
    const poolKey: PoolKey = {
      tokenX: parts[i],
      tokenY: parts[i + 1],
      feeTier: {
        fee: decodeU256(parts[i + 2]) as Percentage,
        tickSpacing: decodeU256(parts[i + 3])
      }
    }
    poolKeys.push(poolKey)
  }
  return poolKeys
}

export const AddressFromByteVec = (string: string) => {
  const address = bs58.encode(hexToBinUnsafe(string))
  return address
}

function hexToBytes(hex: HexString): Uint8Array {
  // codec.byteStringCodec
  return new Uint8Array(hex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || [])
}

export function decodeU256(string: HexString): bigint {
  return codec.u256Codec.decode(hexToBytes(string))
}

const decodeI256 = (string: HexString): bigint => {
  return codec.i256Codec.decode(hexToBytes(string))
}

const decodeBool = (string: HexString): boolean => {
  return codec.boolCodec.decode(hexToBytes(string))
}

export const newPoolKey = (token0: string, token1: string, feeTier: FeeTier): PoolKey => {
  const [tokenX, tokenY] = isTokenX(token0, token1) ? [token0, token1] : [token1, token0]
  return {
    tokenX,
    tokenY,
    feeTier
  }
}

export const newFeeTier = (fee: Percentage, tickSpacing: bigint): FeeTier => {
  if (tickSpacing <= 0 || tickSpacing > 100) {
    throw new Error(InvariantError.InvalidTickSpacing.toString())
  }
  if (fee >= PERCENTAGE_DENOMINATOR) {
    throw new Error(InvariantError.InvalidFee.toString())
  }
  return {
    fee,
    tickSpacing
  }
}

export const constructTickmap = (string: string): [bigint, bigint][] => {
  const parts = string.split(BREAK_BYTES)
  const chunks: any[] = []

  for (let i = 0; i < parts.length - 1; i += 2) {
    chunks.push([decodeU256(parts[i]), decodeU256(parts[i + 1])])
  }

  return chunks
}

export const decodePositions = (string: string): [[Position, Pool][], bigint] => {
  const parts = string.split(BREAK_BYTES)
  const spacing = 29
  const positions: [Position, Pool][] = []
  for (let i = 0; i < parts.length - 2; i += spacing) {
    const position: Position = {
      poolKey: {
        tokenX: parts[i],
        tokenY: parts[i + 1],
        feeTier: {
          fee: decodeU256(parts[i + 2]) as Percentage,
          tickSpacing: decodeU256(parts[i + 3])
        }
      },
      liquidity: decodeU256(parts[i + 4]) as Liquidity,
      lowerTickIndex: decodeI256(parts[i + 5]),
      upperTickIndex: decodeI256(parts[i + 6]),
      feeGrowthInsideX: decodeU256(parts[i + 7]) as FeeGrowth,
      feeGrowthInsideY: decodeU256(parts[i + 8]) as FeeGrowth,
      lastBlockNumber: decodeU256(parts[i + 9]),
      tokensOwedX: decodeU256(parts[i + 10]) as TokenAmount,
      tokensOwedY: decodeU256(parts[i + 11]) as TokenAmount,
      owner: AddressFromByteVec(parts[i + 12])
    }
    const pool: Pool = {
      poolKey: {
        tokenX: parts[i + 13],
        tokenY: parts[i + 14],
        feeTier: {
          fee: decodeU256(parts[i + 15]) as Percentage,
          tickSpacing: decodeU256(parts[i + 16])
        }
      },
      liquidity: decodeU256(parts[i + 17]) as Liquidity,
      sqrtPrice: decodeU256(parts[i + 18]) as SqrtPrice,
      currentTickIndex: decodeI256(parts[i + 19]),
      feeGrowthGlobalX: decodeU256(parts[i + 20]) as FeeGrowth,
      feeGrowthGlobalY: decodeU256(parts[i + 21]) as FeeGrowth,
      feeProtocolTokenX: decodeU256(parts[i + 22]) as TokenAmount,
      feeProtocolTokenY: decodeU256(parts[i + 23]) as TokenAmount,
      startTimestamp: decodeU256(parts[i + 24]),
      lastTimestamp: decodeU256(parts[i + 25]),
      feeReceiver: AddressFromByteVec(parts[i + 26]),
      reserveX: parts[i + 27],
      reserveY: parts[i + 28]
    }
    positions.push([position, pool])
  }

  const totalPositions = decodeU256(parts[parts.length - 1])

  return [positions, totalPositions]
}

export const getMaxBatch = (tickSpacing: bigint): bigint => {
  const maxTick = getMaxTick(tickSpacing)
  const minTick = getMinTick(tickSpacing)
  const ticksAmount = -minTick + maxTick + 1n
  const lastBatch = ticksAmount / (CHUNK_SIZE * CHUNKS_PER_BATCH)
  return lastBatch
}

function getNodeUrl(network: Network): string {
  if (network === Network.Devnet) {
    return 'http://127.0.0.1:22973'
  } else if (network === Network.Testnet) {
    return 'https://node.testnet.alephium.org'
  } else if (network === Network.Mainnet) {
    return 'https://node.mainnet.alephium.org'
  } else {
    throw new Error('Invalid network')
  }
}

export function setOfficialNodeProvider(network: Network): void {
  const nodeUrl = getNodeUrl(network)
  const nodeProvider = new NodeProvider(nodeUrl)
  web3.setCurrentNodeProvider(nodeProvider)
}

export const signAndSend = async (
  signer: SignerProvider,
  tx: Omit<SignExecuteScriptTxResult, 'signature'>
): Promise<string> => {
  const { address } = await signer.getSelectedAccount()
  const { txId } = await waitTxConfirmed(
    signer.signAndSubmitUnsignedTx({
      signerAddress: address,
      unsignedTx: tx.unsignedTx
    })
  )
  return txId
}

export const toByteVecWithOffset = (
  values: bigint[],
  offset: bigint = GLOBAL_MAX_TICK,
  radix: number = 16,
  length: number = 8,
  filler: string = '0'
): string => {
  return values.map(value => (value + offset).toString(radix).padStart(length, filler)).join('')
}

export const decodeLiquidityTicks = (string: string): LiquidityTick[] => {
  const parts = string.split(BREAK_BYTES)
  const ticks: LiquidityTick[] = []
  for (let i = 0; i < parts.length - 1; i += 3) {
    const tick: LiquidityTick = {
      index: decodeI256(parts[i]),
      liquidityChange: decodeU256(parts[i + 1]) as Liquidity,
      sign: decodeBool(parts[i + 2])
    }
    ticks.push(tick)
  }
  return ticks
}

export function filterTicks(ticks: TickVariant[], tickIndex: bigint, xToY: boolean): TickVariant[] {
  const filteredTicks = new Array(...ticks)
  let tickCount = 0

  for (const [index, tick] of filteredTicks.entries()) {
    if (tickCount >= MAX_SWAP_STEPS) {
      break
    }

    if (xToY) {
      if (tick.index > tickIndex) {
        filteredTicks.splice(index, 1)
      }
    } else {
      if (tick.index < tickIndex) {
        filteredTicks.splice(index, 1)
      }
    }
    tickCount++
  }

  return ticks
}

export function filterTickmap(
  tickmap: Tickmap,
  tickSpacing: bigint,
  index: bigint,
  xToY: boolean
): Tickmap {
  const filteredTickmap = new Map(tickmap)
  const [currentChunkIndex] = tickToPosition(index, tickSpacing)
  let tickCount = 0
  for (const [chunkIndex] of filteredTickmap) {
    if (tickCount >= MAX_SWAP_STEPS) {
      break
    }

    if (xToY) {
      if (chunkIndex > currentChunkIndex) {
        filteredTickmap.delete(chunkIndex)
      }
    } else {
      if (chunkIndex < currentChunkIndex) {
        filteredTickmap.delete(chunkIndex)
      }
    }
    tickCount++
  }

  return filteredTickmap
}
