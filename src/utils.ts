import { NodeProvider, SignerProvider, ZERO_ADDRESS, node, web3 } from '@alephium/web3'
import {
  CLAMM,
  Chunk,
  FeeTier,
  FeeTiers,
  Invariant,
  Pool,
  PoolKey,
  PoolKeys,
  Pools,
  Position,
  PositionsCounter,
  Tickmap,
  Ticks
} from '../artifacts/ts'
import { Positions } from '../artifacts/ts/Positions'
import { Tick } from '../artifacts/ts/Tick'
import { compactUnsignedIntCodec } from './compact-int-codec'

function isConfirmed(txStatus: node.TxStatus): txStatus is node.Confirmed {
  return txStatus.type === 'Confirmed'
}

async function _waitTxConfirmed(provider: NodeProvider, txId: string, confirmations: number): Promise<node.Confirmed> {
  const status = await provider.transactions.getTransactionsStatus({
    txId: txId
  })
  if (isConfirmed(status) && status.chainConfirmations >= confirmations) {
    return status
  }
  await new Promise((r) => setTimeout(r, 1000))
  return _waitTxConfirmed(provider, txId, confirmations)
}

export async function waitTxConfirmed<T extends { txId: string }>(promise: Promise<T>): Promise<T> {
  const result = await promise
  await _waitTxConfirmed(web3.getCurrentNodeProvider(), result.txId, 1)
  return result
}

export async function deployInvariant(signer: SignerProvider, protocolFee: bigint) {
  const account = await signer.getSelectedAccount()

  const feeTier = await deployFeeTier(signer)
  const feeTiers = await deployFeeTiers(signer)
  const poolKey = await deployPoolKey(signer)
  const poolKeys = await deployPoolKeys(signer)
  const pools = await deployPools(signer)
  const pool = await deployPool(signer)
  const tick = await deployTick(signer)
  const ticks = await deployTicks(signer)
  const position = await deployPosition(signer)
  const positions = await deployPositions(signer)
  const positionsCounter = await deployPositionsCounter(signer)
  const chunk = await deployChunk(signer)
  const tickmap = await deployTickmap(signer, account.address, chunk.contractInstance.contractId)
  const clamm = await deployCLAMM(signer)

  return await waitTxConfirmed(
    Invariant.deploy(signer, {
      initialFields: {
        init: false,
        admin: account.address,
        protocolFee,
        feeTiersContractId: ZERO_ADDRESS,
        feeTiersTemplateContractId: feeTiers.contractInstance.contractId,
        feeTierTemplateContractId: feeTier.contractInstance.contractId,
        poolKeysContractId: ZERO_ADDRESS,
        poolKeysTemplateContractId: poolKeys.contractInstance.contractId,
        poolKeyTemplateContractId: poolKey.contractInstance.contractId,
        poolsContractId: ZERO_ADDRESS,
        poolsTemplateContractId: pools.contractInstance.contractId,
        poolTemplateContractId: pool.contractInstance.contractId,
        ticksContractId: ZERO_ADDRESS,
        ticksTemplateContractId: ticks.contractInstance.contractId,
        tickTemplateContractId: tick.contractInstance.contractId,
        positionsContractId: ZERO_ADDRESS,
        positionsTemplateContractId: positions.contractInstance.contractId,
        positionTemplateContractId: position.contractInstance.contractId,
        positionsCounterTemplateContractId: positionsCounter.contractInstance.contractId,
        tickmapContractId: ZERO_ADDRESS,
        tickmapTemplateContractId: tickmap.contractInstance.contractId,
        chunkTemplateContractId: chunk.contractInstance.contractId,
        clammContractId: clamm.contractInstance.contractId
      }
    })
  )
}

export async function deployFeeTier(signer: SignerProvider) {
  return await waitTxConfirmed(
    FeeTier.deploy(signer, {
      initialFields: {
        admin: ZERO_ADDRESS,
        fee: 0n,
        tickSpacing: 0n,
        isActive: false
      }
    })
  )
}

export async function deployFeeTiers(signer: SignerProvider) {
  return await waitTxConfirmed(
    FeeTiers.deploy(signer, {
      initialFields: {
        admin: ZERO_ADDRESS,
        feeTierTemplateContractId: ZERO_ADDRESS,
        feeTierCount: 0n
      }
    })
  )
}

export async function deployPositions(signer: SignerProvider) {
  return await waitTxConfirmed(
    Positions.deploy(signer, {
      initialFields: {
        positionTemplateContractId: ZERO_ADDRESS,
        positionsCounterTemplateId: ZERO_ADDRESS
      }
    })
  )
}

export async function deployPosition(signer: SignerProvider) {
  return await waitTxConfirmed(
    Position.deploy(signer, {
      initialFields: {
        posLiquidity: 0n,
        posLowerTickIndex: 0n,
        posUpperTickIndex: 0n,
        posFeeGrowthInsideX: 0n,
        posFeeGrowthInsideY: 0n,
        posLastBlockNumber: 0n,
        posTokensOwedX: 0n,
        posTokensOwedY: 0n
      }
    })
  )
}

export async function deployTicks(signer: SignerProvider) {
  return await waitTxConfirmed(
    Ticks.deploy(signer, {
      initialFields: {
        tickTemplateContractId: ZERO_ADDRESS
      }
    })
  )
}

export async function deployPoolKey(signer: SignerProvider) {
  return await waitTxConfirmed(
    PoolKey.deploy(signer, {
      initialFields: {
        token0: ZERO_ADDRESS,
        token1: ZERO_ADDRESS,
        fee: 0n,
        tickSpacing: 0n
      }
    })
  )
}

