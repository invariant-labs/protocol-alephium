import { Address, SignerProvider } from '@alephium/web3'
import { InvariantInstance, TokenFaucetInstance } from '../artifacts/ts'
import { MaxSqrtPrice, MinSqrtPrice, PercentageScale } from './consts'
import {
  getPool,
  getReserveBalances,
  getPosition,
  initPool,
  initPosition,
  initSwap,
  initTokensXY,
  toLiquidity,
  transferPosition,
  verifyPositionList,
  withdrawTokens,
  quote
} from './testUtils'
import { balanceOf, deployInvariant, newFeeTier, newPoolKey } from './utils'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { calculateSqrtPrice } from './math'
import { PoolKey } from '../artifacts/ts/types'

type TokenInstance = TokenFaucetInstance

// 0.6% fee
const fee = 6n * 10n ** (PercentageScale - 3n)
const tickSpacing = 10n

export const getBasicFeeTickSpacing = (): [bigint, bigint] => {
  return [fee, tickSpacing]
}

/**  Tokens are already ordered. */
export const initDexAndTokens = async (
  admin: SignerProvider,
  supply = 1000000n
): Promise<[InvariantInstance, TokenFaucetInstance, TokenFaucetInstance]> => {
  // 1%
  const protocolFee = 10n ** (PercentageScale - 2n)
  const invariant = await deployInvariant(admin, protocolFee)
  const [tokenX, tokenY] = await initTokensXY(admin, supply)
  return [invariant, tokenX, tokenY]
}

export const initBasicPool = async (
  invariant: InvariantInstance,
  admin: SignerProvider,
  tokenX: TokenInstance,
  tokenY: TokenInstance
) => {
  const initTick = 0n
  const initSqrtPrice = await calculateSqrtPrice(initTick)
  const feeTier = await newFeeTier(fee, tickSpacing)
  const tx = await initPool(invariant, admin, tokenX, tokenY, feeTier, initSqrtPrice, 0n)
  const poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)
  const pool = await getPool(invariant, poolKey)
  expect(pool).toMatchObject({ poolKey, sqrtPrice: initSqrtPrice, exists: true })
  return tx
}

/**  Requires TokenX and TokenY faucets to have at least 1000 in supply. */
export const initBasicPosition = async (
  invariant: InvariantInstance,
  positionOwner: PrivateKeyWallet,
  tokenX: TokenInstance,
  tokenY: TokenInstance
) => {
  const withdrawAmount = 1000n
  await withdrawTokens(positionOwner, [tokenX, withdrawAmount], [tokenY, withdrawAmount])

  const feeTier = await newFeeTier(fee, tickSpacing)
  const poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

  const poolBefore = await getPool(invariant, poolKey)
  const liquidityDelta = toLiquidity(1000000n)
  const slippageLimit = poolBefore.sqrtPrice
  const [lowerTick, upperTick] = [-20n, 10n]
  const tx = await initPosition(
    invariant,
    positionOwner,
    poolKey,
    withdrawAmount,
    withdrawAmount,
    lowerTick,
    upperTick,
    liquidityDelta,
    slippageLimit,
    slippageLimit
  )
  const poolAfter = await getPool(invariant, poolKey)
  expect(poolAfter.liquidity).toBe(liquidityDelta)
  return tx
}

/**  Requires TokenX and TokenY faucets to have at least 1000 in supply. */
export const initBasicSwap = async (
  invariant: InvariantInstance,
  swapper: PrivateKeyWallet,
  tokenX: TokenInstance,
  tokenY: TokenInstance
) => {
  const feeTier = await newFeeTier(fee, tickSpacing)
  const poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

  const poolBefore = await getPool(invariant, poolKey)

  const swapAmount = 1000n
  await withdrawTokens(swapper, [tokenX, swapAmount])

  const swapperTokenXBalanceBefore = await balanceOf(tokenX.contractId, swapper.address)
  expect(swapperTokenXBalanceBefore).toBe(swapAmount)

  const invariantBeforeBalance = await getReserveBalances(invariant, poolKey)
  expect(invariantBeforeBalance).toMatchObject({ x: 500n, y: 1000n })

  const tx = await initSwap(invariant, swapper, poolKey, true, swapAmount, true, MinSqrtPrice)

  const swapperAfterBalance = {
    tokenX: await balanceOf(tokenX.contractId, swapper.address),
    tokenY: await balanceOf(tokenY.contractId, swapper.address)
  }
  expect(swapperAfterBalance).toMatchObject({ tokenX: 0n, tokenY: 993n })

  const invariantAfterBalance = await getReserveBalances(invariant, poolKey)
  expect(invariantAfterBalance).toMatchObject({ x: 1500n, y: 7n })

  const poolAfter = await getPool(invariant, poolKey)
  const poolExpected = {
    liquidity: poolBefore.liquidity,
    sqrtPrice: 999006987054867461743028n,
    currentTickIndex: -20n,
    feeGrowthGlobalX: 5n * 10n ** 22n,
    feeGrowthGlobalY: 0n,
    feeProtocolTokenX: 1n,
    feeProtocolTokenY: 0n
  }
  expect(poolAfter).toMatchObject(poolExpected)
  return tx
}

export const swapExactLimit = async (
  invariant: InvariantInstance,
  signer: SignerProvider,
  poolKey: PoolKey,
  xToY: boolean,
  amount: bigint,
  byAmountIn: boolean
) => {
  const sqrtPriceLimit: bigint = xToY ? MinSqrtPrice : MaxSqrtPrice

  console.log(`Sqrt price limit: ${sqrtPriceLimit}`)

  const quoteResult = await quote(invariant, poolKey, xToY, amount, byAmountIn, sqrtPriceLimit)

  await initSwap(invariant, signer, poolKey, xToY, amount, byAmountIn, quoteResult.targetSqrtPrice)
}

export const transferAndVerifyPosition = async (
  invariant: InvariantInstance,
  owner: PrivateKeyWallet,
  ownerListLength: bigint,
  index: bigint,
  recipient: Address,
  recipientListLength: bigint
) => {
  expect(index).toBeLessThanOrEqual(ownerListLength)
  verifyPositionList(invariant, owner.address, ownerListLength)
  verifyPositionList(invariant, recipient, recipientListLength)

  const { owner: previousOwner, ...toTransfer } = await getPosition(invariant, owner.address, index)
  const ownerLastPositionBefore = await getPosition(invariant, owner.address, ownerListLength)
  await transferPosition(invariant, owner, index, recipient)
  const transferredPosition = await getPosition(invariant, recipient, recipientListLength + 1n)
  const ownerAtIndexPositionAfter = await getPosition(invariant, owner.address, index)

  expect(transferredPosition).toStrictEqual({ owner: recipient, ...toTransfer })
  if (index != ownerListLength) {
    expect(ownerAtIndexPositionAfter).toStrictEqual(ownerLastPositionBefore)
  }
  verifyPositionList(invariant, owner.address, ownerListLength - 1n)
  verifyPositionList(invariant, recipient, recipientListLength + 1n)
}
