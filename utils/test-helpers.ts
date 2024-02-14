import { NodeProvider, SignerProvider, node, web3 } from '@alephium/web3'
import { FeeTier, Invariant } from '../artifacts/ts'

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
  const account = await signer.getSelectedAccount()

  return await waitTxConfirmed(
    Invariant.deploy(signer, {
      initialFields: {
        admin: account.address,
        protocolFee,
        feeTierTemplateContractId: feeTier.contractInstance.contractId,
        feeTierCount: 0n
      }
    })
  )
}

export async function deployFeeTier(signer: SignerProvider) {
  const account = await signer.getSelectedAccount()

  return await waitTxConfirmed(
    FeeTier.deploy(signer, {
      initialFields: {
        admin: account.address,
        fee: 0n,
        tickSpacing: 0n,
        isActive: false
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
