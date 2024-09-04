import { ALPH_TOKEN_ID, ONE_ALPH } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import {
  calculateFee,
  calculateSqrtPriceAfterSlippage,
  filterTickmap,
  filterTicks,
  FungibleToken,
  getLiquidityByY,
  getMinSqrtPrice,
  Invariant,
  newFeeTier,
  newPoolKey,
  Percentage,
  Pool,
  Position,
  priceToSqrtPrice,
  simulateInvariantSwap,
  Tick,
  TokenAmount,
  toPercentage,
  toPrice,
  toTokenAmount
} from '@invariant-labs/alph-sdk'
import { expect } from 'chai'

let account: PrivateKeyWallet
let INVARIANT_ADDRESS: string
let TOKEN0_ID: string
let TOKEN1_ID: string

async function setupEssentials() {
  account = await getSigner(1000n * ONE_ALPH)
  INVARIANT_ADDRESS = (await Invariant.deploy(account)).address
  const initMint = (10n ** 30n) as TokenAmount
  TOKEN0_ID = await FungibleToken.deploy(account, initMint, 'Coin', 'COIN', 12n)
  TOKEN1_ID = await FungibleToken.deploy(account, initMint, 'Coin', 'COIN', 12n)
}

const main = async () => {
  console.log('main guide')
  // load invariant contract
  const invariant = await Invariant.load(INVARIANT_ADDRESS)
  // load token contract
  const token = FungibleToken.load()

  // set fee tier, make sure that fee tier with specified parameters exists
  const feeTier = newFeeTier(toPercentage(1n, 2n), 1n) // fee: 0.01 = 1%, tick spacing: 1

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
  const poolKey = newPoolKey(TOKEN0_ID, TOKEN1_ID, feeTier)

  const createPoolTransactionId = await invariant.createPool(account, poolKey, initSqrtPrice)

  // print transaction id
  console.log(createPoolTransactionId)

  // token y has 12 decimals and we want to add 8 actual tokens to our position
  const tokenYAmount = toTokenAmount(8n, 12n)

  // set lower and upper tick indexes, we want to open a position in range [-10, 10]
  const [lowerTickIndex, upperTickIndex] = [-10n, 10n]

  // calculate the amount of token x we need to open position
  const { amount: tokenXAmount, l: positionLiquidity } = getLiquidityByY(
    tokenYAmount,
    lowerTickIndex,
    upperTickIndex,
    initSqrtPrice,
    true
  )

  // print amount of token x and y we need to open our position
  console.log('Token X amount: ', tokenXAmount, ' Token Y amount: ', tokenYAmount)
  expect(tokenXAmount).to.equal(7999999999880n)
  expect(tokenYAmount).to.equal(8000000000000n)

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
    0n as Percentage
  )

  // print transaction id
  console.log(createPositionTransactionId)

  // check the newly opened position
  console.log(await invariant.getPosition(account.address, 0n))

  {
    const position = await invariant.getPosition(account.address, 0n)
    expect(position).to.deep.include({
      liquidity: 1600480031975990558848n,
      lowerTickIndex: -10n,
      upperTickIndex: 10n,
      feeGrowthInsideX: 0n,
      feeGrowthInsideY: 0n,
      tokensOwedX: 0n,
      tokensOwedY: 0n
    })

    expect(position.poolKey.feeTier).to.deep.include({
      fee: 10000000000n,
      tickSpacing: 1n
    })
  }

  // now, swapping
  // in this example we assume that we want to swap no matter how much of token1 we get

  // we want to swap 6 token0
  // token0 has 12 decimal places
  const amount = toTokenAmount(6n, 12n)

  // get estimated result of swap - there are 2 ways to do it
  // 1. use the quote method
  // due to it being computed using blockchain, thus having a latency and being subjected to gas limit, we recommend the second method
  const quoteResult = await invariant.quote(
    poolKey,
    true,
    amount,
    true,
    getMinSqrtPrice(feeTier.tickSpacing)
  )

  // 2. use local simulation of a swap [PREFERRED]
  {
    // get the pool to have the current information about its state
    const pool = await invariant.getPool(poolKey)

    // filtering only serves to reduce the amount of ticks we have to simulate, it is not necessary
    // filter tickmap to only have ticks of interest for our swap
    const tickmap = filterTickmap(
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
      getMinSqrtPrice(feeTier.tickSpacing)
    )

    // you can now use the result of the simulation to make a decision whether to swap or not
    // let's print it
    console.log('Simulated swap result: ', simulateResult)

    expect(simulateResult).to.deep.equal({
      amountIn: 6000000000000n,
      amountOut: 5937796254308n,
      startSqrtPrice: 1000000000000000000000000n,
      targetSqrtPrice: 999628999041807638582903n,
      fee: 60000000000n,
      crossedTicks: [],
      insufficientLiquidity: false,
      stateOutdated: false,
      swapStepLimitReached: false
    })

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
  const fees = calculateFee(pool, position, lowerTick, upperTick)

  // print amount of unclaimed x and y tokens
  console.log(fees)

  expect(fees).to.deep.equal([59999999999n, 0n])

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

  expect(accountBalanceAfterClaim).to.equal(accountBalanceBeforeClaim + fees[0])

  const receiver = await getSigner(1000n * ONE_ALPH)

  const { owner, ...positionToTransfer } = await invariant.getPosition(account.address, 0n)

  // Transfer position from account (signer) to receiver
  await invariant.transferPosition(account, 0n, receiver.address)
  const receiverPosition = await invariant.getPosition(receiver.address, 0n)
  // the position will be the same, except for the owner field
  expect(receiverPosition).to.deep.include(positionToTransfer)
  console.log(receiverPosition)

  // ### transfer the position back to the original account
  await invariant.transferPosition(receiver, 0n, account.address)
  // ###

  // fetch user balances before removal
  const accountTokenXBalanceBeforeRemove = await token.getBalanceOf(account.address, poolKey.tokenX)
  const accountTokenYBalanceBeforeRemove = await token.getBalanceOf(account.address, poolKey.tokenY)
  console.log(accountTokenXBalanceBeforeRemove, accountTokenYBalanceBeforeRemove)

  // remove position
  const removePositionTransactionId = await invariant.removePosition(account, positionId)
  console.log(removePositionTransactionId)

  // get balance of a specific token after removing position
  const accountTokenXBalanceAfterRemove = await token.getBalanceOf(account.address, poolKey.tokenX)
  const accountTokenYBalanceAfterRemove = await token.getBalanceOf(account.address, poolKey.tokenY)

  // print balances
  console.log(accountTokenXBalanceAfterRemove, accountTokenYBalanceAfterRemove)
}

const usingAlphAsToken = async () => {
  // ALPH just like any other token has a Contract Id (Token Id), so it can be used in the same way

  // load token contract
  const token = FungibleToken.load()

  // get balance of account
  const accountBalance = await token.getBalanceOf(account.address, ALPH_TOKEN_ID)
  console.log(accountBalance)
}

const usingFungibleToken = async () => {
  // deploy token, it will return token ids
  const initMint = 500n as TokenAmount
  const TOKEN0_ID = await FungibleToken.deploy(account, initMint, 'CoinA', 'ACOIN', 12n)
  const TOKEN1_ID = await FungibleToken.deploy(account, initMint, 'CoinB', 'BCOIN', 12n)

  // load token by passing its address (you can use existing one), it allows you to interact with it
  const token = FungibleToken.load()

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
}

await setupEssentials()
await main()
await usingAlphAsToken()
await usingFungibleToken()

console.log('\nGuide is up to date.')
