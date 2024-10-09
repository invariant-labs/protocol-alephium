import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { FungibleToken } from '../../../src/fungible-token'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import {
  Invariant,
  Liquidity,
  newFeeTier,
  newPoolKey,
  Percentage,
  PoolKey,
  TokenAmount,
  toPercentage,
  toSqrtPrice
} from '../../../src'
import { getPool } from '../../../src/testUtils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let admin: PrivateKeyWallet
let user: PrivateKeyWallet
let invariant: Invariant
let token0: string
let token1: string

const fee = toPercentage(1n, 2n)
const feeTier = newFeeTier(fee, 1n)
const anotherFeeTier = newFeeTier(fee, 2n)
let poolKey: PoolKey
let anotherPoolKey: PoolKey
const sqrtPrice = toSqrtPrice(1n, 0n)
const lowerTick = -10n
const upperTick = 10n
const liquidity = 1_000_000_000_000_000n as Liquidity
const amount = 1_000_000_000n as TokenAmount
const slippage = toPercentage(1n, 2n)

describe('create pool and position tests', () => {
  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
    user = await getSigner(ONE_ALPH * 1000n, 0)
    invariant = await Invariant.deploy(admin, 0n as Percentage)
    token0 = await FungibleToken.deploy(admin, (amount * 2n) as TokenAmount, 'Coin', 'COIN', 12n)
    token1 = await FungibleToken.deploy(admin, (amount * 2n) as TokenAmount, 'Coin', 'COIN', 12n)
    poolKey = newPoolKey(token0, token1, feeTier)
    anotherPoolKey = newPoolKey(token0, token1, anotherFeeTier)
  })

  test('create pool and position works', async () => {
    await invariant.addFeeTier(admin, feeTier)
    await invariant.addFeeTier(admin, anotherFeeTier)
    await invariant.createPool(admin, poolKey, sqrtPrice)

    await invariant.createPoolAndPosition(
      admin,
      anotherPoolKey,
      sqrtPrice,
      lowerTick,
      upperTick,
      liquidity,
      amount,
      amount,
      sqrtPrice,
      slippage
    )

    const pool = await invariant.getPool(anotherPoolKey)
    const [_, positionsCount] = await invariant.getPositions(admin.address, 100n, 0n)
    expect(pool).toBeTruthy()
    expect(positionsCount).toBe(1n)
  })
})
