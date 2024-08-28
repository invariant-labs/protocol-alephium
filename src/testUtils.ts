import {
  Address,
  ContractInstance,
  DUST_AMOUNT,
  MAP_ENTRY_DEPOSIT,
  SignerProvider,
  addressFromContractId
} from '@alephium/web3'
import {
  AddFeeTier,
  ChangeProtocolFee,
  CreatePool,
  InvariantInstance,
  RemoveFeeTier,
  RemovePosition,
  Swap,
  Withdraw,
  TokenFaucet,
  TokenFaucetInstance,
  WithdrawProtocolFee,
  CreatePosition,
  TransferPosition,
  CLAMMInstance,
  ChangeFeeReceiver
} from '../artifacts/ts'
import { deployTokenFaucet, balanceOf } from './utils'
import { expectAssertionError } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { InvariantError, VMError } from './consts'
import {
  decodePool,
  decodePosition,
  decodeTick,
  FeeTier,
  Pool,
  PoolKey,
  Position,
  Tick,
  unwrapFeeTier,
  unwrapPool,
  unwrapPosition,
  unwrapQuoteResult,
  unwrapTick,
  wrapFeeTier,
  wrapPoolKey
} from './types'
import { wrap } from 'module'

type TokenInstance = TokenFaucetInstance

export async function expectError(
  errorCode: bigint,
  script: Promise<any>,
  contract?: ContractInstance
) {
  if (contract) {
    return await expectAssertionError(script, contract.address, Number(errorCode))
  } else {
    try {
      await script
    } catch (e: any) {
      const err = e.toString()
      if (!err.includes(Number(errorCode).toString())) {
        throw new Error(`Invalid Error message: ${err}`)
      }
    }
  }
}

export async function expectVMError(error: VMError, script: Promise<any>) {
  let isError: boolean = false
  try {
    await script
  } catch (e: unknown) {
    if (e instanceof Error) {
      const regex = new RegExp(error)
      const regexResult = regex.exec(e.message)

      isError = regexResult ? true : false
    }
  }

  expect(isError).toBeTruthy()
}

export async function initTokensXY(signer: SignerProvider, supply: bigint) {
  const token0 = TokenFaucet.at(
    (await deployTokenFaucet(signer, '', '', supply, supply)).contractInstance.address
  )
  const token1 = TokenFaucet.at(
    (await deployTokenFaucet(signer, '', '', supply, supply)).contractInstance.address
  )

  return token0.contractId < token1.contractId ? [token0, token1] : [token1, token0]
}

export async function initFeeTier(
  invariant: InvariantInstance,
  signer: SignerProvider,
  feeTier: FeeTier
) {
  return await AddFeeTier.execute(signer, {
    initialFields: {
      invariant: invariant.contractId,
      feeTier: wrapFeeTier(feeTier)
    },
    attoAlphAmount: MAP_ENTRY_DEPOSIT
  })
}

export async function feeTierExists(invariant: InvariantInstance, ...feeTiers: FeeTier[]) {
  let tierStatus: Array<boolean> = []
  for (const feeTier of feeTiers) {
    tierStatus.push(
      (
        await invariant.view.feeTierExist({
          args: { feeTier: wrapFeeTier(feeTier) }
        })
      ).returns
    )
  }
  return tierStatus
}

export const removeFeeTier = async (
  invariant: InvariantInstance,
  signer: SignerProvider,
  feeTier: FeeTier
) => {
  return await RemoveFeeTier.execute(signer, {
    initialFields: {
      invariant: invariant.contractId,
      feeTier: wrapFeeTier(feeTier)
    }
  })
}

export async function initPool(
  invariant: InvariantInstance,
  signer: SignerProvider,
  token0: TokenInstance,
  token1: TokenInstance,
  feeTier: FeeTier,
  initSqrtPrice: bigint,
  initTick: bigint
) {
  return await CreatePool.execute(signer, {
    initialFields: {
      invariant: invariant.contractId,
      token0: token0.contractId,
      token1: token1.contractId,
      feeTier: wrapFeeTier(feeTier),
      initSqrtPrice: { v: initSqrtPrice },
      initTick
    },
    attoAlphAmount: MAP_ENTRY_DEPOSIT * 5n
  })
}

