import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { Network } from '../src/network'
import { FungibleToken } from '../src/fungible_token'
import { PrivateKeyWallet } from '@alephium/web3-wallet'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

const token = new FungibleToken(Network.Local)
let admin: PrivateKeyWallet
let token0Address: string

describe('fungible token tests', () => {
  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
    token0Address = await FungibleToken.deploy(admin, 1000n, 'Coin', 'COIN', 12n)
  })

  test('should set metadata', async () => {
    expect(await token.tokenName(token0Address)).toBe('Coin')
    expect(await token.tokenSymbol(token0Address)).toBe('COIN')
    expect(await token.tokenDecimals(token0Address)).toBe(12n)
  })

  test('should mint tokens', async () => {
    await token.mint(admin, 500n, token0Address)
    expect(await token.balanceOf(admin.address, token0Address)).toBe(1500n)
  })

  test('should change instance', async () => {
    const secondTokenAddress = await FungibleToken.deploy(admin, 1000n, 'SecondCoin', 'SCOIN', 12n)
    const tokenName = await token.tokenName(secondTokenAddress)
    expect(tokenName).toBe('SecondCoin')
  })

  test('should get all balances', async () => {
    const token0Address = await FungibleToken.deploy(admin, 0n, 'Coin', 'COIN', 12n)
    const token1Address = await FungibleToken.deploy(admin, 0n, 'Coin', 'COIN', 12n)
    const token2Address = await FungibleToken.deploy(admin, 0n, 'Coin', 'COIN', 12n)
    const token3Address = await FungibleToken.deploy(admin, 0n, 'Coin', 'COIN', 12n)

    await token.mint(admin, 100n, token0Address)
    await token.mint(admin, 200n, token1Address)
    await token.mint(admin, 300n, token2Address)
    await token.mint(admin, 400n, token3Address)

    const balances = await token.getAllBalances(
      [token0Address, token1Address, token2Address, token3Address],
      admin.address
    )

    expect(balances.size).toBe(4)
    expect(balances.get(token0Address)).toBe(100n)
    expect(balances.get(token1Address)).toBe(200n)
    expect(balances.get(token2Address)).toBe(300n)
    expect(balances.get(token3Address)).toBe(400n)
  })

  test('should get metadata for all tokens', async () => {
    const tokenAddresses = [
      await FungibleToken.deploy(admin, 0n, 'CoinONE', 'COIN1', 12n),
      await FungibleToken.deploy(admin, 0n, 'CoinTWO', 'COIN2', 13n),
      await FungibleToken.deploy(admin, 0n, 'CoinTHREE', 'COIN3', 14n),
      await FungibleToken.deploy(admin, 0n, 'CoinFOUR', 'COIN4', 15n)
    ]
    const metadata = await token.tokenMetadataMulti(tokenAddresses)

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
