import { assert } from 'console'
import {
  AddFeeTier,
  ChangeFeeReceiver,
  ChangeProtocolFee,
  ClaimFee,
  CreatePool,
  CreatePosition,
  Invariant as InvariantFactory,
  InvariantInstance,
  RemoveFeeTier,
  RemovePosition,
  Swap,
  TransferPosition,
  WithdrawProtocolFee
} from '../artifacts/ts'
import { FeeTier, Pool, PoolKey, Position, QuoteResult, Tick } from '../artifacts/ts/types'
import { calculateTick, getMaxTick, getMinTick } from './math'
import { Network } from './network'
import { getReserveAddress } from './testUtils'
import {
  balanceOf,
  decodeFeeTiers,
  decodePool,
  decodePosition,
  decodeTick,
  EMPTY_FEE_TIERS,
  deployCLAMM,
  deployReserve,
  MAP_ENTRY_DEPOSIT,
  waitTxConfirmed,
  constructTickmap
} from './utils'
import { Address, DUST_AMOUNT, SignerProvider } from '@alephium/web3'

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
          feeTiers: EMPTY_FEE_TIERS,
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

  async addFeeTier(signer: SignerProvider, feeTier: FeeTier): Promise<string> {
    const { txId } = await waitTxConfirmed(
      AddFeeTier.execute(signer, {
        initialFields: {
          invariant: this.instance.contractId,
          feeTier
        },
        attoAlphAmount: MAP_ENTRY_DEPOSIT
      })
    )
    return txId
  }

  async removeFeeTier(signer: SignerProvider, feeTier: FeeTier): Promise<string> {
    const { txId } = await waitTxConfirmed(
      RemoveFeeTier.execute(signer, {
        initialFields: {
          invariant: this.instance.contractId,
          feeTier
        }
      })
    )
    return txId
  }

  async createPool(
    signer: SignerProvider,
    token0Id: string,
    token1Id: string,
    feeTier: FeeTier,
    initSqrtPrice: bigint
  ): Promise<string> {
    const initTick = await calculateTick(initSqrtPrice, feeTier.tickSpacing)

    const { txId } = await waitTxConfirmed(
      CreatePool.execute(signer, {
        initialFields: {
          invariant: this.instance.contractId,
          token0: token0Id,
          token1: token1Id,
          feeTier,
          initSqrtPrice,
          initTick
        },
        attoAlphAmount: MAP_ENTRY_DEPOSIT * 5n
      })
    )
    return txId
  }

  async withdrawProtocolFee(signer: SignerProvider, poolKey: PoolKey): Promise<string> {
    const { txId } = await waitTxConfirmed(
      WithdrawProtocolFee.execute(signer, {
        initialFields: {
          invariant: this.instance.contractId,
          poolKey
        }
      })
    )
    return txId
  }
  async changeFeeReceiver(
    signer: SignerProvider,
    poolKey: PoolKey,
    newFeeReceiver: Address
  ): Promise<string> {
    const { txId } = await waitTxConfirmed(
      ChangeFeeReceiver.execute(signer, {
        initialFields: {
          invariant: this.instance.contractId,
          poolKey,
          newFeeReceiver
        }
      })
    )
    return txId
  }
  async changeProtocolFee(signer: SignerProvider, fee: bigint): Promise<string> {
    const { txId } = await waitTxConfirmed(
      ChangeProtocolFee.execute(signer, {
        initialFields: {
          invariant: this.instance.contractId,
          newFee: fee
        }
      })
    )
    return txId
  }

  async createPosition(
    signer: SignerProvider,
    poolKey: PoolKey,
    lowerTick: bigint,
    upperTick: bigint,
    liquidityDelta: bigint,
    approvedTokensX: bigint,
    approvedTokensY: bigint,
    slippageLimitLower: bigint,
    slippageLimitUpper: bigint
  ): Promise<string> {
    const { txId } = await waitTxConfirmed(
      CreatePosition.execute(signer, {
        initialFields: {
          invariant: this.instance.contractId,
          poolKey,
          lowerTick,
          upperTick,
          liquidityDelta,
          slippageLimitLower,
          slippageLimitUpper
        },
        tokens: [
          { id: poolKey.tokenX, amount: approvedTokensX },
          { id: poolKey.tokenY, amount: approvedTokensY }
        ],
        attoAlphAmount: MAP_ENTRY_DEPOSIT * 6n + DUST_AMOUNT * 2n
      })
    )

    return txId
  }
  async removePosition(signer: SignerProvider, index: bigint): Promise<string> {
    const { txId } = await waitTxConfirmed(
      RemovePosition.execute(signer, {
        initialFields: {
          invariant: this.instance.contractId,
          index
        }
      })
    )
    return txId
  }
  async claimFee(signer: SignerProvider, index: bigint): Promise<string> {
    const { txId } = await waitTxConfirmed(
      ClaimFee.execute(signer, {
        initialFields: {
          invariant: this.instance.contractId,
          index
        },
        attoAlphAmount: DUST_AMOUNT
      })
    )
    return txId
  }
  async transferPosition(
    signer: SignerProvider,
    index: bigint,
    recipient: Address
  ): Promise<string> {
    const { txId } = await waitTxConfirmed(
      TransferPosition.execute(signer, {
        initialFields: {
          invariant: this.instance.contractId,
          index,
          recipient
        },
        attoAlphAmount: 2n * MAP_ENTRY_DEPOSIT
      })
    )
    return txId
  }
  async swap(
    signer: SignerProvider,
    poolKey: PoolKey,
    xToY: boolean,
    amount: bigint,
    byAmountIn: boolean,
    sqrtPriceLimit: bigint,
    approvedAmount = amount
  ): Promise<string> {
    const tokenId = xToY ? poolKey.tokenX : poolKey.tokenY
    const { txId } = await waitTxConfirmed(
      Swap.execute(signer, {
        initialFields: {
          invariant: this.instance.contractId,
          poolKey,
          xToY,
          amount,
          byAmountIn,
          sqrtPriceLimit
        },
        tokens: [{ id: tokenId, amount: approvedAmount }],
        attoAlphAmount: DUST_AMOUNT * 2n
      })
    )
    return txId
  }

  async feeTierExist(feeTier: FeeTier): Promise<boolean> {
    return (await this.instance.view.feeTierExist({ args: { feeTier } })).returns
  }

  async getFeeTiers(): Promise<FeeTier[]> {
    const state = await this.instance.fetchState()
    return state.fields.feeTiers.feeTiers.slice(0, Number(state.fields.feeTierCount))
  }

  async getPool(poolKey: PoolKey): Promise<Pool> {
    return decodePool((await this.instance.view.getPool({ args: { poolKey } })).returns)
  }

  async getPosition(owner: Address, index: bigint): Promise<Position> {
    return decodePosition(
      (await this.instance.view.getPosition({ args: { owner, index } })).returns
    )
  }

  async quote(
    poolKey: PoolKey,
    xToY: boolean,
    amount: bigint,
    byAmountIn: boolean,
    sqrtPriceLimit: bigint
  ): Promise<QuoteResult> {
    return (
      await this.instance.view.quote({
        args: { poolKey, xToY, amount, byAmountIn, sqrtPriceLimit }
      })
    ).returns
  }

  async getTick(poolKey: PoolKey, index: bigint): Promise<Tick> {
    return decodeTick((await this.instance.view.getTick({ args: { poolKey, index } })).returns)
  }

  async isTickInitialized(poolKey: PoolKey, index: bigint): Promise<boolean> {
    return (await this.instance.view.isTickInitialized({ args: { poolKey, index } })).returns
  }

  async getReserveBalances(poolKey: PoolKey): Promise<{ x: bigint; y: bigint }> {
    const pool = await this.getPool(poolKey)
    const [reserveX, reserveY] = getReserveAddress(pool)
    const x = await balanceOf(poolKey.tokenX, reserveX)
    const y = await balanceOf(poolKey.tokenY, reserveY)
    return { x, y }
  }

  async getProtocolFee(): Promise<bigint> {
    return (await this.instance.view.getProtocolFee()).returns
  }

  // async getPositions() {}
  // async getAllPositions() {}
  // async getPoolKeys() {}
  // async getAllPoolKeys() {}
  // async swapWithSlippage() {}
  // async getPositionTicks() {}

  async getFullTickmap(poolKey: PoolKey) {
    const response = await this.instance.view.getFullTickmap({ args: { poolKey } })
    console.log('Full tickmap gas used:', response.gasUsed)
    console.log('Full tickmap:', response.returns)
    constructTickmap(response.returns)
  }
  // async getLiquidityTicks() {}
  // async getAllLiquidityTicks() {}
  // async getUserPositionAmount() {}
  // async getLiquidityTicksAmount() {}
  // async getAllPoolsForPair() {}
}
