import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { deployInvariant, newFeeTier, newPoolKey } from '../../../src/utils'
import { getBasicFeeTickSpacing } from '../../../src/snippets'
import {
  expectError,
  getPool,
  initFeeTier,
  initPool,
  initPosition,
  initTokensXY,
  withdrawTokens
} from '../../../src/testUtils'
import { calculateSqrtPrice, toLiquidity } from '../../../src/math'
import { InvariantError } from '../../../src/consts'
import { InvariantInstance, TokenFaucetInstance } from '../../../artifacts/ts'
import { Percentage, SqrtPrice, TokenAmount } from '../../../src'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let admin: PrivateKeyWallet
let positionOwner: PrivateKeyWallet
let invariant: InvariantInstance
let tokenX: TokenFaucetInstance
let tokenY: TokenFaucetInstance

describe('position slippage tests', () => {
  const [fee, tickSpacing] = getBasicFeeTickSpacing()
  const approvedTokens = (10n ** 10n) as TokenAmount
  const liquidityDelta = toLiquidity(1_000_000n)
  const [lowerTick, upperTick] = [-tickSpacing, tickSpacing]

  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
  })

  beforeEach(async () => {
    invariant = await deployInvariant(admin, 0n as Percentage)
    const feeTier = newFeeTier(fee, tickSpacing)
    await initFeeTier(invariant, admin, feeTier)

    const tokenSupply = (10n ** 23n) as TokenAmount
    ;[tokenX, tokenY] = await initTokensXY(admin, tokenSupply)
    positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
    await withdrawTokens(positionOwner, [tokenX, tokenSupply], [tokenY, tokenSupply])

    const initTick = 0n
    const initSqrtPrice = calculateSqrtPrice(initTick)
    await initPool(invariant, admin, tokenX, tokenY, feeTier, initSqrtPrice, initTick)
    const poolKey = newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    const [lowerTick, upperTick] = [-1000n, 1000n]
    const liquidityDelta = toLiquidity(10_000_000_000n)
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
    const feeTier = newFeeTier(fee, tickSpacing)
    const poolKey = newPoolKey(tokenX.address, tokenY.address, feeTier)

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
    const feeTier = newFeeTier(fee, tickSpacing)
    const poolKey = newPoolKey(tokenX.address, tokenY.address, feeTier)

    const slippageLimitLower = 994734637981406576896367n as SqrtPrice
    const slippageLimitUpper = 1025038048074314166333500n as SqrtPrice
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
    const feeTier = newFeeTier(fee, tickSpacing)
    const poolKey = newPoolKey(tokenX.address, tokenY.address, feeTier)

    const slippageLimitLower = 1014432353584998786339859n as SqrtPrice
    const slippageLimitUpper = 1045335831204498605270797n as SqrtPrice

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
    const feeTier = newFeeTier(fee, tickSpacing)
    const poolKey = newPoolKey(tokenX.address, tokenY.address, feeTier)

    const slippageLimitLower = 955339206774222158009382n as SqrtPrice
    const slippageLimitUpper = 984442481813945288458906n as SqrtPrice

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
