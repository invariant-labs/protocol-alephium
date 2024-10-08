import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { getBasicFeeTickSpacing, transferAndVerifyPosition } from '../../../src/snippets'
import {
  deployInvariant,
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
  verifyPositionList,
  withdrawTokens
} from '../../../src/testUtils'
import { calculateSqrtPrice, toLiquidity, toPercentage } from '../../../src/math'
import { InvariantError, MAX_SQRT_PRICE } from '../../../src/consts'
import { newFeeTier, newPoolKey } from '../../../src/utils'
import { InvariantInstance, TokenFaucetInstance } from '../../../artifacts/ts'
import { Liquidity, Percentage, TokenAmount } from '../../../src'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let admin: PrivateKeyWallet

const tokenSupply = (10n ** 10n) as TokenAmount
// the value just has to be >= available tokens during every deposit
const approvedTokens = (tokenSupply / 4n) as TokenAmount

describe('position list tests', () => {
  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
  })

  test('remove position from an empty list', async () => {
    const invariant = await deployInvariant(admin, 0n as Percentage)
    const [tokenX, tokenY] = await initTokensXY(admin, 0n as TokenAmount)
    const withoutPositions = await getSigner(ONE_ALPH * 1000n, 0)

    const [fee] = getBasicFeeTickSpacing()
    const tickSpacing = 3n
    const feeTier = newFeeTier(fee, tickSpacing)
    await initFeeTier(invariant, admin, feeTier)

    const initTick = -23028n
    await initPool(
      invariant,
      withoutPositions,
      tokenX,
      tokenY,
      feeTier,
      calculateSqrtPrice(initTick),
      initTick
    )

    expectError(
      InvariantError.PositionNotFound,
      removePosition(invariant, withoutPositions, 0n),
      invariant
    )
  })

  test('multiple positions on the same tick', async () => {
    const invariant = await deployInvariant(admin, 0n as Percentage)
    const [tokenX, tokenY] = await initTokensXY(admin, tokenSupply)

    // 0.02%
    const fee = toPercentage(2n, 4n)
    const tickSpacing = 10n
    const feeTier = newFeeTier(fee, tickSpacing)
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
      calculateSqrtPrice(initTick),
      initTick
    )

    const poolKey = newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)
    const { sqrtPrice: slippageLimitLower } = await getPool(invariant, poolKey)
    const liquiditiyDelta = 100n as Liquidity
    // all 3 exact same ticks
    {
      const [lowerTickIndex, upperTickIndex] = [-10n, 10n]
      for (let n = 0n; n < 3n; ++n) {
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
          MAX_SQRT_PRICE
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

      for (let n = 0n; n < 3n; ++n) {
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
          MAX_SQRT_PRICE
        )
        const newPosition = await getPosition(
          invariant,
          positionsOwner.address,
          2n + BigInt(index + 1)
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

      verifyPositionList(invariant, positionsOwner.address, 6n, true)
    }
  })
})

describe('position list tests', () => {
  const tickIndexes = [-9780n, -42n, 0n, 9n, 276n]
  const liquiditiyDelta = toLiquidity(10n)

  let invariant: InvariantInstance
  let tokenX: TokenFaucetInstance
  let tokenY: TokenFaucetInstance
  let positionsOwner: PrivateKeyWallet

  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
  })
  beforeEach(async () => {
    invariant = await deployInvariant(admin, 0n as Percentage)
    ;[tokenX, tokenY] = await initTokensXY(admin, tokenSupply)

    const feeTier = newFeeTier(getBasicFeeTickSpacing()[0], 3n)
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
      calculateSqrtPrice(initTick),
      initTick
    )

    const poolKey = newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

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
        MAX_SQRT_PRICE
      )
    }
    verifyPositionList(invariant, positionsOwner.address, BigInt(minMaxTicks.length), true)
  })
  test('add and remove multiple positions', async () => {
    const feeTier = newFeeTier(getBasicFeeTickSpacing()[0], 3n)
    const poolKey = newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)
    const { sqrtPrice: slippageLimitLower } = await getPool(invariant, poolKey)

    // remove middle position
    {
      const lastPosition = await getPosition(invariant, positionsOwner.address, 3n)
      await removePosition(invariant, positionsOwner, 1n)
      const replacedPosition = await getPosition(invariant, positionsOwner.address, 1n)

      expect(replacedPosition).toStrictEqual(lastPosition)
      verifyPositionList(invariant, positionsOwner.address, 3n, true)
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
        MAX_SQRT_PRICE
      )
      await getPosition(invariant, positionsOwner.address, 3n)
    }
    // remove last position
    {
      await removePosition(invariant, positionsOwner, 3n)
      await expectError(
        InvariantError.PositionNotFound,
        getPosition(invariant, positionsOwner.address, 3n)
      )
    }
    // remove all positions
    {
      for (let n = 2n; n >= 0; --n) {
        await removePosition(invariant, positionsOwner, n)
        verifyPositionList(invariant, positionsOwner.address, n, true)
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
        MAX_SQRT_PRICE
      )
      const position = await getPosition(invariant, positionsOwner.address, 0n)
      expect(position).toMatchObject({
        poolKey,
        lowerTickIndex: tickIndexes[0],
        upperTickIndex: tickIndexes[1],
        liquidity: liquiditiyDelta,
        owner: positionsOwner.address
      })
      await expectError(
        InvariantError.PositionNotFound,
        getPosition(invariant, positionsOwner.address, 1n)
      )
    }
  })

  test('only owner can modify position list', async () => {
    const notOwner = await getSigner(ONE_ALPH * 1000n, 0)
    await expectError(
      InvariantError.PositionNotFound,
      removePosition(invariant, notOwner, 3n),
      invariant
    )
  })

  test('transfer position ownership', async () => {
    const positionsRecipient = await getSigner(ONE_ALPH * 1000n, 0)

    // transfer position at the current first index
    await transferAndVerifyPosition(
      invariant,
      positionsOwner,
      3n,
      0n,
      positionsRecipient.address,
      0n
    )

    // transfer position at the current middle index
    await transferAndVerifyPosition(
      invariant,
      positionsOwner,
      2n,
      1n,
      positionsRecipient.address,
      1n
    )

    // transfer position at the current last index
    await transferAndVerifyPosition(
      invariant,
      positionsOwner,
      1n,
      0n,
      positionsRecipient.address,
      2n
    )

    // transfer the last position of positionsOwner
    await transferAndVerifyPosition(
      invariant,
      positionsOwner,
      0n,
      0n,
      positionsRecipient.address,
      3n
    )

    // get back the first position
    await transferAndVerifyPosition(
      invariant,
      positionsRecipient,
      3n,
      0n,
      positionsOwner.address,
      0n
    )
  })

  test('only owner can transfer position', async () => {
    const notOwner = await getSigner(ONE_ALPH * 1000n, 0)
    await expectError(
      InvariantError.PositionNotFound,
      transferPosition(invariant, notOwner, 1n, notOwner.address),
      invariant
    )
  })
})
