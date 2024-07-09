import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { balanceOf, deployInvariant, newFeeTier, newPoolKey } from '../src/utils'
import { getBasicFeeTickSpacing, initBasicPool } from '../src/snippets'
import {
  getPool,
  initFeeTier,
  initPosition,
  initSwap,
  initTokensXY,
  quote,
  withdrawTokens
} from '../src/testUtils'
import { LiquidityScale, MaxSqrtPrice, MinSqrtPrice, SearchRange } from '../src/consts'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { FeeTier, PoolKey } from '../artifacts/ts/types'
import { InvariantInstance, TokenFaucetInstance } from '../artifacts/ts'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

describe('max tick cross spec', () => {
  const [fee, tickSpacing] = getBasicFeeTickSpacing()
  const searchLimit = SearchRange * tickSpacing
  const txGasLimit = 500000n
  const positionOwnerMint = 1n << 128n
  const swapperMint = 1n << 30n
  const supply = positionOwnerMint + swapperMint
  const liquidityDelta = 10000000n * 10n ** LiquidityScale
  let admin: PrivateKeyWallet
  let positionOwner: PrivateKeyWallet
  let swapper: PrivateKeyWallet
  let feeTier: FeeTier
  let poolKey: PoolKey
  let invariant: InvariantInstance
  let tokenX: TokenFaucetInstance
  let tokenY: TokenFaucetInstance

  beforeEach(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
    positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
    swapper = await getSigner(ONE_ALPH * 1000n, 0)
    invariant = await deployInvariant(admin, 0n)
    ;[tokenX, tokenY] = await initTokensXY(admin, supply)
    await withdrawTokens(positionOwner, [tokenX, positionOwnerMint], [tokenY, positionOwnerMint])
    feeTier = await newFeeTier(fee, tickSpacing)
    await initFeeTier(invariant, admin, feeTier)
    await initBasicPool(invariant, admin, tokenX, tokenY)
    poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)
  })

  test('max tick cross swap xToY and ByAmountIn, no liquidity gap between positions', async () => {
    const lastInitializedTick = -250n
    const amount = 40300n
    const xToY = true
    const slippage = MinSqrtPrice
    const byAmountIn = true

    for (let i = lastInitializedTick; i < 0n; i += 10n) {
      const positionOwnerBalanceX = await balanceOf(tokenX.contractId, positionOwner.address)
      const positionOwnerBalanceY = await balanceOf(tokenY.contractId, positionOwner.address)
      const { sqrtPrice: slippageLimit } = await getPool(invariant, poolKey)
      await initPosition(
        invariant,
        positionOwner,
        poolKey,
        positionOwnerBalanceX,
        positionOwnerBalanceY,
        i,
        i + 10n,
        liquidityDelta,
        slippageLimit,
        slippageLimit
      )
    }

    await withdrawTokens(swapper, [tokenX, amount])

    const { targetSqrtPrice } = await quote(invariant, poolKey, xToY, amount, byAmountIn, slippage)

    const poolBefore = await getPool(invariant, poolKey)
    const { gasAmount } = await initSwap(
      invariant,
      swapper,
      poolKey,
      xToY,
      amount,
      byAmountIn,
      targetSqrtPrice
    )
    const poolAfter = await getPool(invariant, poolKey)

    const crosses = (poolAfter.currentTickIndex - poolBefore.currentTickIndex) / -10n
    expect(crosses).toBe(8n)
    expect(gasAmount).toBeGreaterThan(txGasLimit)
  }, 100000)
  test('max tick cross swap yToX and ByAmountIn, no liquidity gap between positions', async () => {
    const lastInitializedTick = 120n
    const amount = 45000n
    const xToY = false
    const slippage = MaxSqrtPrice
    const byAmountIn = true

    for (let i = 0n; i < lastInitializedTick; i += 10n) {
      const positionOwnerBalanceX = await balanceOf(tokenX.contractId, positionOwner.address)
      const positionOwnerBalanceY = await balanceOf(tokenY.contractId, positionOwner.address)
      const { sqrtPrice: slippageLimit } = await getPool(invariant, poolKey)
      await initPosition(
        invariant,
        positionOwner,
        poolKey,
        positionOwnerBalanceX,
        positionOwnerBalanceY,
        i,
        i + 10n,
        liquidityDelta,
        slippageLimit,
        slippageLimit
      )
    }

    await withdrawTokens(swapper, [tokenY, amount])

    const { targetSqrtPrice } = await quote(invariant, poolKey, xToY, amount, byAmountIn, slippage)

    const poolBefore = await getPool(invariant, poolKey)
    const { gasAmount } = await initSwap(
      invariant,
      swapper,
      poolKey,
      xToY,
      amount,
      byAmountIn,
      targetSqrtPrice
    )

    const poolAfter = await getPool(invariant, poolKey)
    const crosses = (poolAfter.currentTickIndex - poolBefore.currentTickIndex) / 10n
    expect(crosses).toBe(8n)
    expect(gasAmount).toBeGreaterThan(txGasLimit)
  }, 100000)
  test('max tick cross swap xToY and ByAmountIn, liquidity gap between positions', async () => {
    const lastInitializedTick = -250n
    const amount = 35250n
    const xToY = true
    const slippage = MinSqrtPrice
    const byAmountIn = true

    for (let i = lastInitializedTick; i < 0n; i += 20n) {
      const positionOwnerBalanceX = await balanceOf(tokenX.contractId, positionOwner.address)
      const positionOwnerBalanceY = await balanceOf(tokenY.contractId, positionOwner.address)
      const { sqrtPrice: slippageLimit } = await getPool(invariant, poolKey)
      await initPosition(
        invariant,
        positionOwner,
        poolKey,
        positionOwnerBalanceX,
        positionOwnerBalanceY,
        i,
        i + 10n,
        liquidityDelta,
        slippageLimit,
        slippageLimit
      )
    }

    await withdrawTokens(swapper, [tokenX, amount])

    const { targetSqrtPrice } = await quote(invariant, poolKey, xToY, amount, byAmountIn, slippage)

    const poolBefore = await getPool(invariant, poolKey)
    const { gasAmount } = await initSwap(
      invariant,
      swapper,
      poolKey,
      xToY,
      amount,
      byAmountIn,
      targetSqrtPrice
    )
    const poolAfter = await getPool(invariant, poolKey)
    const crosses = (poolAfter.currentTickIndex - poolBefore.currentTickIndex) / -10n
    expect(crosses).toBe(13n)
    expect(gasAmount).toBeGreaterThan(txGasLimit)
  }, 100000)
  test('max tick cross swap yToX and ByAmountIn, liquidity gap between positions', async () => {
    const lastInitializedTick = 240n
    const amount = 40000n
    const xToY = false
    const slippage = MaxSqrtPrice
    const byAmountIn = true

    for (let i = 0n; i < lastInitializedTick; i += 20n) {
      const positionOwnerBalanceX = await balanceOf(tokenX.contractId, positionOwner.address)
      const positionOwnerBalanceY = await balanceOf(tokenY.contractId, positionOwner.address)
      const { sqrtPrice: slippageLimit } = await getPool(invariant, poolKey)
      await initPosition(
        invariant,
        positionOwner,
        poolKey,
        positionOwnerBalanceX,
        positionOwnerBalanceY,
        i,
        i + 10n,
        liquidityDelta,
        slippageLimit,
        slippageLimit
      )
    }

    await withdrawTokens(swapper, [tokenY, amount])

    const { targetSqrtPrice } = await quote(invariant, poolKey, xToY, amount, byAmountIn, slippage)

    const poolBefore = await getPool(invariant, poolKey)
    const { gasAmount } = await initSwap(
      invariant,
      swapper,
      poolKey,
      xToY,
      amount,
      byAmountIn,
      targetSqrtPrice
    )

    const poolAfter = await getPool(invariant, poolKey)
    const crosses = (poolAfter.currentTickIndex - poolBefore.currentTickIndex) / 10n
    expect(crosses).toBe(14n)
    expect(gasAmount).toBeGreaterThan(txGasLimit)
  }, 100000)
  test('max tick cross swap xToY and ByAmountIn, positions between search limit range', async () => {
    const lastInitializedTick = -35000n
    const amount = 58100n
    const xToY = true
    const slippage = MinSqrtPrice
    const byAmountIn = true

    for (let i = lastInitializedTick; i < 0n; i += searchLimit) {
      const positionOwnerBalanceX = await balanceOf(tokenX.contractId, positionOwner.address)
      const positionOwnerBalanceY = await balanceOf(tokenY.contractId, positionOwner.address)
      const { sqrtPrice: slippageLimit } = await getPool(invariant, poolKey)
      await initPosition(
        invariant,
        positionOwner,
        poolKey,
        positionOwnerBalanceX,
        positionOwnerBalanceY,
        i,
        i + 10n,
        liquidityDelta,
        slippageLimit,
        slippageLimit
      )
    }

    await withdrawTokens(swapper, [tokenX, amount])

    const { targetSqrtPrice } = await quote(invariant, poolKey, xToY, amount, byAmountIn, slippage)

    const poolBefore = await getPool(invariant, poolKey)
    const { gasAmount } = await initSwap(
      invariant,
      swapper,
      poolKey,
      xToY,
      amount,
      byAmountIn,
      targetSqrtPrice
    )
    const poolAfter = await getPool(invariant, poolKey)
    const crosses = (poolAfter.currentTickIndex - poolBefore.currentTickIndex) / -10n
    expect(crosses).toBe(1708n)
    expect(gasAmount).toBeGreaterThan(txGasLimit)
  }, 100000)
  test('max tick cross swap yToX and ByAmountIn, positions between search limit range', async () => {
    const lastInitializedTick = 25000n
    const amount = 60000n
    const xToY = false
    const slippage = MaxSqrtPrice
    const byAmountIn = true

    for (let i = 0n; i < lastInitializedTick; i += searchLimit) {
      const positionOwnerBalanceX = await balanceOf(tokenX.contractId, positionOwner.address)
      const positionOwnerBalanceY = await balanceOf(tokenY.contractId, positionOwner.address)
      const { sqrtPrice: slippageLimit } = await getPool(invariant, poolKey)
      await initPosition(
        invariant,
        positionOwner,
        poolKey,
        positionOwnerBalanceX,
        positionOwnerBalanceY,
        i,
        i + 10n,
        liquidityDelta,
        slippageLimit,
        slippageLimit
      )
    }

    await withdrawTokens(swapper, [tokenY, amount])

    const { targetSqrtPrice } = await quote(invariant, poolKey, xToY, amount, byAmountIn, slippage)

    const poolBefore = await getPool(invariant, poolKey)
    const { gasAmount } = await initSwap(
      invariant,
      swapper,
      poolKey,
      xToY,
      amount,
      byAmountIn,
      targetSqrtPrice
    )

    const poolAfter = await getPool(invariant, poolKey)
    const crosses = (poolAfter.currentTickIndex - poolBefore.currentTickIndex) / 10n
    expect(crosses).toBe(1792n)
    expect(gasAmount).toBeGreaterThan(txGasLimit)
  }, 100000)
})
