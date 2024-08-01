import {
  addressFromContractId,
  DUST_AMOUNT,
  hexToString,
  NodeProvider,
  SignerProvider,
  TransactionBuilder
} from '@alephium/web3'
import { Network } from './network'
import { TokenFaucet, Withdraw } from '../artifacts/ts'
import { balanceOf, getNodeUrl, signAndSend, waitTxConfirmed } from './utils'
import { MAX_U256 } from './consts'

export type TokenMetaData = {
  symbol: string
  name: string
  decimals: bigint
  totalSupply: bigint
}

export class FungibleToken {
  network: Network
  nodeProvider: NodeProvider
  builder: TransactionBuilder

  private constructor(network: Network) {
    this.network = network
    const nodeUrl = getNodeUrl(network)
    this.nodeProvider = new NodeProvider(nodeUrl)
    this.builder = TransactionBuilder.from(nodeUrl)
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
          supply: MAX_U256,
          balance: MAX_U256
        },
        issueTokenAmount: MAX_U256
      })
    )

    await Withdraw.execute(signer, {
      initialFields: {
        token: deployResult.contractInstance.contractId,
        amount: supply
      },
      attoAlphAmount: DUST_AMOUNT
    })

    return deployResult.contractInstance.contractId
  }

  static async load(network: Network): Promise<FungibleToken> {
    return new FungibleToken(network)
  }

  async mintTx(signer: SignerProvider, value: bigint, tokenId: string) {
    const tokenAddress = addressFromContractId(tokenId)
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

  async mint(signer: SignerProvider, value: bigint, tokenId: string) {
    const tx = await this.mintTx(signer, value, tokenId)
    return await signAndSend(signer, tx)
  }

  async getAllBalances(tokens: string[], owner: string): Promise<Map<string, bigint>> {
    const balances = await Promise.all(tokens.map(token => this.getBalanceOf(owner, token)))

    return new Map(tokens.map((token, i) => [token, balances[i]]))
  }

  async getBalanceOf(owner: string, tokenId: string): Promise<bigint> {
    return balanceOf(tokenId, owner)
  }

  async getTokenMetaDataMulti(tokenId: Array<string>): Promise<Map<string, TokenMetaData>> {
    const metadata = await Promise.all(tokenId.map((tokenId, _) => this.getTokenMetadata(tokenId)))

    return new Map(tokenId.map((tokenId, i) => [tokenId, metadata[i]]))
  }

  async getTokenMetadata(tokenId: string): Promise<TokenMetaData> {
    const metadata = await this.nodeProvider.fetchFungibleTokenMetaData(tokenId)
    return {
      symbol: hexToString(metadata.symbol),
      name: hexToString(metadata.name),
      decimals: BigInt(metadata.decimals),
      totalSupply: BigInt(metadata.totalSupply)
    }
  }

  async getTokenName(tokenId: string): Promise<string> {
    return hexToString((await this.nodeProvider.fetchFungibleTokenMetaData(tokenId)).name)
  }

  async getTokenSymbol(tokenId: string): Promise<string> {
    return hexToString((await this.nodeProvider.fetchFungibleTokenMetaData(tokenId)).symbol)
  }

  async getTokenDecimals(tokenId: string): Promise<bigint> {
    return BigInt((await this.nodeProvider.fetchFungibleTokenMetaData(tokenId)).decimals)
  }
}
