import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { Network } from '../../../src/network'
import { FungibleToken } from '../../../src/fungible-token'
import { PrivateKeyWallet } from '@alephium/web3-wallet'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let token: FungibleToken
let admin: PrivateKeyWallet
let token0: string

describe('fungible token tests', () => {
  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
    token = await FungibleToken.load(Network.Local)
    token0 = await FungibleToken.deploy(admin, 1000n, 'Coin', 'COIN', 12n)
  })

  test('set metadata', async () => {
    expect(await token.getTokenName(token0)).toBe('Coin')
    expect(await token.getTokenSymbol(token0)).toBe('COIN')
    expect(await token.getTokenDecimals(token0)).toBe(12n)
  })

  test('mint tokens', async () => {
    await token.mint(admin, 500n, token0)
    expect(await token.getBalanceOf(admin.address, token0)).toBe(1500n)
  })

  test('change instance', async () => {
    const secondToken = await FungibleToken.deploy(admin, 1000n, 'SecondCoin', 'SCOIN', 12n)
    const tokenName = await token.getTokenName(secondToken)
    expect(tokenName).toBe('SecondCoin')
  })

  test('get all balances', async () => {
    const token0 = await FungibleToken.deploy(admin, 0n, 'Coin', 'COIN', 12n)
    const token1 = await FungibleToken.deploy(admin, 0n, 'Coin', 'COIN', 12n)
    const token2 = await FungibleToken.deploy(admin, 0n, 'Coin', 'COIN', 12n)
    const token3 = await FungibleToken.deploy(admin, 0n, 'Coin', 'COIN', 12n)

    await token.mint(admin, 100n, token0)
    await token.mint(admin, 200n, token1)
    await token.mint(admin, 300n, token2)
    await token.mint(admin, 400n, token3)

    const balances = await token.getAllBalances([token0, token1, token2, token3], admin.address)

    expect(balances.size).toBe(4)
    expect(balances.get(token0)).toBe(100n)
    expect(balances.get(token1)).toBe(200n)
    expect(balances.get(token2)).toBe(300n)
    expect(balances.get(token3)).toBe(400n)
  })

  test('get metadata for all tokens', async () => {
    const tokenAddresses = [
      await FungibleToken.deploy(admin, 0n, 'CoinONE', 'COIN1', 12n),
      await FungibleToken.deploy(admin, 0n, 'CoinTWO', 'COIN2', 13n),
      await FungibleToken.deploy(admin, 0n, 'CoinTHREE', 'COIN3', 14n),
      await FungibleToken.deploy(admin, 0n, 'CoinFOUR', 'COIN4', 15n)
    ]
    const metadata = await token.getTokenMetaDataMulti(tokenAddresses)

    expect(metadata.size).toBe(4)
    expect(metadata.get(tokenAddresses[0])).toMatchObject({
      name: 'CoinONE',
      symbol: 'COIN1',
      decimals: 12n
    })
    expect(metadata.get(tokenAddresses[1])).toMatchObject({
      name: 'CoinTWO',
      symbol: 'COIN2',
      decimals: 13n
    })
    expect(metadata.get(tokenAddresses[2])).toMatchObject({
      name: 'CoinTHREE',
      symbol: 'COIN3',
      decimals: 14n
    })
    expect(metadata.get(tokenAddresses[3])).toMatchObject({
      name: 'CoinFOUR',
      symbol: 'COIN4',
      decimals: 15n
    })
  })
})
