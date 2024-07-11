import { Invariant as InvariantFactory, InvariantInstance } from '../artifacts/ts'
import { FeeTier } from '../artifacts/ts/types'
import { Network } from './network'
import { deployCLAMM, deployReserve, waitTxConfirmed } from './utils'
import { Address, SignerProvider } from '@alephium/web3'

export class Invariant {
  instance: InvariantInstance
  network: Network
  address: Address

  private constructor(address: Address, network: Network) {
    this.address = address
    this.instance = InvariantFactory.at(address)
    this.network = network
  }

  static async deploy(
    signer: SignerProvider,
    network: Network,
    protocolFee: bigint = 0n
  ): Promise<Invariant> {
    const account = await signer.getSelectedAccount()
    const clamm = await deployCLAMM(signer)
    const reserve = await deployReserve(signer)
    const deployResult = await waitTxConfirmed(
      InvariantFactory.deploy(signer, {
        initialFields: {
          config: { admin: account.address, protocolFee },
          reserveTemplateId: reserve.contractId,
          lastReserveId: reserve.contractId,
          clamm: clamm.contractId,
          feeTierCount: 0n,
          poolKeyCount: 0n
        }
      })
    )

    return new Invariant(deployResult.contractInstance.address, network)
  }

  static async load(address: Address, network: Network): Promise<Invariant> {
    return new Invariant(address, network)
  }

  async getProtocolFee(): Promise<bigint> {
    return (await this.instance.view.getProtocolFee()).returns
  }
}
