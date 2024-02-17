import { NodeProvider, SignerProvider, ZERO_ADDRESS, node, web3 } from '@alephium/web3'
import { FeeTier, FeeTiers, Invariant, Pool, PoolKey, PoolKeys, Pools, Ticks } from '../artifacts/ts'
import { Tick } from '../artifacts/ts/Tick'

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
  const feeTier = await deployFeeTier(signer)
  const feeTiers = await deployFeeTiers(signer)
  const poolKey = await deployPoolKey(signer)
  const poolKeys = await deployPoolKeys(signer)
  const pools = await deployPools(signer)
  const pool = await deployPool(signer)
  const tick = await deployTick(signer)
  const ticks = await deployTicks(signer)
  const account = await signer.getSelectedAccount()

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
        tickTemplateContractId: tick.contractInstance.contractId
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

export async function deployTicks(signer: SignerProvider) {
  return await waitTxConfirmed(
    Ticks.deploy(signer, {
      initialFields: {
        admin: ZERO_ADDRESS,
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
        admin: ZERO_ADDRESS,
        poolLiquidity: 0n,
        poolCurrentSqrtPrice: 0n,
        poolCurrentTickIndex: 0n,
        feeGrowthGlobalX: 0n,
        feeGrowthGlobalY: 0n,
        feeProtocolTokenX: 0n,
        feeProtocolTokenY: 0n,
        startTimestamp: 0n,
        lastTimestamp: 0n,
        feeReceiver: ZERO_ADDRESS
      }
    })
  )
}

export async function deployPools(signer: SignerProvider) {
  return await waitTxConfirmed(
    Pools.deploy(signer, {
      initialFields: {
        admin: ZERO_ADDRESS,
        poolTemplateContractId: ZERO_ADDRESS
      }
    })
  )
}

export async function deployTick(signer: SignerProvider) {
  return await waitTxConfirmed(
    Tick.deploy(signer, {
      initialFields: {
        admin: ZERO_ADDRESS,
        idx: 0n,
        tickSign: false,
        liquidityChange: 0n,
        liquidityGross: 0n,
        tickSqrtPrice: 0n,
        tickFeeGrowthOutsideX: 0n,
        tickFeeGrowthOutsideY: 0n,
        tickSecondsOutside: 0n,
        isInitialized: false
      }
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
