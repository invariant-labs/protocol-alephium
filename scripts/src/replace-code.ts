import {
  Invariant,
  Network,
  INVARIANT_ADDRESS,
  setOfficialNodeProvider,
  PrivateKeyWallet
} from '@invariant-labs/alph-sdk'
import dotenv from 'dotenv'

dotenv.config()

const main = async () => {
  setOfficialNodeProvider(Network.Testnet)

  const privateKey = process.env.DEPLOYER_PK ?? ''
  const account = new PrivateKeyWallet({ privateKey })
  console.log(`Deployer: ${account.address}, Private Key: ${privateKey}`)

  let invariant = await Invariant.load(INVARIANT_ADDRESS[Network.Testnet])

  console.log(`Invariant: ${invariant.instance.address.toString()}`)

  await invariant.upgradeCode(account)

  console.log(await invariant.getAllPoolKeys())
  console.log('Upgrade complete')

  process.exit(0)
}

main()