export const withdrawProtocolFee = async (
  invariant: InvariantInstance,
  signer: SignerProvider,
  poolKey: PoolKey
) => {
  return await WithdrawProtocolFee.execute(signer, {
    initialFields: {
      invariant: invariant.address,
      poolKey: wrapPoolKey(poolKey)
    },
    attoAlphAmount: DUST_AMOUNT
  })
}

export async function withdrawTokens(
  signer: SignerProvider,
  ...tokens: [token: TokenInstance, amount: bigint][]
) {
  for (const [tokenN, amountN] of tokens) {
    await Withdraw.execute(signer, {
      initialFields: {
        token: tokenN.contractId,
        amount: amountN
      },
      attoAlphAmount: DUST_AMOUNT
    })
  }
}

export async function getFeeTiers(invariant: InvariantInstance): Promise<Array<FeeTier>> {
  const state = await invariant.fetchState()
  return state.fields.feeTiers.feeTiers
    .slice(0, Number(state.fields.feeTierCount))
    .map(unwrapFeeTier)
}

export async function getPool(invariant: InvariantInstance, poolKey: PoolKey): Promise<Pool> {
  return decodePool(
    (
      await invariant.view.getPool({
        args: {
          poolKey: wrapPoolKey(poolKey)
        }
      })
    ).returns
  )
}

export async function getPosition(
  invariant: InvariantInstance,
  owner: Address,
  index: bigint
): Promise<Position> {
  return decodePosition(
    (
      await invariant.view.getPosition({
        args: {
          owner,
          index
        }
      })
    ).returns
  )
}

export async function getPositionWithAssociates(
  invariant: InvariantInstance,
  owner: Address,
  index: bigint
): Promise<[Position, Pool, Tick, Tick]> {
  const [position, pool, lowerTick, upperTick] = (
    await invariant.view.getPositionWithAssociates({
      args: { owner, index }
    })
  ).returns
  return [unwrapPosition(position), unwrapPool(pool), unwrapTick(lowerTick), unwrapTick(upperTick)]
}

export const changeProtocolFee = async (
  invariant: InvariantInstance,
  signer: SignerProvider,
  newFee: bigint
) => {
  return await ChangeProtocolFee.execute(signer, {
    initialFields: {
      invariant: invariant.contractId,
      newFee: { v: newFee }
    }
  })
}

export const getProtocolFee = async (invariant: InvariantInstance): Promise<bigint> => {
  return (await invariant.view.getProtocolFee()).returns.v
}

export async function initPosition(
  invariant: InvariantInstance,
  signer: PrivateKeyWallet,
  poolKey: PoolKey,
  approvedTokensX: bigint,
  approvedTokensY: bigint,
  lowerTick: bigint,
  upperTick: bigint,
  liquidityDelta: bigint,
  slippageLimitLower: bigint,
  slippageLimitUpper: bigint
) {
  return await CreatePosition.execute(signer, {
    initialFields: {
      invariant: invariant.contractId,
      poolKey: wrapPoolKey(poolKey),
      lowerTick,
      upperTick,
      liquidityDelta: { v: liquidityDelta },
      slippageLimitLower: { v: slippageLimitLower },
      slippageLimitUpper: { v: slippageLimitUpper }
    },
    tokens: [
      { id: poolKey.tokenX, amount: approvedTokensX },
      { id: poolKey.tokenY, amount: approvedTokensY }
    ],
    attoAlphAmount: MAP_ENTRY_DEPOSIT * 6n + DUST_AMOUNT * 2n
  })
}

export const quote = async (
  invariant: InvariantInstance,
  poolKey: PoolKey,
  xToY: boolean,
  amount: bigint,
  byAmountIn: boolean,
  sqrtPriceLimit: bigint
) => {
  return unwrapQuoteResult(
    (
      await invariant.view.quote({
        args: {
          poolKey: wrapPoolKey(poolKey),
          xToY,
          amount: { v: amount },
          byAmountIn,
          sqrtPriceLimit: { v: sqrtPriceLimit }
        }
      })
    ).returns
  )
}

