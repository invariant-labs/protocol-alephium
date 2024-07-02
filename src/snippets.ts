import { SignerProvider } from '@alephium/web3'
import { InvariantInstance, TokenFaucetInstance } from '../artifacts/ts'
import { LiquidityScale, MinSqrtPrice, PercentageScale } from './consts'
import {
  getPool,
  initPool,
  initPosition,
  initSwap,
  initTokensXY,
  withdrawTokens
} from './testUtils'
import { balanceOf, deployInvariant, newFeeTier, newPoolKey } from './utils'
import { PrivateKeyWallet } from '@alephium/web3-wallet'

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
  const initSqrtPrice = 10n ** 24n
  const feeTier = await newFeeTier(fee, tickSpacing)
  await initPool(invariant, admin, tokenX, tokenY, feeTier, initSqrtPrice, 0n)
  const poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)
  const pool = await getPool(invariant, poolKey)
  expect(pool).toMatchObject({ poolKey, sqrtPrice: initSqrtPrice, exist: true })
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
  const liquidityDelta = 1000000n * 10n ** LiquidityScale
  const slippageLimit = poolBefore.sqrtPrice
  const [lowerTick, upperTick] = [-20n, 10n]
  await initPosition(
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

  const invariantBeforeBalance = {
    tokenX: await balanceOf(tokenX.contractId, invariant.address),
    tokenY: await balanceOf(tokenY.contractId, invariant.address)
  }
  expect(invariantBeforeBalance).toMatchObject({ tokenX: 500n, tokenY: 1000n })

  await initSwap(invariant, swapper, poolKey, true, swapAmount, true, MinSqrtPrice)

  const swapperAfterBalance = {
    tokenX: await balanceOf(tokenX.contractId, swapper.address),
    tokenY: await balanceOf(tokenY.contractId, swapper.address)
  }
  expect(swapperAfterBalance).toMatchObject({ tokenX: 0n, tokenY: 993n })

  const invariantAfterBalance = {
    tokenX: await balanceOf(tokenX.contractId, invariant.address),
    tokenY: await balanceOf(tokenY.contractId, invariant.address)
  }
  expect(invariantAfterBalance).toMatchObject({ tokenX: 1500n, tokenY: 7n })

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
}
