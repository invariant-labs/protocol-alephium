import { DUST_AMOUNT, SignerProvider, TransactionBuilder } from '@alephium/web3'
import { Network } from './network'
import { TokenFaucet, Withdraw } from '../artifacts/ts'
import { balanceOf, getNodeUrl, waitTxConfirmed } from './utils'
import { MaxU256 } from './consts'

export class FungibleToken {
  network: Network
  nodeUrl: string
  builder: TransactionBuilder

  constructor(network: Network) {
    this.network = network
    this.nodeUrl = getNodeUrl(network)
    this.builder = TransactionBuilder.from(this.nodeUrl)
  }

  static async deploy(
    signer: SignerProvider,
    supply: bigint = 0n,
    name: string = '',
    symbol: string = '',
    decimals: bigint = 0n
  ): Promise<string> {
    const deployResult = await waitTxConfirmed(
      TokenFaucet.deploy(signer, {
        initialFields: {
          name: Buffer.from(name, 'utf8').toString('hex'),
          symbol: Buffer.from(symbol, 'utf8').toString('hex'),
          decimals,
          supply,
          balance: MaxU256
        },
        issueTokenAmount: MaxU256
      })
    )

    await Withdraw.execute(signer, {
      initialFields: {
        token: deployResult.contractInstance.contractId,
        amount: supply
      },
      attoAlphAmount: DUST_AMOUNT
    })

    return deployResult.contractInstance.address
  }

  static async load(network: Network): Promise<FungibleToken> {
    return new FungibleToken(network)
  }

  async mintTx(signer: SignerProvider, value: bigint, tokenAddress: string) {
    const tokenFaucet = TokenFaucet.at(tokenAddress)
    const bytecode = Withdraw.script.buildByteCodeToDeploy({
      token: tokenFaucet.contractId,
      amount: value
    })

    const { address, publicKey } = await signer.getSelectedAccount()

    const unsignedTxBuild = await this.builder.buildExecuteScriptTx(
      { signerAddress: address, bytecode, attoAlphAmount: DUST_AMOUNT },
      publicKey
    )
    return unsignedTxBuild
  }

  async mint(signer: SignerProvider, value: bigint, tokenAddress: string) {
    const buildTxResult = await this.mintTx(signer, value, tokenAddress)
    const signerAddress = (await signer.getSelectedAccount()).address
    return await signer.signAndSubmitUnsignedTx({
      signerAddress: signerAddress,
      unsignedTx: buildTxResult.unsignedTx
    })
  }

  async getAllBalances(tokens: string[], owner: string): Promise<Map<string, bigint>> {
    const balances = await Promise.all(tokens.map(token => this.balanceOf(owner, token)))

    return new Map(tokens.map((token, i) => [token, balances[i]]))
  }

  async balanceOf(owner: string, tokenAddress: string): Promise<bigint> {
    const tokenId = TokenFaucet.at(tokenAddress).contractId
    return balanceOf(tokenId, owner)
  }

  async tokenName(tokenAddress: string): Promise<string> {
    const token = TokenFaucet.at(tokenAddress)
    return Buffer.from((await token.view.getName()).returns, 'hex').toString('utf8')
  }

  async tokenSymbol(tokenAddress: string): Promise<string> {
    const token = TokenFaucet.at(tokenAddress)
    return Buffer.from((await token.view.getSymbol()).returns, 'hex').toString('utf8')
  }

  async tokenDecimals(tokenAddress: string): Promise<bigint> {
    const token = TokenFaucet.at(tokenAddress)
    return (await token.view.getDecimals()).returns
  }
}
