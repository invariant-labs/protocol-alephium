import { DUST_AMOUNT, hexToString, SignerProvider, TransactionBuilder } from '@alephium/web3'
import { Network } from './network'
import { TokenFaucet, Withdraw } from '../artifacts/ts'
import { balanceOf, getNodeUrl, signAndSend, waitTxConfirmed } from './utils'
import { MaxU256 } from './consts'

export type TokenMetadata = {
  name: string
  symbol: string
  decimals: bigint
}

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
          supply: MaxU256,
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
    const tx = await this.mintTx(signer, value, tokenAddress)
    return await signAndSend(signer, tx)
  }

  async getAllBalances(tokens: string[], owner: string): Promise<Map<string, bigint>> {
    const balances = await Promise.all(tokens.map(token => this.getBalanceOf(owner, token)))

    return new Map(tokens.map((token, i) => [token, balances[i]]))
  }

  async getBalanceOf(owner: string, tokenAddress: string): Promise<bigint> {
    const tokenId = this.getContractId(tokenAddress)
    return balanceOf(tokenId, owner)
  }

  async getTokenMetadataMulti(tokenAddresses: Array<string>): Promise<Map<string, TokenMetadata>> {
    const metadata = await Promise.all(
      tokenAddresses.map((tokenAddress, _) => this.getTokenMetadata(tokenAddress))
    )

    return new Map(tokenAddresses.map((tokenAddress, i) => [tokenAddress, metadata[i]]))
  }

  async getTokenMetadata(tokenAddress: string): Promise<TokenMetadata> {
    const token = TokenFaucet.at(tokenAddress)
    const result = await token.multicall({ getSymbol: {}, getName: {}, getDecimals: {} })
    return {
      name: hexToString(result.getName.returns),
      symbol: hexToString(result.getSymbol.returns),
      decimals: result.getDecimals.returns
    }
  }

  async getTokenName(tokenAddress: string): Promise<string> {
    const token = TokenFaucet.at(tokenAddress)
    return hexToString((await token.view.getName()).returns)
  }

  async getTokenSymbol(tokenAddress: string): Promise<string> {
    const token = TokenFaucet.at(tokenAddress)
    return hexToString((await token.view.getSymbol()).returns)
  }

  async getTokenDecimals(tokenAddress: string): Promise<bigint> {
    const token = TokenFaucet.at(tokenAddress)
    return (await token.view.getDecimals()).returns
  }

  getContractId(tokenAddress: string): string {
    return TokenFaucet.at(tokenAddress).contractId
  }
}
