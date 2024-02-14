import { NodeProvider, SignerProvider, node, web3 } from '@alephium/web3'
import { CLAMM, TokenFaucet } from '../artifacts/ts'

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

export async function deployCLAMM(signer: SignerProvider, sender: string, recipient: string, tokenId: string) {
  return await waitTxConfirmed(
    CLAMM.deploy(signer, {
      initialFields: {
        sender: sender,
        recipient: recipient,
        tokenId: tokenId,
        amount: 0n,
        status: 0n
      }
    })
  )
}

export async function balanceOf(tokenId: string, address: string): Promise<bigint> {
  const balances = await web3.getCurrentNodeProvider().addresses.getAddressesAddressBalance(address)
  const balance = balances.tokenBalances?.find((t) => t.id === tokenId)
  return balance === undefined ? 0n : BigInt(balance.amount)
}
