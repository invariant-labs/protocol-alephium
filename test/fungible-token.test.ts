import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { Network } from '../src/network'
import { FungibleToken } from '../src/fungible_token'
import { balanceOf } from '../src/utils'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { TokenFaucet } from '../artifacts/ts'

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
})
