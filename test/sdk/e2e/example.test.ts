import { ALPH_TOKEN_ID, ONE_ALPH } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { Invariant } from '../../../src/invariant'
import { Network } from '../../../src/network'
import { FungibleToken } from '../../../src/fungible-token'
import {
  calculateFee,
  calculateSqrtPriceAfterSlippage,
  getLiquidityByY,
  getMinSqrtPrice,
  priceToSqrtPrice,
  toPercentage,
  toPrice,
  toTokenAmount
} from '../../../src/math'
import {
  filterTickmap,
  filterTicks,
  newFeeTier,
  newPoolKey,
  simulateInvariantSwap
} from '../../../src/utils'
import { Pool, Position, Tick } from '../../../src/types'

let account: PrivateKeyWallet
let INVARIANT_ADDRESS: string
let TOKEN0_ID: string
let TOKEN1_ID: string

describe('sdk guide snippets', () => {
  beforeEach(async () => {
    account = await getSigner(1000n * ONE_ALPH)
    INVARIANT_ADDRESS = (await Invariant.deploy(account, Network.Local)).address
    TOKEN0_ID = await FungibleToken.deploy(account, 10n ** 30n, 'Coin', 'COIN', 12n)
    TOKEN1_ID = await FungibleToken.deploy(account, 10n ** 30n, 'Coin', 'COIN', 12n)
  })
  test('main guide', async () => {
    // load invariant contract
    const invariant = await Invariant.load(INVARIANT_ADDRESS, Network.Local)
    // load token contract
    const token = await FungibleToken.load(Network.Local)

    // set fee tier, make sure that fee tier with specified parameters exists
    const feeTier = await newFeeTier(toPercentage(1n, 2n), 1n) // fee: 0.01 = 1%, tick spacing: 1

    // if the fee tier does not exists, you have to add it
    const isAdded = await invariant.feeTierExist(feeTier)
    if (!isAdded) {
      // ATTENTION: this command is only available to the administrator of the invariant contract!
      await invariant.addFeeTier(account, feeTier)
    }

    // set initial price of the pool, we set it to 1.00
    const price = toPrice(1n, 0n)
    const initSqrtPrice = priceToSqrtPrice(price)

    // set pool key, make sure that pool for these tokens does not exist already
    const poolKey = await newPoolKey(TOKEN0_ID, TOKEN1_ID, feeTier)

    const createPoolTransactionId = await invariant.createPool(
      account,
      poolKey.tokenX,
      poolKey.tokenY,
      feeTier,
      initSqrtPrice
    )

    // print transaction id
    console.log(createPoolTransactionId)

    // token y has 12 decimals and we want to add 8 actual tokens to our position
    const tokenYAmount = toTokenAmount(8n, 12n)

    // set lower and upper tick indexes, we want to open a position in range [-10, 10]
    const [lowerTickIndex, upperTickIndex] = [-10n, 10n]

    // calculate the amount of token x we need to open position
    const { amount: tokenXAmount, l: positionLiquidity } = await getLiquidityByY(
      tokenYAmount,
      lowerTickIndex,
      upperTickIndex,
      initSqrtPrice,
      true
    )

    // print amount of token x and y we need to open our position
    console.log('Token X amount: ', tokenXAmount, ' Token Y amount: ', tokenYAmount)

    // token approval is part of position creation
    const createPositionTransactionId = await invariant.createPosition(
      account,
      poolKey,
      lowerTickIndex,
      upperTickIndex,
      positionLiquidity,
      tokenXAmount,
      tokenYAmount,
      initSqrtPrice,
      initSqrtPrice
    )

    // print transaction id
    console.log(createPositionTransactionId)

    // check the newly opened position
    console.log(await invariant.getPosition(account.address, 0n))

    // now, swapping
    // in this example we assume that we want to swap no matter how much of token1 we get

    // we want to swap 6 token0
    // token0 has 12 decimal places
    const amount = toTokenAmount(6n, 12n)

    // get estimated result of swap - there are 2 ways to do it
    // 1. use the quote method
    // due to it being computed using blockchain, thus having a latency and being subjected to gas limit, we recommend the second method
    // const quoteResult = await invariant.quote(poolKey, true, amount, true, await getMinSqrtPrice(feeTier.tickSpacing))

    // 2. use local simulation of a swap [PREFERRED]
    {
      // get the pool to have the current information about its state
      const pool = await invariant.getPool(poolKey)

      // filtering only serves to reduce the amount of ticks we have to simulate, it is not necessary
      // filter tickmap to only have ticks of interest for our swap
      const tickmap = await filterTickmap(
        await invariant.getFullTickmap(poolKey),
        poolKey.feeTier.tickSpacing,
        pool.currentTickIndex,
        true
      )

      // filter ticks
      const ticks = filterTicks(
        await invariant.getAllLiquidityTicks(poolKey, tickmap),
        pool.currentTickIndex,
        true
      )

      // simulate the swap locally
      const simulateResult = simulateInvariantSwap(
        tickmap,
        pool,
        ticks,
        true,
        amount,
        true,
        await getMinSqrtPrice(feeTier.tickSpacing)
      )

      // you can now use the result of the simulation to make a decision whether to swap or not
      // let's print it
      console.log('Simulated swap result: ', simulateResult)

      // make sure `stateOutdated` is false, otherwise you should repeat the whole procedure and try again
      // amountOut is the amount of token1 you will get
      // if you decide to swap, you can do it like this:

      // the price might change in the meantime, so we should apply slippage
      // slippage is a price change you are willing to accept
      // for example, if current price is 1 and your slippage is 1%, the price limit should be set to 1.01
      const allowedSlippage = toPercentage(1n, 3n) // 0.001 = 0.1%

      const sqrtPriceLimit = calculateSqrtPriceAfterSlippage(
        simulateResult.targetSqrtPrice,
        allowedSlippage,
        false
      )

      const swapTransactionId = await invariant.swap(
        account,
        poolKey,
        true,
        amount,
        true,
        sqrtPriceLimit
      )
      // print swap transaction id
      console.log(swapTransactionId)
    }
    // query state
    const pool: Pool = await invariant.getPool(poolKey)
    const position: Position = await invariant.getPosition(account.address, 0n)
    const lowerTick: Tick = await invariant.getTick(poolKey, position.lowerTickIndex)
    const upperTick: Tick = await invariant.getTick(poolKey, position.upperTickIndex)

    // check amount of tokens you are able to claim
    const fees = await calculateFee(pool, position, lowerTick, upperTick)

    // print amount of unclaimed x and y tokens
    console.log(fees)

    // get balance of a specific token before claiming position fees and print it
    const accountBalanceBeforeClaim = await token.getBalanceOf(account.address, poolKey.tokenX)
    console.log(accountBalanceBeforeClaim)

    // specify position id
    const positionId = 0n
    // claim fee
    const claimFeeTransactionId = await invariant.claimFee(account, positionId)
    // print transaction hash
    console.log(claimFeeTransactionId)

    // get balance of a specific token before claiming position fees and print it
    const accountBalanceAfterClaim = await token.getBalanceOf(account.address, poolKey.tokenX)
    console.log(accountBalanceAfterClaim)

    const receiver = await getSigner(1000n * ONE_ALPH)

    const { owner, ...positionToTransfer } = await invariant.getPosition(account.address, 0n)

    // Transfer position from account (signer) to receiver
    await invariant.transferPosition(account, 0n, receiver.address)
    const receiverPosition = await invariant.getPosition(receiver.address, 0n)
    // the position will be the same, except for the owner field
    expect(receiverPosition).toMatchObject(positionToTransfer)
    console.log(receiverPosition)

    // ### transfer the position back to the original account
    await invariant.transferPosition(receiver, 0n, account.address)
    // ###

    // fetch user balances before removal
    const accountToken0BalanceBeforeRemove = await token.getBalanceOf(
      account.address,
      poolKey.tokenX
    )
    const accountToken1BalanceBeforeRemove = await token.getBalanceOf(account.address, TOKEN1_ID)
    console.log(accountToken0BalanceBeforeRemove, accountToken1BalanceBeforeRemove)

    // remove position
    const removePositionTransactionId = await invariant.removePosition(account, positionId)
    console.log(removePositionTransactionId)

    // get balance of a specific token after removing position
    const accountToken0BalanceAfterRemove = await token.getBalanceOf(account.address, TOKEN0_ID)
    const accountToken1BalanceAfterRemove = await token.getBalanceOf(account.address, TOKEN1_ID)

    // print balances
    console.log(accountToken0BalanceAfterRemove, accountToken1BalanceAfterRemove)
  })

  test('using alph as token', async () => {
    // ALPH just like any other token has a Contract Id (Token Id), so it can be used in the same way

    // load token contract
    const token = await FungibleToken.load(Network.Local)

    // get balance of account
    const accountBalance = await token.getBalanceOf(account.address, ALPH_TOKEN_ID)
    console.log(accountBalance)
  })
  test('using FungibleToken', async () => {
    // deploy token, it will return token ids
    const TOKEN0_ID = await FungibleToken.deploy(account, 500n, 'CoinA', 'ACOIN', 12n)
    const TOKEN1_ID = await FungibleToken.deploy(account, 500n, 'CoinB', 'BCOIN', 12n)

    // load token by passing its address (you can use existing one), it allows you to interact with it
    const token = await FungibleToken.load(Network.Local)

    // interact with token 0
    const account0Balance = await token.getBalanceOf(account.address, TOKEN0_ID)
    console.log(account0Balance)

    // if you want to interact with different token,
    // simply pass different contract address as an argument
    const account1Balance = await token.getBalanceOf(account.address, TOKEN1_ID)
    console.log(account1Balance)

    // fetch token metadata for previously deployed token0
    const token0Name = await token.getTokenName(TOKEN0_ID)
    const token0Symbol = await token.getTokenSymbol(TOKEN0_ID)
    const token0Decimals = await token.getTokenDecimals(TOKEN0_ID)
    console.log(token0Name, token0Symbol, token0Decimals)

    // load different token
    // you can load all metadata at once
    const token1Meta = await token.getTokenMetadata(TOKEN1_ID)
    console.log(token1Meta.name, token1Meta.symbol, token1Meta.decimals)

    // you can also load metadata for multiple tokens at once
    const tokensMeta = await token.getTokenMetaDataMulti([TOKEN0_ID, TOKEN1_ID])
    console.log(tokensMeta.get(TOKEN0_ID)?.name, tokensMeta.get(TOKEN1_ID)?.name)
  })
})
