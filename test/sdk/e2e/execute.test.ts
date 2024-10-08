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
  SqrtPrice,
  TokenAmount,
  toPercentage,
  toSqrtPrice,
  waitTxConfirmed
} from '../../../src'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let admin: PrivateKeyWallet
let user: PrivateKeyWallet
let invariant: Invariant
let token: FungibleToken
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
const amountIn = 10_000n as TokenAmount
const sqrtPriceLimit = 0n as SqrtPrice

describe('execute tests', () => {
  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
    user = await getSigner(ONE_ALPH * 1000n, 0)
    invariant = await Invariant.deploy(admin, 0n as Percentage)
    token = FungibleToken.load()
    token0 = await FungibleToken.deploy(admin, (amount * 2n) as TokenAmount, 'Coin', 'COIN', 12n)
    token1 = await FungibleToken.deploy(admin, (amount * 2n) as TokenAmount, 'Coin', 'COIN', 12n)
    poolKey = newPoolKey(token0, token1, feeTier)
    anotherPoolKey = newPoolKey(token0, token1, anotherFeeTier)
  })

  test('change protocol fee works', async () => {
    await waitTxConfirmed(invariant.changeProtocolFeeExecute(admin, fee))

    const protocolFee = await invariant.getProtocolFee()
    expect(protocolFee).toBe(fee)
  })

  test('add fee tier works', async () => {
    await waitTxConfirmed(invariant.addFeeTierExecute(admin, feeTier))
    await waitTxConfirmed(invariant.addFeeTierExecute(admin, anotherFeeTier))

    const feeTiers = await invariant.getFeeTiers()
    expect(feeTiers.length).toBe(2)
    expect(feeTiers[0]).toMatchObject(feeTier)
  })

  test('create pool works', async () => {
    await waitTxConfirmed(invariant.createPoolExecute(admin, poolKey, sqrtPrice))

    const poolKeys = await invariant.getAllPoolKeys()
    expect(poolKeys.length).toBe(1)
    expect(poolKeys[0]).toMatchObject(poolKey)
  })

  test('create position works', async () => {
    await waitTxConfirmed(
      invariant.createPositionExecute(
        admin,
        poolKey,
        lowerTick,
        upperTick,
        liquidity,
        amount,
        amount,
        sqrtPrice,
        slippage
      )
    )

    const [_, positionsCount] = await invariant.getPositions(admin.address, 100n, 0n)
    expect(positionsCount).toBe(1n)
  })

  test('swap works', async () => {
    await waitTxConfirmed(
      invariant.swapExecute(admin, poolKey, true, amountIn, true, sqrtPriceLimit, amountIn)
    )

    const balanceX = await FungibleToken.load().getBalanceOf(admin.address, poolKey.tokenX)
    expect(balanceX).toBe(1994991499n)
    const balanceY = await FungibleToken.load().getBalanceOf(admin.address, poolKey.tokenY)
    expect(balanceY).toBe(1995011398n)
  })

  test('claim fee works', async () => {
    await waitTxConfirmed(invariant.claimFeeExecute(admin, 0n))

    const balanceX = await FungibleToken.load().getBalanceOf(admin.address, poolKey.tokenX)
    expect(balanceX).toBe(1994991598n)
    const balanceY = await FungibleToken.load().getBalanceOf(admin.address, poolKey.tokenY)
    expect(balanceY).toBe(1995011398n)
  })

  test('withdraw protocol fee', async () => {
    await waitTxConfirmed(invariant.withdrawProtocolFeeExecute(admin, poolKey))

    const balanceX = await FungibleToken.load().getBalanceOf(admin.address, poolKey.tokenX)
    expect(balanceX).toBe(1994991599n)
    const balanceY = await FungibleToken.load().getBalanceOf(admin.address, poolKey.tokenY)
    expect(balanceY).toBe(1995011398n)
  })

  test('transfer position works', async () => {
    await waitTxConfirmed(invariant.transferPositionExecute(admin, 0n, user.address))

    const [_, adminPositionsCount] = await invariant.getPositions(admin.address, 100n, 0n)
    expect(adminPositionsCount).toBe(0n)

    const [__, puserPositionsCount] = await invariant.getPositions(user.address, 100n, 0n)
    expect(puserPositionsCount).toBe(1n)
  })

  test('remove position works', async () => {
    await waitTxConfirmed(invariant.removePositionExecute(user, 0n))

    const [_, positionsCount] = await invariant.getPositions(user.address, 100n, 0n)
    expect(positionsCount).toBe(0n)
  })

  test('change fee receiver works', async () => {
    await waitTxConfirmed(invariant.changeFeeReceiverExecute(admin, poolKey, user.address))

    const pool = await invariant.getPool(poolKey)
    expect(pool.feeReceiver).toBe(user.address)
  })

  test('remove fee tier works', async () => {
    await waitTxConfirmed(invariant.removeFeeTierExecute(admin, feeTier))

    const feeTiers = await invariant.getFeeTiers()
    expect(feeTiers.length).toBe(1)
  })

  test('create pool and position works', async () => {
    await waitTxConfirmed(
      invariant.createPoolAndPositionExecute(
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
    )

    const pool = await invariant.getPool(anotherPoolKey)
    const [_, positionsCount] = await invariant.getPositions(admin.address, 100n, 0n)
    expect(pool).toBeTruthy()
    expect(positionsCount).toBe(1n)
  })
})
