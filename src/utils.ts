import { NodeProvider, ONE_ALPH, SignerProvider, ZERO_ADDRESS, node, web3 } from '@alephium/web3'
import { CLAMM, Init, Invariant, Pools, Position, PositionsCounter, Tickmap, Ticks, Uints } from '../artifacts/ts'
import { TokenFaucet } from '../artifacts/ts/TokenFaucet'
import { Pool, PositionState, Tick } from '../artifacts/ts/types'
import { compactUnsignedIntCodec } from './compact-int-codec'

export const MAP_ENTRY_DEPOSIT = ONE_ALPH / 10n

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

  const uints = await deployUints(signer)
  const clamm = await deployCLAMM(signer, uints.contractInstance.contractId)
  const pools = await deployPools(signer, clamm.contractInstance.contractId, uints.contractInstance.contractId)
  const ticks = await deployTicks(signer)
  const position = await deployPosition(signer, clamm.contractInstance.contractId, uints.contractInstance.contractId)
  const positionsCounter = await deployPositionsCounter(signer)
  const tickmap = await deployTickmap(signer)

  const deployResult = await waitTxConfirmed(
    Invariant.deploy(signer, {
      initialFields: {
        init: false,
        config: { admin: account.address, protocolFee },
        pools: pools.contractInstance.contractId,
        ticks: ticks.contractInstance.contractId,
        positionTemplateContractId: position.contractInstance.contractId,
        positionsCounterContractId: positionsCounter.contractInstance.contractId,
        tickmap: tickmap.contractInstance.contractId,
        clamm: clamm.contractInstance.contractId,
        feeTierCount: 0n,
        poolKeyCount: 0n
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

export async function deployPosition(signer: SignerProvider, clammId: string, uintsId: string) {
  return await waitTxConfirmed(
    Position.deploy(signer, {
      initialFields: {
        admin: ZERO_ADDRESS,
        position: {
          poolKey: '',
          liquidity: 0n,
          lowerTickIndex: 0n,
          upperTickIndex: 0n,
          feeGrowthInsideX: 0n,
          feeGrowthInsideY: 0n,
          lastBlockNumber: 0n,
          tokensOwedX: 0n,
          tokensOwedY: 0n,
          owner: ZERO_ADDRESS
        },
        isActive: false,
        clammContractInstance: clammId
      }
    })
  )
}

export async function deployTicks(signer: SignerProvider) {
  return await waitTxConfirmed(
    Ticks.deploy(signer, {
      initialFields: {
        invariantId: ZERO_ADDRESS,
        areAdminsSet: false
      }
    })
  )
}

export async function deployPools(signer: SignerProvider, clammId: string, uintsId: string) {
  return await waitTxConfirmed(
    Pools.deploy(signer, {
      initialFields: {
        clamm: clammId,
        areAdminsSet: false,
        invariantId: ZERO_ADDRESS
      }
    })
  )
}

export async function deployTickmap(signer: SignerProvider) {
  return await waitTxConfirmed(
    Tickmap.deploy(signer, {
      initialFields: {
        invariantId: ZERO_ADDRESS,
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

export async function deployCLAMM(signer: SignerProvider, uintsId: string) {
  return await waitTxConfirmed(
    CLAMM.deploy(signer, {
      initialFields: {
        uints: uintsId
      }
    })
  )
}

export async function deployUints(signer: SignerProvider) {
  return await waitTxConfirmed(Uints.deploy(signer, { initialFields: {} }))
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

export function decodePool(array: [boolean, Pool]) {
  return {
    exist: array[0],
    ...array[1]
  }
}

export function decodeTick(array: [boolean, Tick]) {
  return {
    exist: array[0],
    ...array[1]
  }
}

export function decodePosition(array: [boolean, PositionState]) {
  return {
    exist: array[0],
    ...array[1]
  }
}

export function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || [])
}

export function decodeU256(string: string): bigint {
  return BigInt(compactUnsignedIntCodec.decodeU256(Buffer.from(hexToBytes(string))))
}

export const ArithmeticError = {
  CastOverflow: 100001n,
  AddOverflow: 100002n,
  SubOverflow: 100003n,
  MulOverflow: 100004n,
  DivNotPositiveDivisor: 100005n,
  DivNotPositiveDenominator: 100006n,
  MulNotPositiveDenominator: 100007n
}

export const MaxU256 = 115792089237316195423570985008687907853269984665640564039457584007913129639935n
export const MaxTick = 221818n
