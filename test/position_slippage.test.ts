import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { deployInvariant, newFeeTier, newPoolKey } from '../src/utils'
import { getBasicFeeTickSpacing } from '../src/snippets'
import {
  expectError,
  getPool,
  initFeeTier,
  initPool,
  initPosition,
  initTokensXY,
  withdrawTokens
} from '../src/testUtils'
import { calculateSqrtPrice } from '../src/math'
import { InvariantError, LiquidityScale } from '../src/consts'
import { InvariantInstance, TokenFaucetInstance } from '../artifacts/ts'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let admin: PrivateKeyWallet
let positionOwner: PrivateKeyWallet
let invariant: InvariantInstance
let tokenX: TokenFaucetInstance
let tokenY: TokenFaucetInstance

describe('position slippage tests', () => {
  const [fee, tickSpacing] = getBasicFeeTickSpacing()
  const approvedTokens = 10n ** 10n
  const liquidityDelta = 1_000_000n * 10n ** LiquidityScale
  const [lowerTick, upperTick] = [-tickSpacing, tickSpacing]

  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
  })

  beforeEach(async () => {
    invariant = await deployInvariant(admin, 0n)
    const feeTier = await newFeeTier(fee, tickSpacing)
    await initFeeTier(invariant, admin, feeTier)

    const tokenSupply = 10n ** 23n
    ;[tokenX, tokenY] = await initTokensXY(admin, tokenSupply)
    positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
    await withdrawTokens(positionOwner, [tokenX, tokenSupply], [tokenY, tokenSupply])

    const initTick = 0n
    const initSqrtPrice = await calculateSqrtPrice(initTick)
    await initPool(invariant, admin, tokenX, tokenY, feeTier, initSqrtPrice, initTick)
    const poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    const [lowerTick, upperTick] = [-1000n, 1000n]
    const liquidityDelta = 10_000_000_000n * 10n ** LiquidityScale
    const { sqrtPrice: slippageLimit } = await getPool(invariant, poolKey)

    await initPosition(
      invariant,
      positionOwner,
      poolKey,
      approvedTokens,
      approvedTokens,
      lowerTick,
      upperTick,
      liquidityDelta,
      slippageLimit,
      slippageLimit
    )

    expect(await getPool(invariant, poolKey)).toMatchObject({
      liquidity: liquidityDelta,
      poolKey,
      currentTickIndex: initTick
    })
  })

  test('zero slippage', async () => {
    const feeTier = await newFeeTier(fee, tickSpacing)
    const poolKey = await newPoolKey(tokenX.address, tokenY.address, feeTier)

    const { sqrtPrice: knownSqrtPrice } = await getPool(invariant, poolKey)
    await initPosition(
      invariant,
      positionOwner,
      poolKey,
      approvedTokens,
      approvedTokens,
      lowerTick,
      upperTick,
      liquidityDelta,
      knownSqrtPrice,
      knownSqrtPrice
    )
  })
  test('inside range', async () => {
    const feeTier = await newFeeTier(fee, tickSpacing)
    const poolKey = await newPoolKey(tokenX.address, tokenY.address, feeTier)

    const slippageLimitLower = 994734637981406576896367n
    const slippageLimitUpper = 1025038048074314166333500n
    await initPosition(
      invariant,
      positionOwner,
      poolKey,
      approvedTokens,
      approvedTokens,
      lowerTick,
      upperTick,
      liquidityDelta,
      slippageLimitLower,
      slippageLimitUpper
    )
  })
  test('below range', async () => {
    const feeTier = await newFeeTier(fee, tickSpacing)
    const poolKey = await newPoolKey(tokenX.address, tokenY.address, feeTier)

    const slippageLimitLower = 1014432353584998786339859n
    const slippageLimitUpper = 1045335831204498605270797n

    await expectError(
      InvariantError.PriceLimitReached,
      initPosition(
        invariant,
        positionOwner,
        poolKey,
        approvedTokens,
        approvedTokens,
        lowerTick,
        upperTick,
        liquidityDelta,
        slippageLimitLower,
        slippageLimitUpper
      ),
      invariant
    )
  })

  test('above range', async () => {
    const feeTier = await newFeeTier(fee, tickSpacing)
    const poolKey = await newPoolKey(tokenX.address, tokenY.address, feeTier)

    const slippageLimitLower = 955339206774222158009382n
    const slippageLimitUpper = 984442481813945288458906n

    await expectError(
      InvariantError.PriceLimitReached,
      initPosition(
        invariant,
        positionOwner,
        poolKey,
        approvedTokens,
        approvedTokens,
        lowerTick,
        upperTick,
        liquidityDelta,
        slippageLimitLower,
        slippageLimitUpper
      ),
      invariant
    )
  })
})
