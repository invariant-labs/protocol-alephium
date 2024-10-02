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
  Percentage,
  getLiquidityByX,
  SqrtPrice
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
  const ETHTokenID = await FungibleToken.deploy(account, 0n as TokenAmount, 'Ether', 'ETH', 18n)
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
    [ETHTokenID]: 18n,
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

  const poolKeys: PoolKey[] = [
    newPoolKey(BTCTokenID, ETHTokenID, FEE_TIERS[1]),
    newPoolKey(BTCTokenID, USDCTokenID, FEE_TIERS[1]),
    newPoolKey(BTCTokenID, USDTTokenID, FEE_TIERS[1]),
    newPoolKey(BTCTokenID, SOLTokenID, FEE_TIERS[1]),
    newPoolKey(ETHTokenID, USDCTokenID, FEE_TIERS[1]),
    newPoolKey(ETHTokenID, USDTTokenID, FEE_TIERS[1]),
    newPoolKey(ETHTokenID, SOLTokenID, FEE_TIERS[1]),
    newPoolKey(USDCTokenID, USDTTokenID, FEE_TIERS[1]),
    newPoolKey(USDCTokenID, SOLTokenID, FEE_TIERS[1]),
    newPoolKey(USDTTokenID, SOLTokenID, FEE_TIERS[1])
  ]
  for (const poolKey of poolKeys) {
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
  for (const poolKey of poolKeys) {
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
      const tokenXAmount = BigInt(
        Math.round((5000 / prices[poolKey.tokenX]) * 10 ** Number(decimals[poolKey.tokenX]))
      )
      const { l: liquidity } = getLiquidityByX(
        tokenXAmount as TokenAmount,
        lowerTick,
        upperTick,
        poolSqrtPrice as SqrtPrice,
        true
      )
      const approvedAmountX = await token.getBalanceOf(account.address, poolKey.tokenX)
      const approvedAmountY = await token.getBalanceOf(account.address, poolKey.tokenY)
      await invariant.createPosition(
        account,
        poolKey,
        lowerTick,
        upperTick,
        liquidity,
        approvedAmountX,
        approvedAmountY,
        poolSqrtPrice,
        0n as Percentage
      )
    } catch (e) {
      console.log('Create position error', poolKey, e)
    }
  }
  console.log('Successfully created positions')

  process.exit(0)
}

main()