export async function deployPoolKeys(signer: SignerProvider) {
  return await waitTxConfirmed(
    PoolKeys.deploy(signer, {
      initialFields: {
        admin: ZERO_ADDRESS,
        poolKeyTemplateContractId: ZERO_ADDRESS,
        poolKeyCount: 0n
      }
    })
  )
}

export async function deployPool(signer: SignerProvider) {
  return await waitTxConfirmed(
    Pool.deploy(signer, {
      initialFields: {
        poolLiquidity: 0n,
        poolCurrentSqrtPrice: 0n,
        poolCurrentTickIndex: 0n,
        poolFeeGrowthGlobalX: 0n,
        poolFeeGrowthGlobalY: 0n,
        poolFeeProtocolTokenX: 0n,
        poolFeeProtocolTokenY: 0n,
        poolStartTimestamp: 0n,
        poolLastTimestamp: 0n,
        poolFeeReceiver: ZERO_ADDRESS,
        clammContractId: ZERO_ADDRESS
      }
    })
  )
}

export async function deployPools(signer: SignerProvider) {
  return await waitTxConfirmed(
    Pools.deploy(signer, {
      initialFields: {
        poolTemplateContractId: ZERO_ADDRESS,
        clammContractId: ZERO_ADDRESS
      }
    })
  )
}

export async function deployTick(signer: SignerProvider) {
  return await waitTxConfirmed(
    Tick.deploy(signer, {
      initialFields: {
        tickSign: false,
        tickLiquidityChange: 0n,
        tickLiquidityGross: 0n,
        tickSqrtPrice: 0n,
        tickFeeGrowthOutsideX: 0n,
        tickFeeGrowthOutsideY: 0n,
        tickSecondsOutside: 0n
      }
    })
  )
}

export async function deployChunk(signer: SignerProvider) {
  return await waitTxConfirmed(
    Chunk.deploy(signer, {
      initialFields: {
        value: 0n
      }
    })
  )
}

export async function deployTickmap(
  signer: SignerProvider,
  admin?: string,
  chunkTemplateContractId?: string,
  clammContractId?: string
) {
  return await waitTxConfirmed(
    Tickmap.deploy(signer, {
      initialFields: {
        admin: admin ?? ZERO_ADDRESS,
        chunkTemplateContractId: chunkTemplateContractId ?? ZERO_ADDRESS,
        clammContractId: clammContractId ?? ZERO_ADDRESS
      }
    })
  )
}

export async function deployPositionsCounter(signer: SignerProvider) {
  return await waitTxConfirmed(
    PositionsCounter.deploy(signer, {
      initialFields: {
        value: 0n
      }
    })
  )
}

export async function deployCLAMM(signer: SignerProvider) {
  return await waitTxConfirmed(
    CLAMM.deploy(signer, {
      initialFields: {}
    })
  )
}

export async function expectError(script: Promise<any>) {
  let isError = false

  try {
    await script
  } catch (e) {
    isError = true
  }

  expect(isError).toBe(true)
}

export async function balanceOf(tokenId: string, address: string): Promise<bigint> {
  const balances = await web3.getCurrentNodeProvider().addresses.getAddressesAddressBalance(address)
  const balance = balances.tokenBalances?.find((t) => t.id === tokenId)
  return balance === undefined ? 0n : BigInt(balance.amount)
}

export function decodeFeeTiers(string: string) {
  const parts = string.split('627265616b')
  const feeTiers: any[] = []

  for (let i = 0; i < parts.length - 1; i += 3) {
    const feeTier = {
      fee: decodeU256(parts[i]),
      tickSpacing: decodeU256(parts[i + 1])
    }

    feeTiers.push(feeTier)
  }

  return feeTiers
}

export function decodePools(string: string) {
  const parts = string.split('627265616b')
  const pools: any[] = []

  for (let i = 0; i < parts.length - 1; i += 4) {
    const pool = {
      token0: parts[i],
      token1: parts[i + 1],
      fee: decodeU256(parts[i + 2]),
      tickSpacing: decodeU256(parts[i + 3])
    }

    pools.push(pool)
  }

  return pools
}

export function decodePool(
  array: [boolean, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, string]
) {
  return {
    exist: array[0],
    liquidity: array[1],
    currentSqrtPrice: array[2],
    currentTickIndex: array[3],
    feeGrowthGlobalX: array[4],
    feeGrowthGlobalY: array[5],
    feeProtocolTokenX: array[6],
    feeProtocolTokenY: array[7],
    startTimestamp: array[8],
    lastTimestamp: array[9],
    feeReceiver: array[10]
  }
}

export const decodeTick = (array: [boolean, boolean, bigint, bigint, bigint, bigint, bigint, bigint]) => {
  return {
    exist: array[0],
    sign: array[1],
    liquidityChange: array[2],
    liquidityGross: array[3],
    sqrtPrice: array[4],
    feeGrowthOutsideX: array[5],
    feeGrowthOutsideY: array[6],
    secondsOutside: array[7]
  }
}

export const decodePosition = (array: [boolean, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint]) => {
  return {
    exist: array[0],
    liquidity: array[1],
    lowerTickIndex: array[2],
    upperTickIndex: array[3],
    feeGrowthInsideX: array[4],
    feeGrowthInsideY: array[5],
    lastBlockNumber: array[6],
    tokensOwedX: array[7],
    tokensOwedY: array[8]
  }
}

export const hexToBytes = (hex: string): Uint8Array => {
  return new Uint8Array(hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || [])
}

export const decodeU256 = (string: string) => {
  return BigInt(compactUnsignedIntCodec.decodeU256(new Buffer(hexToBytes(string))))
}
