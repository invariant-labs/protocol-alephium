import { SignerProvider } from '@alephium/web3'
import { InvariantInstance, TokenFaucetInstance } from '../artifacts/ts'
import { LiquidityScale, MinSqrtPrice, PercentageScale } from './consts'
import {
  getPool,
  initPool,
  initPositionWithLiquidity,
  initSwap,
  initTokensXY,
  withdrawTokens
} from './testUtils'
import { balanceOf, deployInvariant } from './utils'
import { PrivateKeyWallet } from '@alephium/web3-wallet'

type TokenInstance = TokenFaucetInstance

// 6% fee
const fee = 6n * 10n ** (PercentageScale - 3n)
const tickSpacing = 10n

export const initBasicFeeTickSpacing = (): [bigint, bigint] => {
  return [fee, tickSpacing]
}

export const initDexAndTokens = async (
  admin: SignerProvider
): Promise<[InvariantInstance, TokenFaucetInstance, TokenFaucetInstance]> => {
  // 1%
  const protocolFee = 10n ** (PercentageScale - 2n)
  const invariant = await deployInvariant(admin, protocolFee)
  const amount = 1000000n
  const [tokenX, tokenY] = await initTokensXY(admin, amount)
  return [invariant, tokenX, tokenY]
}

export const initBasicPool = async (
  invariant: InvariantInstance,
  admin: SignerProvider,
  tokenX: TokenInstance,
  tokenY: TokenInstance
) => {
  const initSqrtPrice = 10n ** 24n
  await initPool(invariant, admin, tokenX, tokenY, fee, tickSpacing, initSqrtPrice, 0n)
  const pool = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
  expect(pool).toMatchObject({ fee, tickSpacing, sqrtPrice: initSqrtPrice, exist: true })
}

// requires TokenX and Y faucets to have at least 1000
export const initBasicPosition = async (
  invariant: InvariantInstance,
  positionOwner: SignerProvider,
  tokenX: TokenInstance,
  tokenY: TokenInstance
) => {
  const withdrawAmount = 1000n
  await withdrawTokens(positionOwner, [tokenX, withdrawAmount], [tokenY, withdrawAmount])

  const poolBefore = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
  const liquidityDelta = 1000000n * 10n ** LiquidityScale
  const slippageLimit = poolBefore.sqrtPrice
  const [lowerTick, upperTick] = [-20n, 10n]
  await initPositionWithLiquidity(
    invariant,
    positionOwner,
    tokenX,
    withdrawAmount,
    tokenY,
    withdrawAmount,
    fee,
    tickSpacing,
    lowerTick,
    upperTick,
    liquidityDelta,
    1n,
    slippageLimit,
    slippageLimit
  )
  const poolAfter = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
  expect(poolAfter.liquidity).toBe(liquidityDelta)
}

// requires TokenX and Y faucets to have at least 1000
export const initBasicSwap = async (
  invariant: InvariantInstance,
  swapper: PrivateKeyWallet,
  tokenX: TokenInstance,
  tokenY: TokenInstance
) => {
  const poolBefore = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)

  const swapAmount = 1000n
  await withdrawTokens(swapper, [tokenX, swapAmount])

  const swapperTokenXBalanceBefore = await balanceOf(tokenX.contractId, swapper.address)
  expect(swapperTokenXBalanceBefore).toBe(swapAmount)

  const invariantBeforeExpectedBalance = {
    tokenX: await balanceOf(tokenX.contractId, invariant.address),
    tokenY: await balanceOf(tokenY.contractId, invariant.address)
  }
  expect(invariantBeforeExpectedBalance).toMatchObject({ tokenX: 500n, tokenY: 1000n })

  await initSwap(
    invariant,
    swapper,
    tokenX,
    tokenY,
    fee,
    tickSpacing,
    true,
    swapAmount,
    true,
    MinSqrtPrice
  )

  const swapperAfterExpectedBalance = {
    tokenX: await balanceOf(tokenX.contractId, swapper.address),
    tokenY: await balanceOf(tokenY.contractId, swapper.address)
  }
  expect(swapperAfterExpectedBalance).toMatchObject({ tokenX: 0n, tokenY: 993n })

  const invariantAfterExpectedBalance = {
    tokenX: await balanceOf(tokenX.contractId, invariant.address),
    tokenY: await balanceOf(tokenY.contractId, invariant.address)
  }
  expect(invariantAfterExpectedBalance).toMatchObject({ tokenX: 1500n, tokenY: 7n })

  const poolAfter = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
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
