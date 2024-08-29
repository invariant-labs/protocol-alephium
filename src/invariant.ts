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
import { bitPositionToTick, calculateSqrtPriceAfterSlippage, calculateTick } from './math'
import { Network } from './network'
import { getReserveAddress } from './testUtils'
import {
  decodePool,
  decodePosition,
  decodeTick,
  FeeTier,
  Liquidity,
  LiquidityTick,
  Percentage,
  Pool,
  PoolKey,
  Position,
  QuoteResult,
  SqrtPrice,
  Tick,
  Tickmap,
  TokenAmount,
  unwrapFeeTier,
  unwrapPool,
  unwrapPoolKey,
  unwrapPosition,
  unwrapQuoteResult,
  unwrapTick,
  wrapFeeTier,
  wrapPoolKey
} from './types'
import {
  balanceOf,
  EMPTY_FEE_TIERS,
  deployCLAMM,
  deployReserve,
  waitTxConfirmed,
  constructTickmap,
  getMaxBatch,
  decodePools,
  decodePoolKeys,
  getNodeUrl,
  signAndSend,
  decodePositions,
  Page,
  toByteVecWithOffset,
  decodeLiquidityTicks
} from './utils'
import {
  CHUNK_SIZE,
  MAX_BATCHES_QUERIED,
  MAX_LIQUIDITY_TICKS_QUERIED,
  MAX_POOL_KEYS_QUERIED,
  MAX_POSITIONS_QUERIED
} from './consts'
import {
  Address,
  ALPH_TOKEN_ID,
  DUST_AMOUNT,
  MAP_ENTRY_DEPOSIT,
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
    protocolFee: Percentage = 0n as Percentage
  ): Promise<Invariant> {
    const account = await signer.getSelectedAccount()
    const clamm = await deployCLAMM(signer)
    const reserve = await deployReserve(signer)
    const deployResult = await waitTxConfirmed(
      InvariantFactory.deploy(signer, {
        initialFields: {
          config: { admin: account.address, protocolFee: { v: protocolFee } },
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
      feeTier: wrapFeeTier(feeTier)
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
      feeTier: wrapFeeTier(feeTier)
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
    initSqrtPrice: SqrtPrice
  ) {
    const initTick = await calculateTick(initSqrtPrice, feeTier.tickSpacing)
    const txBytecode = CreatePool.script.buildByteCodeToDeploy({
      invariant: this.instance.contractId,
      token0: token0Id,
      token1: token1Id,
      feeTier: wrapFeeTier(feeTier),
      initSqrtPrice: { v: initSqrtPrice },
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
    initSqrtPrice: SqrtPrice
  ): Promise<string> {
    const tx = await this.createPoolTx(signer, token0Id, token1Id, feeTier, initSqrtPrice)
    return await signAndSend(signer, tx)
  }

  async withdrawProtocolFeeTx(signer: SignerProvider, poolKey: PoolKey) {
    const txBytecode = WithdrawProtocolFee.script.buildByteCodeToDeploy({
      invariant: this.instance.contractId,
      poolKey: wrapPoolKey(poolKey)
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

  async changeFeeReceiverTx(signer: SignerProvider, poolKey: PoolKey, newFeeReceiver: Address) {
    const txBytecode = ChangeFeeReceiver.script.buildByteCodeToDeploy({
      invariant: this.instance.contractId,
      poolKey: wrapPoolKey(poolKey),
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
    const tx = await this.changeFeeReceiverTx(signer, poolKey, newFeeReceiver)
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
    liquidityDelta: Liquidity,
    approvedTokensX: TokenAmount,
    approvedTokensY: TokenAmount,
    slippageLimitLower: SqrtPrice,
    slippageLimitUpper: SqrtPrice
  ) {
    const txBytecode = CreatePosition.script.buildByteCodeToDeploy({
      invariant: this.instance.contractId,
      poolKey: wrapPoolKey(poolKey),
      lowerTick,
      upperTick,
      liquidityDelta: { v: liquidityDelta },
      slippageLimitLower: { v: slippageLimitLower },
      slippageLimitUpper: { v: slippageLimitUpper }
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
    liquidityDelta: Liquidity,
    approvedTokensX: TokenAmount,
    approvedTokensY: TokenAmount,
    slippageLimitLower: SqrtPrice,
    slippageLimitUpper: SqrtPrice
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
    amount: TokenAmount,
    byAmountIn: boolean,
    sqrtPriceLimit: SqrtPrice,
    approvedAmount = amount
  ) {
    const tokenId = xToY ? poolKey.tokenX : poolKey.tokenY
    const txBytecode = Swap.script.buildByteCodeToDeploy({
      invariant: this.instance.contractId,
      poolKey: wrapPoolKey(poolKey),
      xToY,
      amount: { v: amount },
      byAmountIn,
      sqrtPriceLimit: { v: sqrtPriceLimit }
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
    amount: TokenAmount,
    byAmountIn: boolean,
    sqrtPriceLimit: SqrtPrice,
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
    amount: TokenAmount,
    byAmountIn: boolean,
    estimatedSqrtPrice: SqrtPrice,
    slippage: Percentage
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
      (xToY ? sqrtPriceAfterSlippage - 1n : sqrtPriceAfterSlippage + 1n) as SqrtPrice
    )
  }

  async swapWithSlippage(
    signer: SignerProvider,
    poolKey: PoolKey,
    xToY: boolean,
    amount: TokenAmount,
    byAmountIn: boolean,
    estimatedSqrtPrice: SqrtPrice,
    slippage: Percentage
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
    return (await this.instance.view.feeTierExist({ args: { feeTier: wrapFeeTier(feeTier) } }))
      .returns
  }

  async getFeeTiers(): Promise<FeeTier[]> {
    const state = await this.instance.fetchState()
    return state.fields.feeTiers.feeTiers
      .slice(0, Number(state.fields.feeTierCount))
      .map(unwrapFeeTier)
  }

  async getPool(poolKey: PoolKey): Promise<Pool> {
    return decodePool(
      (await this.instance.view.getPool({ args: { poolKey: wrapPoolKey(poolKey) } })).returns
    )
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
    const quoteResult = (
      await this.instance.view.quote({
        args: {
          poolKey: wrapPoolKey(poolKey),
          xToY,
          amount: { v: amount },
          byAmountIn,
          sqrtPriceLimit: { v: sqrtPriceLimit }
        }
      })
    ).returns
    return unwrapQuoteResult(quoteResult)
  }

  async getTick(poolKey: PoolKey, index: bigint): Promise<Tick> {
    return decodeTick(
      (await this.instance.view.getTick({ args: { poolKey: wrapPoolKey(poolKey), index } })).returns
    )
  }

  async isTickInitialized(poolKey: PoolKey, index: bigint): Promise<boolean> {
    return (
      await this.instance.view.isTickInitialized({ args: { poolKey: wrapPoolKey(poolKey), index } })
    ).returns
  }

  async getReserveBalances(poolKey: PoolKey): Promise<{ x: bigint; y: bigint }> {
    const pool = await this.getPool(poolKey)
    const [reserveX, reserveY] = getReserveAddress(pool)
    const x = await balanceOf(poolKey.tokenX, reserveX)
    const y = await balanceOf(poolKey.tokenY, reserveY)
    return { x, y }
  }

  async getProtocolFee(): Promise<bigint> {
    return (await this.instance.view.getProtocolFee()).returns.v
  }

  async getPoolKeys(size: bigint, offset: bigint): Promise<[PoolKey[], bigint]> {
    const response = await this.instance.view.getPoolKeys({
      args: { size, offset }
    })

    const [serializedPoolKeys, totalPoolKeys] = response.returns
    return [decodePoolKeys(serializedPoolKeys), totalPoolKeys]
  }
  async getPositions(owner: Address, size: bigint, offset: bigint) {
    const response = await this.instance.view.getPositions({
      args: { owner, size, offset }
    })

    return decodePositions(response.returns)
  }

  async getPositionWithAssociates(
    owner: Address,
    index: bigint
  ): Promise<[Position, Pool, Tick, Tick]> {
    const [position, pool, lowerTick, upperTick] = (
      await this.instance.view.getPositionWithAssociates({
        args: { owner, index }
      })
    ).returns
    return [
      unwrapPosition(position),
      unwrapPool(pool),
      unwrapTick(lowerTick),
      unwrapTick(upperTick)
    ]
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

  async getAllPoolKeys() {
    const [poolKeys, poolKeysCount] = await this.getPoolKeys(MAX_POOL_KEYS_QUERIED, 0n)

    const promises: Promise<[PoolKey[], bigint]>[] = []
    for (let i = 1; i < Math.ceil(Number(poolKeysCount) / Number(MAX_POOL_KEYS_QUERIED)); i++) {
      promises.push(this.getPoolKeys(MAX_POOL_KEYS_QUERIED, BigInt(i) * MAX_POOL_KEYS_QUERIED))
    }

    const poolKeysEntries = await Promise.all(promises)
    return [...poolKeys, ...poolKeysEntries.map(([poolKeys]) => poolKeys).flat()]
  }

  async getRawTickmap(
    poolKey: PoolKey,
    lowerBatch: bigint,
    upperBatch: bigint,
    xToY: boolean
  ): Promise<[bigint, bigint][]> {
    const response = await this.instance.view.getTickmapSlice({
      args: { poolKey: wrapPoolKey(poolKey), lowerBatch, upperBatch, xToY }
    })

    return constructTickmap(response.returns)
  }

  async getFullTickmap(poolKey: PoolKey): Promise<Tickmap> {
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
    return storedTickmap
  }

  async getLiquidityTicks(poolKey: PoolKey, ticks: bigint[]) {
    const indexes = toByteVecWithOffset(ticks)
    const response = await this.instance.view.getLiquidityTicks({
      args: { poolKey: wrapPoolKey(poolKey), indexes, length: BigInt(ticks.length) }
    })

    return decodeLiquidityTicks(response.returns)
  }

  async getAllLiquidityTicks(poolKey: PoolKey, tickmap: Tickmap) {
    const tickIndexes: bigint[] = []
    for (const [chunkIndex, chunk] of tickmap.entries()) {
      for (let bit = 0n; bit < CHUNK_SIZE; bit++) {
        const checkedBit = chunk & (1n << bit)
        if (checkedBit) {
          const tickIndex = await bitPositionToTick(chunkIndex, bit, poolKey.feeTier.tickSpacing)
          tickIndexes.push(tickIndex)
        }
      }
    }
    const limit = Number(MAX_LIQUIDITY_TICKS_QUERIED)
    const promises: Promise<LiquidityTick[]>[] = []
    for (let i = 0; i < tickIndexes.length; i += limit) {
      promises.push(this.getLiquidityTicks(poolKey, tickIndexes.slice(i, i + limit)))
    }

    const liquidityTicks = await Promise.all(promises)
    return liquidityTicks.flat()
  }

  async getLiquidityTicksAmount(poolKey: PoolKey, lowerTick: bigint, upperTick: bigint) {
    const response = await this.instance.view.getLiquidityTicksAmount({
      args: { poolKey: wrapPoolKey(poolKey), lowerTick, upperTick }
    })
    return response.returns
  }
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
