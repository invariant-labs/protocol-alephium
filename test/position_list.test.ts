import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { getBasicFeeTickSpacing, transferVerifyPosition } from '../src/snippets'
import {
  expectError,
  getPool,
  getPosition,
  getTick,
  initFeeTier,
  initPool,
  initPosition,
  initTokensXY,
  isTickInitialized,
  removePosition,
  transferPosition,
  withdrawTokens
} from '../src/testUtils'
import { calculateSqrtPrice } from '../src/math'
import { InvariantError, LiquidityScale, MaxSqrtPrice, PercentageScale } from '../src/consts'
import { deployInvariant, newFeeTier, newPoolKey } from '../src/utils'
import { InvariantInstance, TokenFaucetInstance } from '../artifacts/ts'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let admin: PrivateKeyWallet

const tokenSupply = 10n ** 10n
// the value just has to be >= available tokens during every deposit
const approvedTokens = tokenSupply / 4n

describe('position list tests', () => {
  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
  })

  test('remove position from empty list', async () => {
    const invariant = await deployInvariant(admin, 0n)
    const [tokenX, tokenY] = await initTokensXY(admin, 0n)
    const withoutPositions = await getSigner(ONE_ALPH * 1000n, 0)

    const [fee, _] = getBasicFeeTickSpacing()
    const tickSpacing = 3n
    const feeTier = await newFeeTier(fee, tickSpacing)
    await initFeeTier(invariant, admin, feeTier)

    const initTick = -23028n
    await initPool(
      invariant,
      withoutPositions,
      tokenX,
      tokenY,
      feeTier,
      await calculateSqrtPrice(initTick),
      initTick
    )

    expectError(
      InvariantError.PositionNotFound,
      removePosition(invariant, withoutPositions, 0n),
      invariant
    )
  })

  test('multiple positions on same tick', async () => {
    const invariant = await deployInvariant(admin, 0n)
    const [tokenX, tokenY] = await initTokensXY(admin, tokenSupply)

    // 0.02%
    const fee = 2n * 10n ** (PercentageScale - 4n)
    const tickSpacing = 10n
    const feeTier = await newFeeTier(fee, tickSpacing)
    await initFeeTier(invariant, admin, feeTier)

    const positionsOwner = await getSigner(ONE_ALPH * 1000n, 0)
    await withdrawTokens(positionsOwner, [tokenX, tokenSupply], [tokenY, tokenSupply])
    const initTick = 0n
    await initPool(
      invariant,
      positionsOwner,
      tokenX,
      tokenY,
      feeTier,
      await calculateSqrtPrice(initTick),
      initTick
    )

    const poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)
    const { sqrtPrice: slippageLimitLower } = await getPool(invariant, poolKey)
    const liquiditiyDelta = 100n
    // all 3 exact same ticks
    {
      const [lowerTickIndex, upperTickIndex] = [-10n, 10n]
      for (let n = 1n; n <= 3n; ++n) {
        await initPosition(
          invariant,
          positionsOwner,
          poolKey,
          approvedTokens,
          approvedTokens,
          lowerTickIndex,
          upperTickIndex,
          liquiditiyDelta,
          slippageLimitLower,
          MaxSqrtPrice
        )
        const newPosition = await getPosition(invariant, positionsOwner.address, n)
        expect(newPosition).toMatchObject({ lowerTickIndex, upperTickIndex })
      }

      const pool = await getPool(invariant, poolKey)
      const lowerTick = await getTick(invariant, poolKey, lowerTickIndex)
      const upperTick = await getTick(invariant, poolKey, upperTickIndex)

      const expectedLiquidity = liquiditiyDelta * 3n
      expect(pool).toMatchObject({ liquidity: expectedLiquidity, currentTickIndex: initTick })
      expect(lowerTick).toMatchObject({
        liquidityGross: expectedLiquidity,
        liquidityChange: expectedLiquidity,
        sign: true
      })
      expect(upperTick).toMatchObject({
        liquidityGross: expectedLiquidity,
        liquidityChange: expectedLiquidity,
        sign: false
      })

      for (let n = 1n; n <= 3n; ++n) {
        const position = await getPosition(invariant, positionsOwner.address, n)
        expect(position).toMatchObject({
          poolKey,
          liquidity: liquiditiyDelta,
          lowerTickIndex,
          upperTickIndex,
          feeGrowthInsideX: 0n,
          feeGrowthInsideY: 0n
        })
      }
    }
    // 3 more with different tick settings but overlapping
    {
      const tickIndexes: Array<[bigint, bigint]> = [
        [-10n, 10n],
        [-20n, -10n],
        [10n, 20n]
      ]

      for (const [index, [lowerTickIndex, upperTickIndex]] of tickIndexes.entries()) {
        await initPosition(
          invariant,
          positionsOwner,
          poolKey,
          approvedTokens,
          approvedTokens,
          lowerTickIndex,
          upperTickIndex,
          liquiditiyDelta,
          slippageLimitLower,
          MaxSqrtPrice
        )
        const newPosition = await getPosition(
          invariant,
          positionsOwner.address,
          3n + BigInt(index + 1)
        )
        expect(newPosition).toMatchObject({
          poolKey,
          liquidity: liquiditiyDelta,
          lowerTickIndex,
          upperTickIndex,
          feeGrowthInsideX: 0n,
          feeGrowthInsideY: 0n
        })
      }
      // tick -20 check
      expect(await getTick(invariant, poolKey, -20n)).toMatchObject({
        index: -20n,
        liquidityGross: 100n,
        liquidityChange: 100n,
        sign: true
      })
      expect(await isTickInitialized(invariant, poolKey, -20n)).toBeTruthy()
      // tick -10 check
      expect(await getTick(invariant, poolKey, -10n)).toMatchObject({
        index: -10n,
        liquidityGross: 500n,
        liquidityChange: 300n,
        sign: true
      })
      expect(await isTickInitialized(invariant, poolKey, -10n)).toBeTruthy()
      // tick 10 check
      expect(await getTick(invariant, poolKey, 10n)).toMatchObject({
        index: 10n,
        liquidityGross: 500n,
        liquidityChange: 300n,
        sign: false
      })
      expect(await isTickInitialized(invariant, poolKey, 10n)).toBeTruthy()
      // tick 20 check
      expect(await getTick(invariant, poolKey, 20n)).toMatchObject({
        index: 20n,
        liquidityGross: 100n,
        liquidityChange: 100n,
        sign: false
      })
      expect(await isTickInitialized(invariant, poolKey, 20n)).toBeTruthy()

      expect(await getPool(invariant, poolKey)).toMatchObject({
        liquidity: 400n,
        currentTickIndex: initTick
      })
    }
  })
})

