import {
  FEE_TIERS,
  Invariant,
  PrivateKeyWallet,
  Network,
  FungibleToken,
  PoolKey,
  calculateTick,
  newPoolKey,
  priceToSqrtPrice,
  toPercentage,
  setOfficialNodeProvider,
  TokenAmount,
  ALPH_TOKEN_ID,
  Price,
  Liquidity,
  Percentage
} from '@invariant-labs/alph-sdk'
import dotenv from 'dotenv'

dotenv.config()

const main = async () => {
  setOfficialNodeProvider(Network.Testnet)

  const privateKey = process.env.DEPLOYER_PK ?? ''
  const account = new PrivateKeyWallet({ privateKey })

  console.log(`Deployer: ${account.address}, Private Key: ${privateKey}`)
  const invariant = await Invariant.deploy(account, toPercentage(1n, 2n))
  console.log(`Invariant: ${invariant.instance.address.toString()}`)

  for (const feeTier of FEE_TIERS) {
    await invariant.addFeeTier(account, feeTier)
  }
  console.log('Successfully added fee tiers')

  const BTCTokenID = await FungibleToken.deploy(account, 0n as TokenAmount, 'Bitcoin', 'BTC', 8n)
  const ETHTokenID = await FungibleToken.deploy(account, 0n as TokenAmount, 'Ether', 'ETH', 12n)
  const USDCTokenID = await FungibleToken.deploy(account, 0n as TokenAmount, 'USDC', 'USDC', 6n)
  const USDTTokenID = await FungibleToken.deploy(
    account,
    0n as TokenAmount,
    'Tether USD',
    'USDT',
    6n
  )

  const SOLTokenID = await FungibleToken.deploy(account, 0n as TokenAmount, 'Solana', 'SOL', 9n)
  const decimals = {
    [BTCTokenID]: 8n,
    [ETHTokenID]: 12n,
    [USDCTokenID]: 6n,
    [USDTTokenID]: 6n,
    [SOLTokenID]: 9n,
    [ALPH_TOKEN_ID]: 18n
  }
  console.log(
    `BTC: ${BTCTokenID}, ETH: ${ETHTokenID}, USDC: ${USDCTokenID}, USDT: ${USDTTokenID}, SOL: ${SOLTokenID}`
  )

  const response = await fetch(
    'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,alephium,solana'
  )
  const data = await response.json()
  const prices = {
    [BTCTokenID]: data.find((coin: any) => coin.id === 'bitcoin').current_price,
    [ETHTokenID]: data.find((coin: any) => coin.id === 'ethereum').current_price,
    [USDCTokenID]: 1,
    [USDTTokenID]: 1,
    [SOLTokenID]: data.find((coin: any) => coin.id === 'solana').current_price,
    [ALPH_TOKEN_ID]: data.find((coin: any) => coin.id === 'alephium').current_price
  }
  console.log(
    `BTC: ${prices[BTCTokenID]}, ETH: ${prices[ETHTokenID]}, USDC: ${prices[USDCTokenID]}, USDT: ${prices[USDTTokenID]}, SOL: ${prices[SOLTokenID]}, ALPH: ${prices[ALPH_TOKEN_ID]}`
  )

  const poolKeys: [PoolKey, bigint][] = [
    // [newPoolKey(ALPH_TOKEN_ID, BTCTokenID, FEE_TIERS[1]), 10804609546189987720n],
    // [newPoolKey(ALPH_TOKEN_ID, ETHTokenID, FEE_TIERS[1]), 4711830510277394610468n],
    // [newPoolKey(ALPH_TOKEN_ID, USDCTokenID, FEE_TIERS[1]), 272063075569508447756n],
    // [newPoolKey(ALPH_TOKEN_ID, USDTTokenID, FEE_TIERS[1]), 272063075569508447756n],
    // [newPoolKey(ALPH_TOKEN_ID, SOLTokenID, FEE_TIERS[1]), 37143700245489847211n],
    [newPoolKey(BTCTokenID, ETHTokenID, FEE_TIERS[1]), 130559235944405760n],
    [newPoolKey(BTCTokenID, USDCTokenID, FEE_TIERS[1]), 7865049221247086n],
    [newPoolKey(BTCTokenID, USDTTokenID, FEE_TIERS[1]), 7865049221247086n],
    [newPoolKey(BTCTokenID, SOLTokenID, FEE_TIERS[1]), 977937074251981n],
    [newPoolKey(ETHTokenID, USDCTokenID, FEE_TIERS[1]), 3454809855596621497n],
    [newPoolKey(ETHTokenID, USDTTokenID, FEE_TIERS[1]), 3454809855596621497n],
    [newPoolKey(ETHTokenID, SOLTokenID, FEE_TIERS[1]), 423131631710393596n],
    [newPoolKey(USDCTokenID, USDTTokenID, FEE_TIERS[1]), 9999818389598293n],
    [newPoolKey(USDCTokenID, SOLTokenID, FEE_TIERS[1]), 24911294718392400n],
    [newPoolKey(USDTTokenID, SOLTokenID, FEE_TIERS[1]), 24911294718392400n]
  ]
  for (const [poolKey] of poolKeys) {
    const price =
      (1 / (prices[poolKey.tokenY] / prices[poolKey.tokenX])) *
      10 ** (Number(decimals[poolKey.tokenY]) - Number(decimals[poolKey.tokenX])) *
      10 ** 24
    try {
      const poolSqrtPrice = priceToSqrtPrice(BigInt(Math.round(price)) as Price)
      await invariant.createPool(account, poolKey, poolSqrtPrice)
    } catch (e) {
      console.log('Create pool error', poolKey, e)
    }
  }
  console.log('Successfully added pools')

  const token = FungibleToken.load()
  await token.mint(account, (2n ** 96n - 1n) as TokenAmount, BTCTokenID)
  await token.mint(account, (2n ** 96n - 1n) as TokenAmount, ETHTokenID)
  await token.mint(account, (2n ** 96n - 1n) as TokenAmount, USDCTokenID)
  await token.mint(account, (2n ** 96n - 1n) as TokenAmount, USDTTokenID)
  await token.mint(account, (2n ** 96n - 1n) as TokenAmount, SOLTokenID)

  const BTCBefore = await token.getBalanceOf(account.address, BTCTokenID)
  const ETHBefore = await token.getBalanceOf(account.address, ETHTokenID)
  const USDCBefore = await token.getBalanceOf(account.address, USDCTokenID)
  const USDTBefore = await token.getBalanceOf(account.address, USDTTokenID)
  const SOLBefore = await token.getBalanceOf(account.address, SOLTokenID)
  // const ALPHBefore = await token.getBalanceOf(account.address, ALPH_TOKEN_ID)

  console.log(
    `BTC: ${BTCBefore}, ETH: ${ETHBefore}, USDC: ${
      USDCBefore
    }, USDT: ${USDTBefore}, SOL: ${SOLBefore}`
  )

  for (const [poolKey, amount] of poolKeys) {
    const price =
      (1 / (prices[poolKey.tokenY] / prices[poolKey.tokenX])) *
      10 ** (Number(decimals[poolKey.tokenY]) - Number(decimals[poolKey.tokenX])) *
      10 ** 24
    const lowerSqrtPrice = priceToSqrtPrice(BigInt(Math.round(price * 0.95)) as Price)
    const upperSqrtPrice = priceToSqrtPrice(BigInt(Math.round(price * 1.05)) as Price)
    const poolSqrtPrice = priceToSqrtPrice(BigInt(Math.round(price)) as Price)
    try {
      const lowerTick = calculateTick(lowerSqrtPrice, FEE_TIERS[1].tickSpacing)
      const upperTick = calculateTick(upperSqrtPrice, FEE_TIERS[1].tickSpacing)
      const approvedAmountX = await token.getBalanceOf(account.address, poolKey.tokenX)
      const approvedAmountY = await token.getBalanceOf(account.address, poolKey.tokenY)
      await invariant.createPosition(
        account,
        poolKey,
        lowerTick,
        upperTick,
        amount as Liquidity,
        approvedAmountX,
        approvedAmountY,
        poolSqrtPrice,
        0n as Percentage
      )
    } catch (e) {
      console.log('Create position error', poolKey, e)
    }
  }
  const BTCAfter = await token.getBalanceOf(account.address, BTCTokenID)
  const ETHAfter = await token.getBalanceOf(account.address, ETHTokenID)
  const USDCAfter = await token.getBalanceOf(account.address, USDCTokenID)
  const USDTAfter = await token.getBalanceOf(account.address, USDTTokenID)
  const SOLAfter = await token.getBalanceOf(account.address, SOLTokenID)
  // const ALPHAfter = await token.getBalanceOf(account.address, ALPH_TOKEN_ID)
  console.log(
    `BTC: ${BTCBefore - BTCAfter}, ETH: ${ETHBefore - ETHAfter}, USDC: ${
      USDCBefore - USDCAfter
    }, USDT: ${USDTBefore - USDTAfter}, SOL: ${SOLBefore - SOLAfter}`
  )
  console.log('Successfully created positions')

  process.exit(0)
}

main()