export const removePosition = async (
  invariant: InvariantInstance,
  signer: SignerProvider,
  index: bigint
) => {
  return await RemovePosition.execute(signer, {
    initialFields: {
      invariant: invariant.contractId,
      index
    }
  })
}

export const transferPosition = async (
  invariant: InvariantInstance,
  signer: SignerProvider,
  index: bigint,
  recipient: Address
) => {
  return await TransferPosition.execute(signer, {
    initialFields: {
      invariant: invariant.contractId,
      index,
      recipient
    },
    attoAlphAmount: 2n * MAP_ENTRY_DEPOSIT
  })
}

// can be removed/replaced after we have GetAllPositions in the sdk
export const verifyPositionList = async (
  invariant: InvariantInstance,
  owner: Address,
  length: bigint,
  isWhole = false
) => {
  for (let n = 0n; n < length; ++n) {
    await getPosition(invariant, owner, n)
  }

  if (isWhole) {
    expectError(InvariantError.PositionNotFound, getPosition(invariant, owner, length))
  }
}

/**  When not using `byAmountIn` set approvedTokens manually via the last parameter. */
export async function initSwap(
  invariant: InvariantInstance,
  signer: SignerProvider,
  poolKey: PoolKey,
  xToY: boolean,
  amount: bigint,
  byAmountIn: boolean,
  sqrtPriceLimit: bigint,
  approvedAmount = amount
) {
  const id = xToY ? poolKey.tokenX : poolKey.tokenY
  return await Swap.execute(signer, {
    initialFields: {
      invariant: invariant.contractId,
      poolKey: wrapPoolKey(poolKey),
      xToY,
      amount: { v: amount },
      byAmountIn,
      sqrtPriceLimit: { v: sqrtPriceLimit }
    },
    tokens: [{ id, amount: approvedAmount }],
    attoAlphAmount: DUST_AMOUNT * 2n
  })
}

export const getTick = async (
  invariant: InvariantInstance,
  poolKey: PoolKey,
  index: bigint
): Promise<Tick> => {
  return decodeTick(
    (
      await invariant.view.getTick({
        args: {
          poolKey: wrapPoolKey(poolKey),
          index
        }
      })
    ).returns
  )
}

export const changeFeeReceiver = async (
  invariant: InvariantInstance,
  signer: SignerProvider,
  poolKey: PoolKey,
  newFeeReceiver: Address
) => {
  return await ChangeFeeReceiver.execute(signer, {
    initialFields: {
      invariant: invariant.contractId,
      poolKey: wrapPoolKey(poolKey),
      newFeeReceiver: newFeeReceiver
    }
  })
}

export const isTickInitialized = async (
  invariant: InvariantInstance,
  poolKey: PoolKey,
  index: bigint
) => {
  return (
    await invariant.view.isTickInitialized({
      args: {
        poolKey: wrapPoolKey(poolKey),
        index
      }
    })
  ).returns
}

export const getReserveAddress = (pool: Pool): [Address, Address] => {
  return [addressFromContractId(pool.reserveX), addressFromContractId(pool.reserveY)]
}

export const getReserveBalances = async (invariant: InvariantInstance, poolKey: PoolKey) => {
  const pool = await getPool(invariant, poolKey)
  const [reserveX, reserveY] = getReserveAddress(pool)
  const x = await balanceOf(poolKey.tokenX, reserveX)
  const y = await balanceOf(poolKey.tokenY, reserveY)
  return { x, y }
}

export const feeGrowthFromFee = async (
  clamm: CLAMMInstance,
  liquidity: bigint,
  fee: bigint
): Promise<bigint> => {
  return (
    await clamm.view.feeGrowthFromFee({ args: { liquidity: { v: liquidity }, fee: { v: fee } } })
  ).returns.v
}

