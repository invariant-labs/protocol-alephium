import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { balanceOf, newFeeTier, newPoolKey } from '../../../src/utils'
import { getBasicFeeTickSpacing, initBasicPool } from '../../../src/snippets'
import {
  deployInvariant,
  getPool,
  initFeeTier,
  initPosition,
  initSwap,
  initTokensXY,
  quote,
  withdrawTokens
} from '../../../src/testUtils'
import { MAX_SQRT_PRICE, MIN_SQRT_PRICE, SEARCH_RANGE } from '../../../src/consts'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { InvariantInstance, TokenFaucetInstance } from '../../../artifacts/ts'
import { toLiquidity } from '../../../src/math'
import { FeeTier, Percentage, PoolKey, TokenAmount } from '../../../src/types'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

describe('max tick cross spec', () => {
  const [fee, tickSpacing] = getBasicFeeTickSpacing()
  const searchLimit = SEARCH_RANGE * tickSpacing
  const txGasLimit = 5000000n
  const positionOwnerMint = (1n << 128n) as TokenAmount
  const swapperMint = (1n << 50n) as TokenAmount
  const supply = (positionOwnerMint + swapperMint) as TokenAmount
  const liquidityDelta = toLiquidity(10000000n)
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
    invariant = await deployInvariant(admin, 0n as Percentage)
    ;[tokenX, tokenY] = await initTokensXY(admin, supply)
    await withdrawTokens(positionOwner, [tokenX, positionOwnerMint], [tokenY, positionOwnerMint])
    feeTier = newFeeTier(fee, tickSpacing)
    await initFeeTier(invariant, admin, feeTier)
    await initBasicPool(invariant, admin, tokenX, tokenY)
    poolKey = newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)
  })

  test.only('max tick cross swap xToY and ByAmountIn, no liquidity gap between positions', async () => {
    const lastInitializedTick = -750n
    const amount = 301241n as TokenAmount
    const xToY = true
    const slippage = MIN_SQRT_PRICE
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
      slippage
    )
    const poolAfter = await getPool(invariant, poolKey)

    const crosses = (poolAfter.currentTickIndex - poolBefore.currentTickIndex) / -10n
    expect(crosses).toBe(59n)
    expect(gasAmount).toBeLessThan(txGasLimit)
  }, 100000)
  test('max tick cross swap yToX and ByAmountIn, no liquidity gap between positions', async () => {
    const lastInitializedTick = 1120n
    const amount = 337572n as TokenAmount
    const xToY = false
    const slippage = MAX_SQRT_PRICE
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

    const poolBefore = await getPool(invariant, poolKey)

    const { targetSqrtPrice } = await quote(invariant, poolKey, xToY, amount, byAmountIn, slippage)

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
    expect(crosses).toBe(66n)
    expect(gasAmount).toBeLessThan(txGasLimit)
  }, 100000)
  test('max tick cross swap xToY and ByAmountIn, liquidity gap between positions', async () => {
    const lastInitializedTick = -1250n
    const amount = 200032n as TokenAmount
    const xToY = true
    const slippage = MIN_SQRT_PRICE
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
    expect(crosses).toBe(77n)
    expect(gasAmount).toBeLessThan(txGasLimit)
  }, 100000)
  test('max tick cross swap yToX and ByAmountIn, liquidity gap between positions', async () => {
    const lastInitializedTick = 2400n
    const amount = 215744n as TokenAmount
    const xToY = false
    const slippage = MAX_SQRT_PRICE
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
    expect(crosses).toBe(83n)
    expect(gasAmount).toBeLessThan(txGasLimit)
  }, 100000)
  test('max tick cross swap xToY and ByAmountIn, positions between search limit range', async () => {
    const lastInitializedTick = -150000n
    const amount = 1395687588n as TokenAmount
    const xToY = true
    const slippage = MIN_SQRT_PRICE
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
        i + searchLimit,
        liquidityDelta,
        slippageLimit,
        slippageLimit
      )
    }

    await withdrawTokens(swapper, [tokenX, amount])

    const poolBefore = await getPool(invariant, poolKey)

    const { gasAmount } = await initSwap(
      invariant,
      swapper,
      poolKey,
      xToY,
      amount,
      byAmountIn,
      slippage
    )
    const poolAfter = await getPool(invariant, poolKey)
    const crosses = (poolAfter.currentTickIndex - poolBefore.currentTickIndex) / -searchLimit
    expect(crosses).toBe(38n)
    expect(gasAmount).toBeLessThan(txGasLimit)
  }, 100000)
  test('max tick cross swap yToX and ByAmountIn, positions between search limit range', async () => {
    const lastInitializedTick = 150000n
    const amount = 2460737677n as TokenAmount
    const xToY = false
    const slippage = MAX_SQRT_PRICE
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
        i + searchLimit,
        liquidityDelta,
        slippageLimit,
        slippageLimit
      )
    }

    await withdrawTokens(swapper, [tokenY, amount])

    const poolBefore = await getPool(invariant, poolKey)
    const { gasAmount } = await initSwap(
      invariant,
      swapper,
      poolKey,
      xToY,
      amount,
      byAmountIn,
      slippage
    )

    const poolAfter = await getPool(invariant, poolKey)
    const crosses = (poolAfter.currentTickIndex - poolBefore.currentTickIndex) / searchLimit
    expect(crosses).toBe(42n)
    expect(gasAmount).toBeLessThan(txGasLimit)
  }, 100000)
  test('max tick cross swap xToY and ByAmountOut, no liquidity gap between positions', async () => {
    const lastInitializedTick = -750n
    const mintAmount = 600000n as TokenAmount
    const swapAmount = 339068n as TokenAmount
    const xToY = true
    const slippage = MIN_SQRT_PRICE
    const byAmountIn = false

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

    await withdrawTokens(swapper, [tokenX, mintAmount])

    const { targetSqrtPrice } = await quote(
      invariant,
      poolKey,
      xToY,
      swapAmount,
      byAmountIn,
      slippage
    )

    const poolBefore = await getPool(invariant, poolKey)

    const { gasAmount } = await initSwap(
      invariant,
      swapper,
      poolKey,
      xToY,
      swapAmount,
      byAmountIn,
      targetSqrtPrice,
      mintAmount
    )
    const poolAfter = await getPool(invariant, poolKey)

    const crosses = (poolAfter.currentTickIndex - poolBefore.currentTickIndex) / -10n
    expect(crosses).toBe(69n)
    console.log(gasAmount, txGasLimit)
    expect(gasAmount).toBeLessThan(txGasLimit)
  }, 100000)
  test('max tick cross swap yToX and ByAmountOut, no liquidity gap between positions', async () => {
    const lastInitializedTick = 900n
    const mintAmount = 600000n as TokenAmount
    const swapAmount = 314889n as TokenAmount

    const xToY = false
    const slippage = MAX_SQRT_PRICE
    const byAmountIn = false

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

    await withdrawTokens(swapper, [tokenY, mintAmount])

    const { targetSqrtPrice } = await quote(
      invariant,
      poolKey,
      xToY,
      swapAmount,
      byAmountIn,
      slippage
    )

    const poolBefore = await getPool(invariant, poolKey)
    const { gasAmount } = await initSwap(
      invariant,
      swapper,
      poolKey,
      xToY,
      swapAmount,
      byAmountIn,
      targetSqrtPrice,
      mintAmount
    )

    const poolAfter = await getPool(invariant, poolKey)
    const crosses = (poolAfter.currentTickIndex - poolBefore.currentTickIndex) / 10n
    expect(crosses).toBe(64n)
    expect(gasAmount).toBeLessThan(txGasLimit)
  }, 100000)
  test('max tick cross swap xToY and ByAmountOut, liquidity gap between positions', async () => {
    const lastInitializedTick = -1000n
    const mintAmount = 600000n as TokenAmount
    const swapAmount = 210363n as TokenAmount
    const xToY = true
    const slippage = MIN_SQRT_PRICE
    const byAmountIn = false

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

    await withdrawTokens(swapper, [tokenX, mintAmount])

    const { targetSqrtPrice } = await quote(
      invariant,
      poolKey,
      xToY,
      swapAmount,
      byAmountIn,
      slippage
    )
    const poolBefore = await getPool(invariant, poolKey)

    const { gasAmount } = await initSwap(
      invariant,
      swapper,
      poolKey,
      xToY,
      swapAmount,
      byAmountIn,
      targetSqrtPrice,
      mintAmount
    )
    const poolAfter = await getPool(invariant, poolKey)

    const crosses = (poolAfter.currentTickIndex - poolBefore.currentTickIndex) / -10n
    expect(crosses).toBe(86n)
    console.log(gasAmount, txGasLimit)
    expect(gasAmount).toBeLessThan(txGasLimit)
  }, 100000)
  test('max tick cross swap yToX and ByAmountOut, liquidity gap between positions', async () => {
    console.log(invariant.address, swapper.address)
    const lastInitializedTick = 1360n
    const mintAmount = 600000000n as TokenAmount
    const swapAmount = 200872n as TokenAmount

    const xToY = false
    const slippage = MAX_SQRT_PRICE
    const byAmountIn = false

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
    const poolBefore = await getPool(invariant, poolKey)

    await withdrawTokens(swapper, [tokenY, mintAmount])
    const { targetSqrtPrice } = await quote(
      invariant,
      poolKey,
      xToY,
      swapAmount,
      byAmountIn,
      slippage
    )

    const { gasAmount } = await initSwap(
      invariant,
      swapper,
      poolKey,
      xToY,
      swapAmount,
      byAmountIn,
      targetSqrtPrice,
      mintAmount
    )

    const poolAfter = await getPool(invariant, poolKey)
    const crosses = (poolAfter.currentTickIndex - poolBefore.currentTickIndex) / 10n
    expect(crosses).toBe(80n)
    console.log(gasAmount, txGasLimit)
    expect(gasAmount).toBeLessThan(txGasLimit)
  }, 1000000000)
  test('max tick cross swap xToY and ByAmountOut, positions between search limit range', async () => {
    const lastInitializedTick = -155040n
    const mintAmount = 200000000000n as TokenAmount
    const xToY = true
    const slippage = MIN_SQRT_PRICE
    const byAmountIn = false
    const swapAmount = 9956848n as TokenAmount
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
        i + searchLimit,
        liquidityDelta,
        slippageLimit,
        slippageLimit
      )
    }

    await withdrawTokens(swapper, [tokenX, mintAmount])

    const { targetSqrtPrice } = await quote(
      invariant,
      poolKey,
      xToY,
      swapAmount,
      byAmountIn,
      slippage
    )

    const poolBefore = await getPool(invariant, poolKey)

    const { gasAmount } = await initSwap(
      invariant,
      swapper,
      poolKey,
      xToY,
      swapAmount,
      byAmountIn,
      targetSqrtPrice,
      mintAmount
    )
    const poolAfter = await getPool(invariant, poolKey)
    const crosses = (poolAfter.currentTickIndex - poolBefore.currentTickIndex) / -searchLimit
    expect(crosses).toBe(42n)
    expect(gasAmount).toBeLessThan(txGasLimit)
  }, 100000)
  test('max tick cross swap yToX and ByAmountOut, positions between search limit range', async () => {
    const lastInitializedTick = 155000n
    const mintAmount = 20000000000n as TokenAmount
    const swapAmount = 9959260n as TokenAmount
    const xToY = false
    const slippage = MAX_SQRT_PRICE
    const byAmountIn = false

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
        i + searchLimit,
        liquidityDelta,
        slippageLimit,
        slippageLimit
      )
    }

    await withdrawTokens(swapper, [tokenY, mintAmount])

    const { targetSqrtPrice } = await quote(
      invariant,
      poolKey,
      xToY,
      swapAmount,
      byAmountIn,
      slippage
    )

    const poolBefore = await getPool(invariant, poolKey)
    const { gasAmount } = await initSwap(
      invariant,
      swapper,
      poolKey,
      xToY,
      swapAmount,
      byAmountIn,
      targetSqrtPrice,
      mintAmount
    )

    const poolAfter = await getPool(invariant, poolKey)
    const crosses = (poolAfter.currentTickIndex - poolBefore.currentTickIndex) / searchLimit
    console.log(gasAmount, txGasLimit)
    expect(crosses).toBe(43n)
    expect(gasAmount).toBeLessThan(txGasLimit)
  }, 100000)
})
