import { NodeProvider, SignerProvider, ZERO_ADDRESS, node, web3 } from '@alephium/web3'
import {
  CLAMM,
  FeeTier,
  FeeTiers,
  Init,
  Invariant,
  Pool,
  PoolKey,
  PoolKeys,
  Pools,
  Position,
  PositionsCounter,
  SwapUtils,
  Tickmap,
  TickmapChunk,
  Ticks
} from '../artifacts/ts'
import { Positions } from '../artifacts/ts/Positions'
import { Tick } from '../artifacts/ts/Tick'
import { TokenFaucet } from '../artifacts/ts/TokenFaucet'
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

  const clamm = await deployCLAMM(signer)
  const feeTier = await deployFeeTier(signer)
  const feeTiers = await deployFeeTiers(signer, feeTier.contractInstance.contractId)
  const poolKey = await deployPoolKey(signer)
  const poolKeys = await deployPoolKeys(signer, poolKey.contractInstance.contractId)
  const pool = await deployPool(signer, clamm.contractInstance.contractId)
  const pools = await deployPools(signer, pool.contractInstance.contractId, clamm.contractInstance.contractId)
  const tick = await deployTick(signer)
  const ticks = await deployTicks(signer, tick.contractInstance.contractId)
  const position = await deployPosition(signer)
  const positionsCounter = await deployPositionsCounter(signer)
  const positions = await deployPositions(
    signer,
    position.contractInstance.contractId,
    positionsCounter.contractInstance.contractId
  )
  const chunk = await deployChunk(signer)
  const tickmap = await deployTickmap(signer, chunk.contractInstance.contractId)

  const swap = await deploySwap(
    signer,
    clamm.contractInstance.contractId,
    pools.contractInstance.contractId,
    ticks.contractInstance.contractId,
    tickmap.contractInstance.contractId,
    protocolFee
  )

  const deployResult = await waitTxConfirmed(
    Invariant.deploy(signer, {
      initialFields: {
        init: false,
        config: { admin: account.address, protocolFee },
        feeTiers: feeTiers.contractInstance.contractId,
        poolKeys: poolKeys.contractInstance.contractId,
        pools: pools.contractInstance.contractId,
        ticks: ticks.contractInstance.contractId,
        positionsContractId: positions.contractInstance.contractId,
        tickmapContractId: tickmap.contractInstance.contractId,
        clammContractId: clamm.contractInstance.contractId,
        swapContractId: swap.contractInstance.contractId
      }
    })
  )

  const invariant = Invariant.at(deployResult.contractInstance.address)

  await Init.execute(signer, {
    initialFields: {
      invariant: invariant.contractId
    }
  })

  return invariant
}