export const calculateSqrtPrice = async (
  clamm: CLAMMInstance | InvariantInstance,
  tickIndex: bigint
): Promise<bigint> => {
  return (
    await clamm.view.calculateSqrtPrice({
      args: { tickIndex }
    })
  ).returns.v
}

export const toFee = async (
  clamm: CLAMMInstance,
  liquidity: bigint,
  feeGrowth: bigint
): Promise<bigint> => {
  return (
    await clamm.view.toFee({
      args: { liquidity: { v: liquidity }, feeGrowth: { v: feeGrowth } }
    })
  ).returns.v
}

export const getTickAtSqrtPrice = async (
  clamm: CLAMMInstance,
  sqrtPrice: bigint,
  tickSpacing: bigint
): Promise<bigint> => {
  return (
    await clamm.view.getTickAtSqrtPrice({
      args: { sqrtPrice: { v: sqrtPrice }, tickSpacing }
    })
  ).returns
}

export const getDeltaX = async (
  clamm: CLAMMInstance,
  sqrtPriceA: bigint,
  sqrtPriceB: bigint,
  liquidity: bigint,
  roundingUp: boolean
): Promise<bigint> => {
  return (
    await clamm.view.getDeltaX({
      args: {
        sqrtPriceA: { v: sqrtPriceA },
        sqrtPriceB: { v: sqrtPriceB },
        liquidity: { v: liquidity },
        roundingUp
      }
    })
  ).returns.v
}

export const getDeltaY = async (
  clamm: CLAMMInstance,
  sqrtPriceA: bigint,
  sqrtPriceB: bigint,
  liquidity: bigint,
  roundingUp: boolean
): Promise<bigint> => {
  return (
    await clamm.view.getDeltaY({
      args: {
        sqrtPriceA: { v: sqrtPriceA },
        sqrtPriceB: { v: sqrtPriceB },
        liquidity: { v: liquidity },
        roundingUp
      }
    })
  ).returns.v
}

export const getNextSqrtPriceYDown = async (
  clamm: CLAMMInstance,
  startingSqrtPrice: bigint,
  liquidity: bigint,
  y: bigint,
  addY: boolean
): Promise<bigint> => {
  return (
    await clamm.view.getNextSqrtPriceYDown({
      args: {
        startingSqrtPrice: { v: startingSqrtPrice },
        liquidity: { v: liquidity },
        y: { v: y },
        addY
      }
    })
  ).returns.v
}

export const calculateMinAmountOut = async (
  clamm: CLAMMInstance,
  expectedAmountOut: bigint,
  slippage: bigint
): Promise<bigint> => {
  return (
    await clamm.view.calculateMinAmountOut({
      args: { expectedAmountOut: { v: expectedAmountOut }, slippage: { v: slippage } }
    })
  ).returns.v
}

export const isEnoughAmountToChangePrice = async (
  clamm: CLAMMInstance,
  amount: bigint,
  startingSqrtPrice: bigint,
  liquidity: bigint,
  fee: bigint,
  byAmountIn: boolean,
  xToY: boolean
): Promise<boolean> => {
  return (
    await clamm.view.isEnoughAmountToChangePrice({
      args: {
        amount: { v: amount },
        startingSqrtPrice: { v: startingSqrtPrice },
        liquidity: { v: liquidity },
        fee: { v: fee },
        byAmountIn,
        xToY
      }
    })
  ).returns
}

export const calculateFeeGrowthInside = async (
  clamm: CLAMMInstance,
  tickLowerIndex: bigint,
  tickLowerFeeGrowthOutsideX: bigint,
  tickLowerFeeGrowthOutsideY: bigint,
  tickUpperIndex: bigint,
  tickUpperFeeGrowthOutsideX: bigint,
  tickUpperFeeGrowthOutsideY: bigint,
  tickCurrent: bigint,
  globalFeeGrowthX: bigint,
  globalFeeGrowthY: bigint
): Promise<[bigint, bigint]> => {
  const returns = (
    await clamm.view.calculateFeeGrowthInside({
      args: {
        tickLowerIndex,
        tickLowerFeeGrowthOutsideX: { v: tickLowerFeeGrowthOutsideX },
        tickLowerFeeGrowthOutsideY: { v: tickLowerFeeGrowthOutsideY },
        tickUpperIndex,
        tickUpperFeeGrowthOutsideX: { v: tickUpperFeeGrowthOutsideX },
        tickUpperFeeGrowthOutsideY: { v: tickUpperFeeGrowthOutsideY },
        tickCurrent,
        globalFeeGrowthX: { v: globalFeeGrowthX },
        globalFeeGrowthY: { v: globalFeeGrowthY }
      }
    })
  ).returns
  return [returns[0].v, returns[1].v]
}

