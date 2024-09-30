import { Invariant } from '@invariant-labs/alph-sdk'
import {
  Invariant as InvariantOld,
  Network,
  INVARIANT_ADDRESS,
  setOfficialNodeProvider,
  PrivateKeyWallet
} from 'invariant-old'
import dotenv from 'dotenv'

dotenv.config()

const main = async () => {
  setOfficialNodeProvider(Network.Testnet)

  const privateKey = process.env.DEPLOYER_PK ?? ''
  const account = new PrivateKeyWallet({ privateKey })
  console.log(`Deployer: ${account.address}, Private Key: ${privateKey}`)

  let invariant = await InvariantOld.load(INVARIANT_ADDRESS[Network.Testnet])
  console.log(`Invariant: ${invariant.instance.address.toString()}`)

  const code = Invariant.getCode()
  await invariant.upgradeCode(account, code)

  console.log(await invariant.getAllPoolKeys())
  console.log('Upgrade complete')

  process.exit(0)
}

main()
