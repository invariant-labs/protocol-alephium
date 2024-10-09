import {
  AddFeeTier,
  ChangeFeeReceiver,
  ChangeProtocolFee,
  ClaimFee,
  CreatePool,
  CreatePosition,
  Invariant as InvariantFactory,
  CLAMM as CLAMMFactory,
  InvariantInstance,
  RemoveFeeTier,
  RemovePosition,
  Swap,
  TransferPosition,
  WithdrawProtocolFee,
  CLAMM,
  CreatePoolAndPosition
} from '../artifacts/ts'
import { PoolKey as _PoolKey } from '../artifacts/ts/types'
import {
  bitPositionToTick,
  calculateSqrtPriceAfterSlippage,
  calculateTick,
  getMaxSqrtPrice,
  getMinSqrtPrice
} from './math'
import { getReserveAddress } from './testUtils'
import {
  decodePool,
  decodePosition,
  decodeTick,
  FeeTier,
  Liquidity,
  Options,
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
  unwrapPosition,
  unwrapQuoteResult,
  unwrapTick,
  wrapFeeTier,
  wrapPoolKey
} from './types'
import {
  balanceOf,
  EMPTY_FEE_TIERS,
  deployReserve,
  waitTxConfirmed,
  constructTickmap,
  getMaxBatch,
  decodePools,
  decodePoolKeys,
  signAndSend,
  decodePositions,
  Page,
  toByteVecWithOffset,
  decodeLiquidityTicks
} from './utils'
import {
  CHUNK_SIZE,
  CONFIRMATIONS,
  DEFAULT_OPTIONS,
  MAX_BATCHES_QUERIED,
  MAX_LIQUIDITY_TICKS_QUERIED,
  MAX_POOL_KEYS_RETURNED,
  POSITIONS_ENTRIES_LIMIT,
  REQUEST_INTERVAL
} from './consts'
import {
  Address,
  addressFromContractId,
  ALPH_TOKEN_ID,
  DUST_AMOUNT,
  MAP_ENTRY_DEPOSIT,
  SignerProvider,
  TransactionBuilder,
  waitForTxConfirmation,
  web3
} from '@alephium/web3'

export class Invariant {
  instance: InvariantInstance
  address: Address

  private constructor(address: Address) {
    this.address = address
    this.instance = InvariantFactory.at(address)
  }

  static async deploy(
    deployer: SignerProvider,
    protocolFee: Percentage = 0n as Percentage
  ): Promise<Invariant> {
    const account = await deployer.getSelectedAccount()
    const clammContractId = (
      await waitTxConfirmed(
        CLAMM.deploy(deployer, {
          initialFields: { admin: account.address }
        })
      )
    ).contractInstance.contractId
    const reserve = await deployReserve(deployer)
    const deployResult = await waitTxConfirmed(
      InvariantFactory.deploy(deployer, {
        initialFields: {
          config: { admin: account.address, protocolFee: { v: protocolFee } },
          reserveTemplateId: reserve.contractId,
          feeTiers: EMPTY_FEE_TIERS,
          lastReserveId: reserve.contractId,
          clamm: clammContractId,
          feeTierCount: 0n,
          poolKeyCount: 0n
        }
      })
    )

    return new Invariant(deployResult.contractInstance.address)
  }

  static async load(address: Address): Promise<Invariant> {
    return new Invariant(address)
  }

  static getCode(): { invariant: string; clamm: string } {
    return { invariant: InvariantFactory.contract.bytecode, clamm: CLAMMFactory.contract.bytecode }
  }

  async upgradeCode(signer: SignerProvider, code: { invariant: string; clamm: string }) {
    await this.instance.transact.upgrade({
      signer,
      args: {
        bytecode: code.invariant
      },
      attoAlphAmount: 2n * DUST_AMOUNT
    })

    const clamm = CLAMMFactory.at(
      addressFromContractId((await this.instance.fetchState()).fields.clamm)
    )
    await clamm.transact.upgrade({
      signer,
      args: {
        bytecode: code.clamm
      },
      attoAlphAmount: 2n * DUST_AMOUNT
    })
  }

  async addFeeTier(
    signer: SignerProvider,
    feeTier: FeeTier,
    options: Options = DEFAULT_OPTIONS
  ): Promise<string> {
    const result = await AddFeeTier.execute(signer, {
      initialFields: { invariant: this.instance.contractId, feeTier: wrapFeeTier(feeTier) },
      attoAlphAmount: MAP_ENTRY_DEPOSIT
    })

    if (options.waitForTxConfirmation) {
      await waitForTxConfirmation(result.txId, CONFIRMATIONS, REQUEST_INTERVAL)
    }

    return result.txId
  }