export const calculateAmountDelta = async (
  clamm: CLAMMInstance,
  currentTickIndex: bigint,
  currentSqrtPrice: bigint,
  liquidityDelta: bigint,
  liquiditySign: boolean,
  upperTick: bigint,
  lowerTick: bigint
): Promise<[bigint, bigint, boolean]> => {
  const returns = (
    await clamm.view.calculateAmountDelta({
      args: {
        currentTickIndex,
        currentSqrtPrice: { v: currentSqrtPrice },
        liquidityDelta: { v: liquidityDelta },
        liquiditySign,
        upperTick,
        lowerTick
      }
    })
  ).returns
  return [returns[0].v, returns[1].v, returns[2]]
}

export const getNextSqrtPriceXUp = async (
  clamm: CLAMMInstance,
  startingSqrtPrice: bigint,
  liquidity: bigint,
  x: bigint,
  addX: boolean
): Promise<bigint> => {
  return (
    await clamm.view.getNextSqrtPriceXUp({
      args: {
        startingSqrtPrice: { v: startingSqrtPrice },
        liquidity: { v: liquidity },
        x: { v: x },
        addX
      }
    })
  ).returns.v
}

export const getNextSqrtPriceFromInput = async (
  clamm: CLAMMInstance,
  startingSqrtPrice: bigint,
  liquidity: bigint,
  amount: bigint,
  xToY: boolean
): Promise<bigint> => {
  return (
    await clamm.view.getNextSqrtPriceFromInput({
      args: {
        startingSqrtPrice: { v: startingSqrtPrice },
        liquidity: { v: liquidity },
        amount: { v: amount },
        xToY
      }
    })
  ).returns.v
}

export const getNextSqrtPriceFromOutput = async (
  clamm: CLAMMInstance,
  startingSqrtPrice: bigint,
  liquidity: bigint,
  amount: bigint,
  xToY: boolean
): Promise<bigint> => {
  return (
    await clamm.view.getNextSqrtPriceFromOutput({
      args: {
        startingSqrtPrice: { v: startingSqrtPrice },
        liquidity: { v: liquidity },
        amount: { v: amount },
        xToY
      }
    })
  ).returns.v
}

export const computeSwapStep = async (
  clamm: CLAMMInstance,
  currentSqrtPrice: bigint,
  targetSqrtPrice: bigint,
  liquidity: bigint,
  amount: bigint,
  byAmountIn: boolean,
  fee: bigint
): Promise<{ nextSqrtPrice: bigint; amountIn: bigint; amountOut: bigint; feeAmount: bigint }> => {
  const swapResult = (
    await clamm.view.computeSwapStep({
      args: {
        currentSqrtPrice: { v: currentSqrtPrice },
        targetSqrtPrice: { v: targetSqrtPrice },
        liquidity: { v: liquidity },
        amount: { v: amount },
        byAmountIn,
        fee: { v: fee }
      }
    })
  ).returns
  return {
    nextSqrtPrice: swapResult.nextSqrtPrice.v,
    amountIn: swapResult.amountIn.v,
    amountOut: swapResult.amountOut.v,
    feeAmount: swapResult.feeAmount.v
  }
}

export const calculateMaxLiquidityPerTick = async (
  clamm: CLAMMInstance,
  tickSpacing: bigint
): Promise<bigint> => {
  return (
    await clamm.view.calculateMaxLiquidityPerTick({
      args: { tickSpacing }
    })
  ).returns.v
}
