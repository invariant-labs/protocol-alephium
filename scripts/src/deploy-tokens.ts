import {
  Network,
  FungibleToken,
  TokenAmount,
  PrivateKeyWallet,
  setNodeProvider
} from '@invariant-labs/alph-sdk'
import dotenv from 'dotenv'

dotenv.config()

const main = async () => {
  const network = Network.Testnet
  setNodeProvider(network)

  const privateKey = process.env.DEPLOYER_PK ?? ''
  const account = new PrivateKeyWallet({ privateKey })
  const BTC_ADDRESS = await FungibleToken.deploy(
    account,
    network,
    1n as TokenAmount,
    'Bitcoin',
    'BTC',
    8n
  )
  const ETH_ADDRESS = await FungibleToken.deploy(
    account,
    network,
    2n as TokenAmount,
    'Ether',
    'ETH',
    18n
  )
  const USDC_ADDRESS = await FungibleToken.deploy(
    account,
    network,
    3n as TokenAmount,
    'USDC',
    'USDC',
    6n
  )

  console.log(`Deployer: ${account.address}, Uri: ${privateKey}`)
  console.log(`BTC: ${BTC_ADDRESS}, ETH: ${ETH_ADDRESS}, USDC: ${USDC_ADDRESS}`)

  process.exit(0)
}

main()
