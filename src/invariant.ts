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
import { calculateSqrtPriceAfterSlippage, calculateTick } from './math'
import { Network } from './network'
import { getReserveAddress } from './testUtils'
import {
  balanceOf,
  decodePool,
  decodePosition,
  decodeTick,
  EMPTY_FEE_TIERS,
  deployCLAMM,
  deployReserve,
  MAP_ENTRY_DEPOSIT,
  waitTxConfirmed,
  constructTickmap,
  getMaxBatch,
  decodePools,
  decodePoolKeys,
  getNodeUrl,
  signAndSend,
  decodePositions,
  Page
} from './utils'
import { MAX_BATCHES_QUERIED, MAX_POSITIONS_QUERIED } from './consts'
import {
  Address,
  ALPH_TOKEN_ID,
  DUST_AMOUNT,
  SignerProvider,
  TransactionBuilder
} from '@alephium/web3'

export class Invariant {
  instance: InvariantInstance
  network: Network
  address: Address
  builder: TransactionBuilder

  private constructor(address: Address, network: Network) {
    this.address = address
    this.instance = InvariantFactory.at(address)
    this.network = network
    this.builder = TransactionBuilder.from(getNodeUrl(network))
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

  async addFeeTierTx(signer: SignerProvider, feeTier: FeeTier) {
    const txBytecode = AddFeeTier.script.buildByteCodeToDeploy({
      invariant: this.instance.contractId,
      feeTier
    })
    const { address, publicKey } = await signer.getSelectedAccount()
    const tx = await this.builder.buildExecuteScriptTx(
      { signerAddress: address, bytecode: txBytecode, attoAlphAmount: MAP_ENTRY_DEPOSIT },
      publicKey
    )
    return tx
  }

  async addFeeTier(signer: SignerProvider, feeTier: FeeTier): Promise<string> {
    const tx = await this.addFeeTierTx(signer, feeTier)
    return await signAndSend(signer, tx)
  }

  async removeFeeTierTx(signer: SignerProvider, feeTier: FeeTier) {
    const txBytecode = RemoveFeeTier.script.buildByteCodeToDeploy({
      invariant: this.instance.contractId,
      feeTier
    })
    const { address, publicKey } = await signer.getSelectedAccount()
    const tx = await this.builder.buildExecuteScriptTx(
      { signerAddress: address, bytecode: txBytecode },
      publicKey
    )
    return tx
  }

  async removeFeeTier(signer: SignerProvider, feeTier: FeeTier): Promise<string> {
    const tx = await this.removeFeeTierTx(signer, feeTier)
    return await signAndSend(signer, tx)
  }

  async createPoolTx(
    signer: SignerProvider,
    token0Id: string,
    token1Id: string,
    feeTier: FeeTier,
    initSqrtPrice: bigint
  ) {
    const initTick = await calculateTick(initSqrtPrice, feeTier.tickSpacing)
    const txBytecode = CreatePool.script.buildByteCodeToDeploy({
      invariant: this.instance.contractId,
      token0: token0Id,
      token1: token1Id,
      feeTier,
      initSqrtPrice,
      initTick
    })
    const { address, publicKey } = await signer.getSelectedAccount()
    const tx = await this.builder.buildExecuteScriptTx(
      { signerAddress: address, bytecode: txBytecode, attoAlphAmount: MAP_ENTRY_DEPOSIT * 5n },
      publicKey
    )
    return tx
  }

  async createPool(
    signer: SignerProvider,
    token0Id: string,
    token1Id: string,
    feeTier: FeeTier,
    initSqrtPrice: bigint
  ): Promise<string> {
    const tx = await this.createPoolTx(signer, token0Id, token1Id, feeTier, initSqrtPrice)
    return await signAndSend(signer, tx)
  }

  async withdrawProtocolFeeTx(signer: SignerProvider, poolKey: PoolKey) {
    const txBytecode = WithdrawProtocolFee.script.buildByteCodeToDeploy({
      invariant: this.instance.contractId,
      poolKey
    })
    const { address, publicKey } = await signer.getSelectedAccount()
    const tx = await this.builder.buildExecuteScriptTx(
      { signerAddress: address, bytecode: txBytecode, attoAlphAmount: DUST_AMOUNT * 2n },
      publicKey
    )
    return tx
  }

  async withdrawProtocolFee(signer: SignerProvider, poolKey: PoolKey): Promise<string> {
    const tx = await this.withdrawProtocolFeeTx(signer, poolKey)
    return await signAndSend(signer, tx)
  }

  async changeFeeRecevierTx(signer: SignerProvider, poolKey: PoolKey, newFeeReceiver: Address) {
    const txBytecode = ChangeFeeReceiver.script.buildByteCodeToDeploy({
      invariant: this.instance.contractId,
      poolKey,
      newFeeReceiver
    })
    const { address, publicKey } = await signer.getSelectedAccount()
    const tx = await this.builder.buildExecuteScriptTx(
      { signerAddress: address, bytecode: txBytecode },
      publicKey
    )
    return tx
  }

  async changeFeeReceiver(
    signer: SignerProvider,
    poolKey: PoolKey,
    newFeeReceiver: Address
  ): Promise<string> {
    const tx = await this.changeFeeRecevierTx(signer, poolKey, newFeeReceiver)
    return await signAndSend(signer, tx)
  }

  async changeProtocolFeeTx(signer: SignerProvider, fee: bigint) {
    const txBytecode = ChangeProtocolFee.script.buildByteCodeToDeploy({
      invariant: this.instance.contractId,
      newFee: fee
    })
    const { address, publicKey } = await signer.getSelectedAccount()
    const tx = await this.builder.buildExecuteScriptTx(
      { signerAddress: address, bytecode: txBytecode },
      publicKey
    )
    return tx
  }
  async changeProtocolFee(signer: SignerProvider, fee: bigint): Promise<string> {
    const tx = await this.changeProtocolFeeTx(signer, fee)
    return await signAndSend(signer, tx)
  }

  async createPositionTx(
    signer: SignerProvider,
    poolKey: PoolKey,
    lowerTick: bigint,
    upperTick: bigint,
    liquidityDelta: bigint,
    approvedTokensX: bigint,
    approvedTokensY: bigint,
    slippageLimitLower: bigint,
    slippageLimitUpper: bigint
  ) {
    const txBytecode = CreatePosition.script.buildByteCodeToDeploy({
      invariant: this.instance.contractId,
      poolKey,
      lowerTick,
      upperTick,
      liquidityDelta,
      slippageLimitLower,
      slippageLimitUpper
    })
    const { address, publicKey } = await signer.getSelectedAccount()
    let attoAlphAmount = MAP_ENTRY_DEPOSIT * 6n + DUST_AMOUNT * 2n
    const tokens = [
      { id: poolKey.tokenX, amount: approvedTokensX },
      { id: poolKey.tokenY, amount: approvedTokensY }
    ]
    if (poolKey.tokenX === ALPH_TOKEN_ID) {
      attoAlphAmount += approvedTokensX + DUST_AMOUNT
      tokens.shift()
    }

    const tx = await this.builder.buildExecuteScriptTx(
      {
        signerAddress: address,
        bytecode: txBytecode,
        attoAlphAmount,
        tokens
      },
      publicKey
    )
    return tx
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
    const tx = await this.createPositionTx(
      signer,
      poolKey,
      lowerTick,
      upperTick,
      liquidityDelta,
      approvedTokensX,
      approvedTokensY,
      slippageLimitLower,
      slippageLimitUpper
    )
    return await signAndSend(signer, tx)
  }

  async removePositionTx(signer: SignerProvider, index: bigint) {
    const txBytecode = RemovePosition.script.buildByteCodeToDeploy({
      invariant: this.instance.contractId,
      index
    })
    const { address, publicKey } = await signer.getSelectedAccount()
    const tx = await this.builder.buildExecuteScriptTx(
      { signerAddress: address, bytecode: txBytecode, attoAlphAmount: DUST_AMOUNT * 2n },
      publicKey
    )
    return tx
  }

  async removePosition(signer: SignerProvider, index: bigint): Promise<string> {
    const tx = await this.removePositionTx(signer, index)
    return await signAndSend(signer, tx)
  }

  async claimFeeTx(signer: SignerProvider, index: bigint) {
    const txBytecode = ClaimFee.script.buildByteCodeToDeploy({
      invariant: this.instance.contractId,
      index
    })
    const { address, publicKey } = await signer.getSelectedAccount()
    const tx = await this.builder.buildExecuteScriptTx(
      { signerAddress: address, bytecode: txBytecode, attoAlphAmount: DUST_AMOUNT * 2n },
      publicKey
    )
    return tx
  }

  async claimFee(signer: SignerProvider, index: bigint): Promise<string> {
    const tx = await this.claimFeeTx(signer, index)
    return await signAndSend(signer, tx)
  }

  async transferPositionTx(signer: SignerProvider, index: bigint, recipient: Address) {
    const txBytecode = TransferPosition.script.buildByteCodeToDeploy({
      invariant: this.instance.contractId,
      index,
      recipient
    })
    const { address, publicKey } = await signer.getSelectedAccount()
    const tx = await this.builder.buildExecuteScriptTx(
      { signerAddress: address, bytecode: txBytecode, attoAlphAmount: MAP_ENTRY_DEPOSIT * 2n },
      publicKey
    )
    return tx
  }
  async transferPosition(
    signer: SignerProvider,
    index: bigint,
    recipient: Address
  ): Promise<string> {
    const tx = await this.transferPositionTx(signer, index, recipient)
    return await signAndSend(signer, tx)
  }

  async swapTx(
    signer: SignerProvider,
    poolKey: PoolKey,
    xToY: boolean,
    amount: bigint,
    byAmountIn: boolean,
    sqrtPriceLimit: bigint,
    approvedAmount = amount
  ) {
    const tokenId = xToY ? poolKey.tokenX : poolKey.tokenY
    const txBytecode = Swap.script.buildByteCodeToDeploy({
      invariant: this.instance.contractId,
      poolKey,
      xToY,
      amount,
      byAmountIn,
      sqrtPriceLimit
    })
    const { address, publicKey } = await signer.getSelectedAccount()
    const tx = await this.builder.buildExecuteScriptTx(
      {
        signerAddress: address,
        bytecode: txBytecode,
        tokens: [{ id: tokenId, amount: approvedAmount }],
        attoAlphAmount: DUST_AMOUNT * 2n
      },
      publicKey
    )
    return tx
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
    const tx = await this.swapTx(
      signer,
      poolKey,
      xToY,
      amount,
      byAmountIn,
      sqrtPriceLimit,
      approvedAmount
    )
    return await signAndSend(signer, tx)
  }

  async swapWithSlippageTx(
    signer: SignerProvider,
    poolKey: PoolKey,
    xToY: boolean,
    amount: bigint,
    byAmountIn: boolean,
    estimatedSqrtPrice: bigint,
    slippage: bigint
  ) {
    const sqrtPriceAfterSlippage = calculateSqrtPriceAfterSlippage(
      estimatedSqrtPrice,
      slippage,
      !xToY
    )

    return this.swapTx(
      signer,
      poolKey,
      xToY,
      amount,
      byAmountIn,
      xToY ? sqrtPriceAfterSlippage - 1n : sqrtPriceAfterSlippage + 1n
    )
  }

  async swapWithSlippage(
    signer: SignerProvider,
    poolKey: PoolKey,
    xToY: boolean,
    amount: bigint,
    byAmountIn: boolean,
    estimatedSqrtPrice: bigint,
    slippage: bigint
  ): Promise<string> {
    const tx = await this.swapWithSlippageTx(
      signer,
      poolKey,
      xToY,
      amount,
      byAmountIn,
      estimatedSqrtPrice,
      slippage
    )
    return await signAndSend(signer, tx)
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

  async getPositions(owner: Address, size: bigint, offset: bigint) {
    const response = await this.instance.view.getPositions({
      args: { owner, size, offset }
    })

    return decodePositions(response.returns)
  }
  async getAllPositions(
    owner: string,
    positionsCount?: bigint,
    skipPages?: number[],
    positionsPerPage?: bigint
  ) {
    const firstPageIndex = skipPages?.find(i => !skipPages.includes(i)) || 0
    const positionsPerPageLimit = positionsPerPage || MAX_POSITIONS_QUERIED

    let pages: Page[] = []
    let actualPositionsCount = positionsCount

    if (!positionsCount) {
      const [positions, totalPositions] = await this.getPositions(
        owner,
        positionsPerPageLimit,
        BigInt(firstPageIndex) * positionsPerPageLimit
      )
      pages.push({ index: 0, entries: positions })
      actualPositionsCount = totalPositions
    }

    const promises: Promise<[[Position, Pool][], bigint]>[] = []
    const pageIndexes: number[] = []

    for (
      let i = positionsCount ? firstPageIndex : firstPageIndex + 1;
      i < Math.ceil(Number(actualPositionsCount) / Number(positionsPerPageLimit));
      i++
    ) {
      if (skipPages?.includes(i)) {
        continue
      }
      pageIndexes.push(i)
      promises.push(
        this.getPositions(owner, positionsPerPageLimit, BigInt(i) * positionsPerPageLimit)
      )
    }

    const positionsEntriesList = await Promise.all(promises)
    pages = [
      ...pages,
      ...positionsEntriesList.map(([positionsEntries], index) => {
        return { index: pageIndexes[index], entries: positionsEntries }
      })
    ]

    return pages
  }
  // async getPoolKeys() {}
  async getAllPoolKeys() {
    return decodePoolKeys((await this.instance.view.getAllPoolKeys()).returns)
  }

  // async getPositionTicks() {}
  async getRawTickmap(
    poolKey: PoolKey,
    lowerBatch: bigint,
    upperBatch: bigint,
    xToY: boolean
  ): Promise<[bigint, bigint][]> {
    const response = await this.instance.view.getTickmapSlice({
      args: { poolKey, lowerBatch, upperBatch, xToY }
    })

    return constructTickmap(response.returns)
  }

  async getFullTickmap(poolKey: PoolKey) {
    const promises: Promise<[bigint, bigint][]>[] = []
    const maxBatch = await getMaxBatch(poolKey.feeTier.tickSpacing)
    let currentBatch = 0n

    while (currentBatch <= maxBatch) {
      let nextBatch = currentBatch + MAX_BATCHES_QUERIED
      promises.push(this.getRawTickmap(poolKey, currentBatch, nextBatch, true))
      currentBatch += MAX_BATCHES_QUERIED
    }

    const fullResult: [bigint, bigint][] = (await Promise.all(promises)).flat(1)
    const storedTickmap = new Map<bigint, bigint>(fullResult)
    return { bitmap: storedTickmap }
  }
  // async getLiquidityTicks() {}
  // async getAllLiquidityTicks() {}
  // async getUserPositionAmount() {}
  // async getLiquidityTicksAmount() {}
  async getAllPoolsForPair(token0Id: string, token1Id: string) {
    return decodePools(
      (
        await this.instance.view.getAllPoolsForPair({
          args: { token0: token0Id, token1: token1Id }
        })
      ).returns
    )
  }
}