describe('position list tests', () => {
  const tickIndexes = [-9780n, -42n, 0n, 9n, 276n]
  const liquiditiyDelta = 10n * 10n ** LiquidityScale

  let invariant: InvariantInstance
  let tokenX: TokenFaucetInstance
  let tokenY: TokenFaucetInstance
  let positionsOwner: PrivateKeyWallet

  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
  })
  beforeEach(async () => {
    invariant = await deployInvariant(admin, 0n)
    ;[tokenX, tokenY] = await initTokensXY(admin, tokenSupply)

    const feeTier = await newFeeTier(getBasicFeeTickSpacing()[0], 3n)
    await initFeeTier(invariant, admin, feeTier)

    positionsOwner = await getSigner(ONE_ALPH * 1000n, 0)
    await withdrawTokens(positionsOwner, [tokenX, tokenSupply], [tokenY, tokenSupply])

    const initTick = -23028n
    await initPool(
      invariant,
      positionsOwner,
      tokenX,
      tokenY,
      feeTier,
      await calculateSqrtPrice(initTick),
      initTick
    )

    const poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    const { sqrtPrice: slippageLimitLower } = await getPool(invariant, poolKey)

    const minMaxTicks: Array<[number, number]> = [
      [0, 1],
      [0, 1],
      [0, 2],
      [1, 4]
    ]
    for (const [minIndex, maxIndex] of minMaxTicks) {
      const minTick = tickIndexes[minIndex]
      const maxTick = tickIndexes[maxIndex]

      await initPosition(
        invariant,
        positionsOwner,
        poolKey,
        approvedTokens,
        approvedTokens,
        minTick,
        maxTick,
        liquiditiyDelta,
        slippageLimitLower,
        MaxSqrtPrice
      )
    }
  })
  test('add multiple positions', async () => {
    const feeTier = await newFeeTier(getBasicFeeTickSpacing()[0], 3n)
    const poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)
    const { sqrtPrice: slippageLimitLower } = await getPool(invariant, poolKey)

    // remove middle position
    {
      const lastPosition = await getPosition(invariant, positionsOwner.address, 4n)
      await removePosition(invariant, positionsOwner, 2n)
      const replacedPosition = await getPosition(invariant, positionsOwner.address, 2n)

      expect(replacedPosition).toStrictEqual(lastPosition)
    }
    // add position in place of the removed one
    {
      await initPosition(
        invariant,
        positionsOwner,
        poolKey,
        approvedTokens,
        approvedTokens,
        tickIndexes[1],
        tickIndexes[2],
        liquiditiyDelta,
        slippageLimitLower,
        MaxSqrtPrice
      )
      const { exist: positionExists } = await getPosition(invariant, positionsOwner.address, 4n)
      expect(positionExists).toBeTruthy()
    }
    // remove last position
    {
      await removePosition(invariant, positionsOwner, 4n)
      const { exist: positionExists } = await getPosition(invariant, positionsOwner.address, 4n)
      expect(positionExists).toBeFalsy()
    }
    // remove all positions
    {
      for (let n = 3n; n > 0; --n) {
        await removePosition(invariant, positionsOwner, n)
        const { exist: positionExists } = await getPosition(invariant, positionsOwner.address, n)
        expect(positionExists).toBeFalsy()
      }
    }

    // add position to a now empty list
    {
      await initPosition(
        invariant,
        positionsOwner,
        poolKey,
        approvedTokens,
        approvedTokens,
        tickIndexes[0],
        tickIndexes[1],
        liquiditiyDelta,
        slippageLimitLower,
        MaxSqrtPrice
      )
      const position = await getPosition(invariant, positionsOwner.address, 1n)
      expect(position).toMatchObject({
        exist: true,
        poolKey,
        lowerTickIndex: tickIndexes[0],
        upperTickIndex: tickIndexes[1],
        liquidity: liquiditiyDelta,
        owner: positionsOwner.address
      })
      const { exist: secondExists } = await getPosition(invariant, positionsOwner.address, 2n)
      expect(secondExists).toBeFalsy()
    }
  })

  test('only owner can modify position list', async () => {
    const notOwner = await getSigner(ONE_ALPH * 1000n, 0)

    expectError(InvariantError.PositionNotFound, removePosition(invariant, notOwner, 4n), invariant)
  })

  test('transfer position ownership', async () => {
    const positionsRecipient = await getSigner(ONE_ALPH * 1000n, 0)

    // transfer position at the current first index
    await transferVerifyPosition(invariant, positionsOwner, 4n, 1n, positionsRecipient.address, 0n)

    // transfer position at the current middle index
    await transferVerifyPosition(invariant, positionsOwner, 3n, 2n, positionsRecipient.address, 1n)

    // transfer position at the current last index
    await transferVerifyPosition(invariant, positionsOwner, 2n, 2n, positionsRecipient.address, 2n)

    // transfer the last position of positionsOwner
    await transferVerifyPosition(invariant, positionsOwner, 1n, 1n, positionsRecipient.address, 3n)

    // get back the first position
    await transferVerifyPosition(invariant, positionsRecipient, 4n, 1n, positionsOwner.address, 0n)
  })

  test('only owner can transfer position', async () => {
    const notOwner = await getSigner(ONE_ALPH * 1000n, 0)
    expectError(
      InvariantError.PositionNotFound,
      transferPosition(invariant, notOwner, 1n, notOwner.address),
      invariant
    )
  })
})
