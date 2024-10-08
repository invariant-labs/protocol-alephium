import {
  Address,
  addressFromContractId,
  DUST_AMOUNT,
  hexToString,
  SignerProvider,
  stringToHex,
  TransactionBuilder,
  waitForTxConfirmation,
  web3
} from '@alephium/web3'
import { Network } from './network'
import { Airdrop, TokenFaucet, Withdraw } from '../artifacts/ts'
import { balanceOf, signAndSend, waitTxConfirmed } from './utils'
import { CONFIRMATIONS, DEFAULT_OPTIONS, MAX_U256, REQUEST_INTERVAL } from './consts'
import { Options, TokenAmount } from './types'

export type TokenMetaData = {
  symbol: string
  name: string
  decimals: bigint
  totalSupply: TokenAmount
}

export class FungibleToken {
  private constructor() {}

  static async deploy(
    signer: SignerProvider,
    supply = 0n as TokenAmount,
    name: string = '',
    symbol: string = '',
    decimals: bigint = 0n
  ): Promise<string> {
    const deployResult = await waitTxConfirmed(
      TokenFaucet.deploy(signer, {
        initialFields: {
          name: stringToHex(name),
          symbol: stringToHex(symbol),
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

  static load(): FungibleToken {
    return new FungibleToken()
  }

  async mint(
    signer: SignerProvider,
    value: TokenAmount,
    tokenId: string,
    options: Options = DEFAULT_OPTIONS
  ) {
    const result = await Withdraw.execute(signer, {
      initialFields: { token: tokenId, amount: value },
      attoAlphAmount: DUST_AMOUNT
    })

    if (options.waitForTxConfirmation) {
      await waitForTxConfirmation(result.txId, CONFIRMATIONS, REQUEST_INTERVAL)
    }

    return result.txId
  }

  async getAllBalances(tokens: string[], owner: Address): Promise<Map<string, TokenAmount>> {
    const balances = await Promise.all(tokens.map(token => this.getBalanceOf(owner, token)))

    return new Map(tokens.map((token, i) => [token, balances[i]]))
  }

  async getBalanceOf(owner: Address, tokenId: string): Promise<TokenAmount> {
    return await balanceOf(tokenId, owner)
  }

  async getTokenMetaDataMulti(tokenId: Array<string>): Promise<Map<string, TokenMetaData>> {
    const metadata = await Promise.all(tokenId.map((tokenId, _) => this.getTokenMetadata(tokenId)))

    return new Map(tokenId.map((tokenId, i) => [tokenId, metadata[i]]))
  }

  async getTokenMetadata(tokenId: string): Promise<TokenMetaData> {
    const nodeProvider = web3.getCurrentNodeProvider()
    const metadata = await nodeProvider.fetchFungibleTokenMetaData(tokenId)
    return {
      symbol: hexToString(metadata.symbol),
      name: hexToString(metadata.name),
      decimals: BigInt(metadata.decimals),
      totalSupply: BigInt(metadata.totalSupply) as TokenAmount
    }
  }

  async getTokenName(tokenId: string): Promise<string> {
    const nodeProvider = web3.getCurrentNodeProvider()
    return hexToString((await nodeProvider.fetchFungibleTokenMetaData(tokenId)).name)
  }

  async getTokenSymbol(tokenId: string): Promise<string> {
    const nodeProvider = web3.getCurrentNodeProvider()
    return hexToString((await nodeProvider.fetchFungibleTokenMetaData(tokenId)).symbol)
  }

  async getTokenDecimals(tokenId: string): Promise<bigint> {
    const nodeProvider = web3.getCurrentNodeProvider()
    return BigInt((await nodeProvider.fetchFungibleTokenMetaData(tokenId)).decimals)
  }

  async airdrop(
    signer: SignerProvider,
    valueOne: TokenAmount,
    tokenOneId: string,
    valueTwo: TokenAmount,
    tokenTwoId: string,
    valueThree: TokenAmount,
    tokenThreeId: string,
    options: Options = DEFAULT_OPTIONS
  ) {
    const result = await Airdrop.execute(signer, {
      initialFields: {
        tokenOne: tokenOneId,
        amountOne: valueOne,
        tokenTwo: tokenTwoId,
        amountTwo: valueTwo,
        tokenThree: tokenThreeId,
        amountThree: valueThree
      },
      attoAlphAmount: DUST_AMOUNT * 3n
    })

    if (options.waitForTxConfirmation) {
      await waitForTxConfirmation(result.txId, CONFIRMATIONS, REQUEST_INTERVAL)
    }

    return result.txId
  }
}