  async removeFeeTier(
    signer: SignerProvider,
    feeTier: FeeTier,
    options: Options = DEFAULT_OPTIONS
  ): Promise<string> {
    const result = await RemoveFeeTier.execute(signer, {
      initialFields: { invariant: this.instance.contractId, feeTier: wrapFeeTier(feeTier) }
    })

    if (options.waitForTxConfirmation) {
      await waitForTxConfirmation(result.txId, CONFIRMATIONS, REQUEST_INTERVAL)
    }

    return result.txId
  }

  async createPool(
    signer: SignerProvider,
    poolKey: PoolKey,
    initSqrtPrice: SqrtPrice,
    options: Options = DEFAULT_OPTIONS
  ): Promise<string> {
    const result = await CreatePool.execute(signer, {
      initialFields: {
        invariant: this.instance.contractId,
        token0: poolKey.tokenX,
        token1: poolKey.tokenY,
        feeTier: wrapFeeTier(poolKey.feeTier),
        initSqrtPrice: { v: initSqrtPrice },
        initTick: calculateTick(initSqrtPrice, poolKey.feeTier.tickSpacing)
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT * 5n
    })

    if (options.waitForTxConfirmation) {
      await waitForTxConfirmation(result.txId, CONFIRMATIONS, REQUEST_INTERVAL)
    }

    return result.txId
  }

  async withdrawProtocolFee(
    signer: SignerProvider,
    poolKey: PoolKey,
    options: Options = DEFAULT_OPTIONS
  ): Promise<string> {
    const result = await WithdrawProtocolFee.execute(signer, {
      initialFields: { invariant: this.instance.contractId, poolKey: wrapPoolKey(poolKey) },
      attoAlphAmount: DUST_AMOUNT * 2n
    })

    if (options.waitForTxConfirmation) {
      await waitForTxConfirmation(result.txId, CONFIRMATIONS, REQUEST_INTERVAL)
    }

    return result.txId
  }

  async changeFeeReceiver(
    signer: SignerProvider,
    poolKey: PoolKey,
    newFeeReceiver: Address,
    options: Options = DEFAULT_OPTIONS
  ): Promise<string> {
    const result = await ChangeFeeReceiver.execute(signer, {
      initialFields: {
        invariant: this.instance.contractId,
        poolKey: wrapPoolKey(poolKey),
        newFeeReceiver
      }
    })

    if (options.waitForTxConfirmation) {
      await waitForTxConfirmation(result.txId, CONFIRMATIONS, REQUEST_INTERVAL)
    }

    return result.txId
  }

  async changeProtocolFee(signer: SignerProvider, fee: bigint, options: Options = DEFAULT_OPTIONS) {
    const result = await ChangeProtocolFee.execute(signer, {
      initialFields: { invariant: this.instance.contractId, newFee: { v: fee } }
    })

    if (options.waitForTxConfirmation) {
      await waitForTxConfirmation(result.txId, CONFIRMATIONS, REQUEST_INTERVAL)
    }

    return result.txId
  }

  async createPosition(
    signer: SignerProvider,
    poolKey: PoolKey,
    lowerTick: bigint,
    upperTick: bigint,
    liquidityDelta: Liquidity,
    approvedTokensX: TokenAmount,
    approvedTokensY: TokenAmount,
    spotSqrtPrice: SqrtPrice,
    slippageTolerance: Percentage,
    options: Options = DEFAULT_OPTIONS
  ) {
    const slippageLimitLower = calculateSqrtPriceAfterSlippage(
      spotSqrtPrice,
      slippageTolerance,
      false
    )
    const slippageLimitUpper = calculateSqrtPriceAfterSlippage(
      spotSqrtPrice,
      slippageTolerance,
      true
    )

    const result = await CreatePosition.execute(signer, {
      initialFields: {
        invariant: this.instance.contractId,
        poolKey: wrapPoolKey(poolKey),
        lowerTick,
        upperTick,
        liquidityDelta: { v: liquidityDelta },
        slippageLimitLower: { v: slippageLimitLower },
        slippageLimitUpper: { v: slippageLimitUpper }
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT * 6n + DUST_AMOUNT * 2n,
      tokens: [
        { id: poolKey.tokenX, amount: approvedTokensX },
        { id: poolKey.tokenY, amount: approvedTokensY }
      ]
    })

    if (options.waitForTxConfirmation) {
      await waitForTxConfirmation(result.txId, CONFIRMATIONS, REQUEST_INTERVAL)
    }

    return result.txId
  }

  async removePosition(signer: SignerProvider, index: bigint, options: Options = DEFAULT_OPTIONS) {
    const result = await RemovePosition.execute(signer, {
      initialFields: { invariant: this.instance.contractId, index }
    })

    if (options.waitForTxConfirmation) {
      await waitForTxConfirmation(result.txId, CONFIRMATIONS, REQUEST_INTERVAL)
    }

    return result.txId
  }

  async claimFee(
    signer: SignerProvider,
    index: bigint,
    options: Options = DEFAULT_OPTIONS
  ): Promise<string> {
    const result = await ClaimFee.execute(signer, {
      initialFields: { invariant: this.instance.contractId, index },
      attoAlphAmount: DUST_AMOUNT * 2n
    })

    if (options.waitForTxConfirmation) {
      await waitForTxConfirmation(result.txId, CONFIRMATIONS, REQUEST_INTERVAL)
    }

    return result.txId
  }

  async transferPosition(
    signer: SignerProvider,
    index: bigint,
    recipient: Address,
    options: Options = DEFAULT_OPTIONS
  ) {
    const result = await TransferPosition.execute(signer, {
      initialFields: { invariant: this.instance.contractId, index, recipient },
      attoAlphAmount: MAP_ENTRY_DEPOSIT * 2n
    })

    if (options.waitForTxConfirmation) {
      await waitForTxConfirmation(result.txId, CONFIRMATIONS, REQUEST_INTERVAL)
    }

    return result.txId
  }

  async swap(
    signer: SignerProvider,
    poolKey: PoolKey,
    xToY: boolean,
    amount: TokenAmount,
    byAmountIn: boolean,
    sqrtPriceLimit: SqrtPrice,
    approvedAmount = amount,
    options: Options = DEFAULT_OPTIONS
  ) {
    const result = await Swap.execute(signer, {
      initialFields: {
        invariant: this.instance.contractId,
        poolKey: wrapPoolKey(poolKey),
        xToY,
        amount: { v: amount },
        byAmountIn,
        sqrtPriceLimit: { v: sqrtPriceLimit }
      },
      tokens: [{ id: xToY ? poolKey.tokenX : poolKey.tokenY, amount: approvedAmount }],
      attoAlphAmount: DUST_AMOUNT * 2n
    })

    if (options.waitForTxConfirmation) {
      await waitForTxConfirmation(result.txId, CONFIRMATIONS, REQUEST_INTERVAL)
    }

    return result.txId
  }

  async swapWithSlippage(
    signer: SignerProvider,
    poolKey: PoolKey,
    xToY: boolean,
    amount: TokenAmount,
    byAmountIn: boolean,
    estimatedSqrtPrice: SqrtPrice,
    slippage: Percentage,
    approvedAmount: TokenAmount = amount,
    options: Options = DEFAULT_OPTIONS
  ) {
    return await this.swap(
      signer,
      poolKey,
      xToY,
      amount,
      byAmountIn,
      calculateSqrtPriceAfterSlippage(estimatedSqrtPrice, slippage, !xToY),
      approvedAmount,
      options
    )
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
    sqrtPriceLimit?: bigint
  ): Promise<QuoteResult> {
    const _sqrtPriceLimit =
      (sqrtPriceLimit ?? xToY)
        ? getMinSqrtPrice(poolKey.feeTier.tickSpacing)
        : getMaxSqrtPrice(poolKey.feeTier.tickSpacing)
    const quoteResult = (
      await this.instance.view.quote({
        args: {
          poolKey: wrapPoolKey(poolKey),
          xToY,
          amount: { v: amount },
          byAmountIn,
          sqrtPriceLimit: { v: _sqrtPriceLimit }
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

  async getProtocolFee(): Promise<Percentage> {
    return (await this.instance.view.getProtocolFee()).returns.v as Percentage
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
    const positionsPerPageLimit = positionsPerPage || POSITIONS_ENTRIES_LIMIT

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

    const calls: { getPositions: { args: { owner: string; size: bigint; offset: bigint } } }[] = []
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
      calls.push({
        getPositions: {
          args: {
            owner,
            size: positionsPerPageLimit,
            offset: BigInt(i) * positionsPerPageLimit
          }
        }
      })
    }

    const positionsEntriesList: [[Position, Pool][], bigint][] = (
      await this.instance.multicall(...calls)
    ).map(response => {
      return decodePositions(response.getPositions.returns)
    })

    pages = [
      ...pages,
      ...positionsEntriesList.map(([positionsEntries], index) => {
        return { index: pageIndexes[index], entries: positionsEntries }
      })
    ]

    return pages
  }

  async getAllPoolKeys() {
    const [poolKeys, poolKeysCount] = await this.getPoolKeys(MAX_POOL_KEYS_RETURNED, 0n)

    const calls: { getPoolKeys: { args: { size: bigint; offset: bigint } } }[] = []
    for (let i = 1; i < Math.ceil(Number(poolKeysCount) / Number(MAX_POOL_KEYS_RETURNED)); i++) {
      calls.push({
        getPoolKeys: {
          args: { size: MAX_POOL_KEYS_RETURNED, offset: BigInt(i) * MAX_POOL_KEYS_RETURNED }
        }
      })
    }

    const poolKeysEntries: PoolKey[] = (await this.instance.multicall(...calls))
      .map(response => {
        const [serializedPoolKeys] = response.getPoolKeys.returns
        return decodePoolKeys(serializedPoolKeys)
      })
      .flat()
    return [...poolKeys, ...poolKeysEntries]
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
    const calls: {
      getTickmapSlice: {
        args: { poolKey: _PoolKey; lowerBatch: bigint; upperBatch: bigint; xToY: boolean }
      }
    }[] = []
    const maxBatch = getMaxBatch(poolKey.feeTier.tickSpacing)
    let currentBatch = 0n

    while (currentBatch <= maxBatch) {
      let nextBatch = currentBatch + MAX_BATCHES_QUERIED
      calls.push({
        getTickmapSlice: {
          args: {
            poolKey: wrapPoolKey(poolKey),
            lowerBatch: currentBatch,
            upperBatch: nextBatch,
            xToY: true
          }
        }
      })
      currentBatch += MAX_BATCHES_QUERIED
    }

    const fullResult: [bigint, bigint][] = (await this.instance.multicall(...calls))
      .map(response => {
        return constructTickmap(response.getTickmapSlice.returns)
      })
      .flat(1)
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
          const tickIndex = bitPositionToTick(chunkIndex, bit, poolKey.feeTier.tickSpacing)
          tickIndexes.push(tickIndex)
        }
      }
    }
    const limit = Number(MAX_LIQUIDITY_TICKS_QUERIED)
    const calls: {
      getLiquidityTicks: { args: { poolKey: _PoolKey; indexes: string; length: bigint } }
    }[] = []
    for (let i = 0; i < tickIndexes.length; i += limit) {
      const slice = tickIndexes.slice(i, i + limit)
      const indexes = toByteVecWithOffset(slice)
      calls.push({
        getLiquidityTicks: {
          args: { poolKey: wrapPoolKey(poolKey), indexes, length: BigInt(slice.length) }
        }
      })
    }

    const liquidityTicks = (await this.instance.multicall(...calls))
      .map(response => {
        return decodeLiquidityTicks(response.getLiquidityTicks.returns)
      })
      .flat()
    return liquidityTicks
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

  async createPoolAndPosition(
    signer: SignerProvider,
    poolKey: PoolKey,
    initSqrtPrice: SqrtPrice,
    lowerTick: bigint,
    upperTick: bigint,
    liquidityDelta: Liquidity,
    approvedTokensX: TokenAmount,
    approvedTokensY: TokenAmount,
    spotSqrtPrice: SqrtPrice,
    slippageTolerance: Percentage,
    options: Options = DEFAULT_OPTIONS
  ) {
    const slippageLimitLower = calculateSqrtPriceAfterSlippage(
      spotSqrtPrice,
      slippageTolerance,
      false
    )
    const slippageLimitUpper = calculateSqrtPriceAfterSlippage(
      spotSqrtPrice,
      slippageTolerance,
      true
    )

    const result = await CreatePoolAndPosition.execute(signer, {
      initialFields: {
        invariant: this.instance.contractId,
        poolKey: wrapPoolKey(poolKey),
        initSqrtPrice: { v: initSqrtPrice },
        initTick: calculateTick(initSqrtPrice, poolKey.feeTier.tickSpacing),
        lowerTick,
        upperTick,
        liquidityDelta: { v: liquidityDelta },
        slippageLimitLower: { v: slippageLimitLower },
        slippageLimitUpper: { v: slippageLimitUpper }
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT * 11n + DUST_AMOUNT * 2n,
      tokens: [
        { id: poolKey.tokenX, amount: approvedTokensX },
        { id: poolKey.tokenY, amount: approvedTokensY }
      ]
    })

    if (options.waitForTxConfirmation) {
      await waitForTxConfirmation(result.txId, CONFIRMATIONS, REQUEST_INTERVAL)
    }

    return result.txId
  }
}
