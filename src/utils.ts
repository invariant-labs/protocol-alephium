import {
  NodeProvider,
  codec,
  ONE_ALPH,
  SignerProvider,
  ZERO_ADDRESS,
  node,
  web3
} from '@alephium/web3'
import { CLAMM, Invariant, InvariantInstance, Reserve, Utils } from '../artifacts/ts'
import { TokenFaucet } from '../artifacts/ts/TokenFaucet'
import { FeeTier, FeeTiers, Pool, PoolKey, Position, Tick } from '../artifacts/ts/types'
import { FeeTierSlots } from './consts'

export const MAP_ENTRY_DEPOSIT = ONE_ALPH / 10n

export const DEFAULT_FEE_TIERS: FeeTiers = {
  feeTiers: new Array(Number(FeeTierSlots)).fill({
    fee: 0n,
    tickSpacing: 0n
  })
} as FeeTiers

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

export async function deployInvariant(
  signer: SignerProvider,
  protocolFee: bigint
): Promise<InvariantInstance> {
  const account = await signer.getSelectedAccount()
  const clamm = await deployCLAMM(signer)
  const reserve = await deployReserve(signer)

  const deployResult = await waitTxConfirmed(
    Invariant.deploy(signer, {
      initialFields: {
        config: { admin: account.address, protocolFee },
        reserveTemplateId: reserve.contractId,
        feeTiers: DEFAULT_FEE_TIERS,
        lastReserveId: reserve.contractId,
        clamm: clamm.contractId,
        lastEmptyFeeTierSlot: 0n,
        poolKeyCount: 0n
      }
    })
  )
  return Invariant.at(deployResult.contractInstance.address)
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
export async function deployCLAMM(signer: SignerProvider) {
  const deployResult = await waitTxConfirmed(
    CLAMM.deploy(signer, {
      initialFields: {}
    })
  )
  return CLAMM.at(deployResult.contractInstance.address)
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

export async function balanceOf(tokenId: string, address: string): Promise<bigint> {
  const balances = await web3.getCurrentNodeProvider().addresses.getAddressesAddressBalance(address)
  const balance = balances.tokenBalances?.find(t => t.id === tokenId)
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

export function decodePool(array: [boolean, Pool]) {
  return createEntityProxy(array[1], array[0])
}

export function decodeTick(array: [boolean, Tick]) {
  return createEntityProxy(array[1], array[0])
}

export function decodePosition(array: [boolean, Position]) {
  return createEntityProxy(array[1], array[0])
}

function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || [])
}

export function decodeU256(string: string): bigint {
  return codec.compactUnsignedIntCodec.decodeU256(hexToBytes(string))
}

export const newPoolKey = async (
  token0: string,
  token1: string,
  feeTier: FeeTier
): Promise<PoolKey> => {
  return (
    await Utils.tests.newPoolKey({
      testArgs: {
        token0,
        token1,
        feeTier
      }
    })
  ).returns
}

export const newFeeTier = async (fee: bigint, tickSpacing: bigint): Promise<FeeTier> => {
  return (
    await Utils.tests.newFeeTier({
      testArgs: {
        fee,
        tickSpacing
      }
    })
  ).returns
}