export async function deploySwap(
  signer: SignerProvider,
  clammContractId: string,
  poolsContractId: string,
  ticksContractId: string,
  tickmapContractId: string,
  protocolFee: bigint
) {
  return await waitTxConfirmed(
    SwapUtils.deploy(signer, {
      initialFields: {
        clammContractId,
        poolsContractId,
        ticksContractId,
        tickmapContractId,
        protocolFee
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

export async function deployFeeTiers(signer: SignerProvider, feeTier: string) {
  return await waitTxConfirmed(
    FeeTiers.deploy(signer, {
      initialFields: {
        feeTierTemplateContractId: feeTier,
        feeTierCount: 0n,
        invariantId: ZERO_ADDRESS,
        areAdminsSet: false
      }
    })
  )
}

export async function deployPositions(signer: SignerProvider, positionId: string, positionsCounterContractId: string) {
  return await waitTxConfirmed(
    Positions.deploy(signer, {
      initialFields: {
        positionTemplateContractId: positionId,
        positionsCounterContractId,
        invariantId: ZERO_ADDRESS,
        areAdminsSet: false
      }
    })
  )
}

export async function deployPosition(signer: SignerProvider) {
  return await waitTxConfirmed(
    Position.deploy(signer, {
      initialFields: {
        admin: ZERO_ADDRESS,
        posPoolKey: '',
        posLiquidity: 0n,
        posLowerTickIndex: 0n,
        posUpperTickIndex: 0n,
        posFeeGrowthInsideX: 0n,
        posFeeGrowthInsideY: 0n,
        posLastBlockNumber: 0n,
        posTokensOwedX: 0n,
        posTokensOwedY: 0n,
        posOwner: ZERO_ADDRESS,
        posIsActive: false
      }
    })
  )
}

export async function deployTicks(signer: SignerProvider, tickId: string) {
  return await waitTxConfirmed(
    Ticks.deploy(signer, {
      initialFields: {
        tickTemplateContractId: tickId,
        invariantId: ZERO_ADDRESS,
        swapUtilsId: ZERO_ADDRESS,
        positionsId: ZERO_ADDRESS,
        areAdminsSet: false
      }
    })
  )
}

export async function deployPoolKey(signer: SignerProvider) {
  return await waitTxConfirmed(
    PoolKey.deploy(signer, {
      initialFields: {
        tokenX: ZERO_ADDRESS,
        tokenY: ZERO_ADDRESS,
        fee: 0n,
        tickSpacing: 0n
      }
    })
  )
}

export async function deployPoolKeys(signer: SignerProvider, poolKeyId: string) {
  return await waitTxConfirmed(
    PoolKeys.deploy(signer, {
      initialFields: {
        poolKeyTemplateContractId: poolKeyId,
        poolKeyCount: 0n,
        invariantId: ZERO_ADDRESS,
        areAdminsSet: false
      }
    })
  )
}

export async function deployPool(signer: SignerProvider, clammId: string) {
  return await waitTxConfirmed(
    Pool.deploy(signer, {
      initialFields: {
        admin: ZERO_ADDRESS,
        poolTickSpacing: 0n,
        poolTokenX: '',
        poolTokenY: '',
        poolLiquidity: 0n,
        poolSqrtPrice: 0n,
        poolCurrentTickIndex: 0n,
        poolFeeGrowthGlobalX: 0n,
        poolFeeGrowthGlobalY: 0n,
        poolFeeProtocolTokenX: 0n,
        poolFeeProtocolTokenY: 0n,
        poolStartTimestamp: 0n,
        poolLastTimestamp: 0n,
        poolFeeReceiver: ZERO_ADDRESS,
        clammContractId: clammId
      }
    })
  )
}

export async function deployPools(signer: SignerProvider, poolId: string, clammId: string) {
  return await waitTxConfirmed(
    Pools.deploy(signer, {
      initialFields: {
        poolTemplateContractId: poolId,
        clammContractId: clammId,
        areAdminsSet: false,
        invariantId: ZERO_ADDRESS,
        positionsId: ZERO_ADDRESS,
        swapUtilsId: ZERO_ADDRESS
      }
    })
  )
}

export async function deployTick(signer: SignerProvider) {
  return await waitTxConfirmed(
    Tick.deploy(signer, {
      initialFields: {
        admin: ZERO_ADDRESS,
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
    TickmapChunk.deploy(signer, {
      initialFields: {
        value: 0n,
        admin: ZERO_ADDRESS
      }
    })
  )
}

export async function deployTickmap(signer: SignerProvider, chunkTemplateContractId: string) {
  return await waitTxConfirmed(
    Tickmap.deploy(signer, {
      initialFields: {
        chunkTemplateContractId: chunkTemplateContractId,
        invariantId: ZERO_ADDRESS,
        swapUtilsId: ZERO_ADDRESS,
        areAdminsSet: false
      }
    })
  )
}

export async function deployPositionsCounter(signer: SignerProvider) {
  return await waitTxConfirmed(
    PositionsCounter.deploy(signer, {
      initialFields: {
        value: 0n,
        positionsId: ZERO_ADDRESS,
        areAdminsSet: false
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

export async function deployTokenFaucet(
  signer: SignerProvider,
  name: string,
  symbol: string,
  decimals: bigint,
  supply: bigint
) {
  return await waitTxConfirmed(
    TokenFaucet.deploy(signer, {
      initialFields: {
        name: Buffer.from(name, 'utf8').toString('hex'),
        symbol: Buffer.from(symbol, 'utf8').toString('hex'),
        decimals,
        supply,
        balance: supply
      },
      issueTokenAmount: supply
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

  for (let i = 0; i < parts.length - 1; i += 2) {
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
      tokenX: parts[i],
      tokenY: parts[i + 1],
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
    sqrtPrice: array[2],
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

export function decodeTick(array: [boolean, boolean, bigint, bigint, bigint, bigint, bigint, bigint]) {
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

export function decodePosition(
  array: [boolean, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, string]
) {
  return {
    exist: array[0],
    liquidity: array[1],
    lowerTickIndex: array[2],
    upperTickIndex: array[3],
    feeGrowthInsideX: array[4],
    feeGrowthInsideY: array[5],
    lastBlockNumber: array[6],
    tokensOwedX: array[7],
    tokensOwedY: array[8],
    owner: array[9]
  }
}

export function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || [])
}

export function decodeU256(string: string): bigint {
  return BigInt(compactUnsignedIntCodec.decodeU256(Buffer.from(hexToBytes(string))))
}
