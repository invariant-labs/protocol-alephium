import { ONE_ALPH, addressFromContractId, fetchContractState, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { CLAMM, Invariant } from '../artifacts/ts'
import { balanceOf, deployInvariant, newFeeTier, newPoolKey } from '../src/utils'
import {
  expectError,
  getPool,
  getPosition,
  getReserveBalances,
  getTick,
  initFeeTier,
  initPool,
  initPosition,
  initSwap,
  initTokensXY,
  isTickInitialized,
  toLiquidity,
  removePosition,
  withdrawTokens
} from '../src/testUtils'
import { InvariantError, MaxSqrtPrice, MinSqrtPrice, PercentageScale } from '../src/consts'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let admin: PrivateKeyWallet

describe('position tests', () => {
  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
  })

  test('Create basic position', async () => {
    const positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
    const supply = 500n
    const fee = 0n
    const tickSpacing = 1n

    const invariant = await deployInvariant(admin, 0n)
    const [tokenX, tokenY] = await initTokensXY(admin, supply)

    const feeTier = await newFeeTier(fee, tickSpacing)
    const poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    await withdrawTokens(positionOwner, [tokenX, supply], [tokenY, supply])

    const initTick = 10n
    const initSqrtPrice = (
      await invariant.view.calculateSqrtPrice({ args: { tickIndex: initTick } })
    ).returns

    await initFeeTier(invariant, admin, feeTier)
    await initPool(invariant, admin, tokenX, tokenY, feeTier, initSqrtPrice, initTick)

    const lowerTickIndex = -10n
    const upperTickIndex = 10n
    const liquidityDelta = 10n

    await initPosition(
      invariant,
      positionOwner,
      poolKey,
      supply,
      supply,
      lowerTickIndex,
      upperTickIndex,
      liquidityDelta,
      0n,
      MaxSqrtPrice
    )

    const position = await getPosition(invariant, positionOwner.address, 0n)
    const expectedPosition = {
      exists: true,
      liquidity: 10n,
      lowerTickIndex: -10n,
      upperTickIndex: 10n,
      feeGrowthInsideX: 0n,
      feeGrowthInsideY: 0n,
      tokensOwedX: 0n,
      tokensOwedY: 0n,
      owner: positionOwner.address
    }
    const pool = await getPool(invariant, poolKey)
    expect(pool.liquidity).toBe(0n)
    expect(position).toMatchObject(expectedPosition)
  })
  test('Create position with equal lower and upper tick', async () => {
    const positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
    const supply = 500n
    const fee = 0n
    const tickSpacing = 1n

    const invariant = await deployInvariant(admin, 0n)
    const [tokenX, tokenY] = await initTokensXY(admin, supply)
    await withdrawTokens(positionOwner, [tokenX, supply], [tokenY, supply])

    const feeTier = await newFeeTier(fee, tickSpacing)
    const poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    const initTick = 10n
    const initSqrtPrice = (
      await invariant.view.calculateSqrtPrice({ args: { tickIndex: initTick } })
    ).returns

    await initFeeTier(invariant, admin, feeTier)
    await initPool(invariant, admin, tokenX, tokenY, feeTier, initSqrtPrice, initTick)

    const tickIndex = 10n

    const liquidityDelta = 10n

    const clamm = CLAMM.at(
      addressFromContractId((await fetchContractState(Invariant, invariant)).fields.clamm)
    )

    await expectError(
      InvariantError.InvalidTickIndex,
      initPosition(
        invariant,
        positionOwner,
        poolKey,
        supply,
        supply,
        tickIndex,
        tickIndex,
        liquidityDelta,
        0n,
        MaxSqrtPrice
      ),
      invariant
    )
  })
  test('remove position', async () => {
    const positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
    const supply = 10n ** 20n + 1000n
    const mint = 10n ** 10n
    const protocolFee = 10n ** (PercentageScale - 2n)
    const fee = 6n * 10n ** (PercentageScale - 3n)
    const tickSpacing = 10n

    const invariant = await deployInvariant(admin, protocolFee)
    const [tokenX, tokenY] = await initTokensXY(admin, supply)
    await withdrawTokens(positionOwner, [tokenX, mint], [tokenY, mint])

    const feeTier = await newFeeTier(fee, tickSpacing)
    const poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    const initTick = 0n
    const initSqrtPrice = (
      await invariant.view.calculateSqrtPrice({ args: { tickIndex: initTick } })
    ).returns

    await initFeeTier(invariant, admin, feeTier)
    await initPool(invariant, admin, tokenX, tokenY, feeTier, initSqrtPrice, initTick)

    const lowerTickIndex = -20n
    const upperTickIndex = 10n
    const incorrectLowerTickIndex = lowerTickIndex - 50n
    const incorrectUpperTickIndex = upperTickIndex + 50n

    {
      const liquidityDelta = toLiquidity(1000000n)
      const poolBefore = await getPool(invariant, poolKey)
      const ownerX = await balanceOf(tokenX.contractId, positionOwner.address)
      const ownerY = await balanceOf(tokenY.contractId, positionOwner.address)
      const [slippageLimitLower, slippageLimitUpper] = [poolBefore.sqrtPrice, poolBefore.sqrtPrice]

      await initPosition(
        invariant,
        positionOwner,
        poolKey,
        ownerX,
        ownerY,
        lowerTickIndex,
        upperTickIndex,
        liquidityDelta,
        slippageLimitLower,
        slippageLimitUpper
      )

      const position = await getPosition(invariant, positionOwner.address, 0n)
      const expectedPosition = {
        exists: true,
        liquidity: liquidityDelta,
        lowerTickIndex,
        upperTickIndex,
        feeGrowthInsideX: 0n,
        feeGrowthInsideY: 0n,
        tokensOwedX: 0n,
        tokensOwedY: 0n,
        owner: positionOwner.address
      }
      const pool = await getPool(invariant, poolKey)
      expect(pool.liquidity).toBe(liquidityDelta)
      expect(position).toMatchObject(expectedPosition)
    }
    {
      const liquidityDelta = toLiquidity(1000000n * 1000000n)
      const poolBefore = await getPool(invariant, poolKey)
      await withdrawTokens(positionOwner, [tokenX, mint], [tokenY, mint])
      const ownerX = await balanceOf(tokenX.contractId, positionOwner.address)
      const ownerY = await balanceOf(tokenY.contractId, positionOwner.address)

      const [slippageLimitLower, slippageLimitUpper] = [poolBefore.sqrtPrice, poolBefore.sqrtPrice]

      await initPosition(
        invariant,
        positionOwner,
        poolKey,
        ownerX,
        ownerY,
        incorrectLowerTickIndex,
        incorrectUpperTickIndex,
        liquidityDelta,
        slippageLimitLower,
        slippageLimitUpper
      )

      const position = await getPosition(invariant, positionOwner.address, 1n)
      const expectedPosition = {
        exists: true,
        liquidity: liquidityDelta,
        lowerTickIndex: incorrectLowerTickIndex,
        upperTickIndex: incorrectUpperTickIndex,
        feeGrowthInsideX: 0n,
        feeGrowthInsideY: 0n,
        tokensOwedX: 0n,
        tokensOwedY: 0n,
        owner: positionOwner.address
      }
      const pool = await getPool(invariant, poolKey)
      expect(pool.liquidity).toBe(liquidityDelta + toLiquidity(1000000n))
      expect(position).toMatchObject(expectedPosition)
    }

    const swapper = await getSigner(ONE_ALPH * 1000n, 0)
    const amount = 1000n
    await withdrawTokens(swapper, [tokenX, amount], [tokenY, amount])

    const poolBefore = await getPool(invariant, poolKey)
    const slippage = MinSqrtPrice

    await initSwap(invariant, swapper, poolKey, true, amount, true, slippage)

    const poolAfter = await getPool(invariant, poolKey)

    const expectedPool = {
      exists: true,
      poolKey,
      liquidity: poolBefore.liquidity,
      currentTickIndex: -10n,
      feeGrowthGlobalX: 49999950000049999n,
      feeGrowthGlobalY: 0n,
      feeProtocolTokenX: 1n,
      feeProtocolTokenY: 0n,
      feeReceiver: admin.address
    }
    expect(poolAfter).toMatchObject(expectedPool)

    const swapperX = await balanceOf(tokenX.contractId, swapper.address)
    const swapperY = await balanceOf(tokenY.contractId, swapper.address)
    expect(swapperX).toBe(0n)
    expect(swapperY).toBe(1993n)

    const { x: dexXBefore, y: dexYBefore } = await getReserveBalances(invariant, poolKey)

    await removePosition(invariant, positionOwner, 0n)

    const pool = await getPool(invariant, poolKey)
    const { exists: lowerInMap } = await getTick(invariant, poolKey, lowerTickIndex)
    const { exists: upperInMap } = await getTick(invariant, poolKey, upperTickIndex)
    const lowerBit = await isTickInitialized(invariant, poolKey, lowerTickIndex)
    const upperBit = await isTickInitialized(invariant, poolKey, upperTickIndex)

    const { x: dexX, y: dexY } = await getReserveBalances(invariant, poolKey)
    const expectedWithdrawnX = 499n
    const expectedWithdrawnY = 999n
    const expectedFeeX = 0n

    expect(dexXBefore - dexX).toBe(expectedWithdrawnX + expectedFeeX)
    expect(dexYBefore - dexY).toBe(expectedWithdrawnY)
    expect(lowerInMap).toBeFalsy()
    expect(upperInMap).toBeFalsy()
    expect(lowerBit).toBeFalsy()
    expect(upperBit).toBeFalsy()
    expect(pool.liquidity).toBe(100000000000000000n)
    expect(pool.currentTickIndex).toBe(-10n)
  })
  test('create position within current tick', async () => {
    const tickSpacing = 4n
    const maxTick = 177450n
    const minTick = -maxTick
    const initTick = -23028n
    const initialBalance = 100000000n
    const protocolFee = 0n
    const fee = 2n * 10n ** (PercentageScale - 4n)

    const positionOwner = await getSigner(ONE_ALPH * 1001n, 0)

    const invariant = await deployInvariant(admin, protocolFee)
    const [tokenX, tokenY] = await initTokensXY(admin, initialBalance)
    await withdrawTokens(positionOwner, [tokenX, initialBalance], [tokenY, initialBalance])

    const feeTier = await newFeeTier(fee, tickSpacing)
    const poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    const initSqrtPrice = (
      await invariant.view.calculateSqrtPrice({ args: { tickIndex: initTick } })
    ).returns

    await initFeeTier(invariant, admin, feeTier)
    await initPool(invariant, admin, tokenX, tokenY, feeTier, initSqrtPrice, initTick)

    const lowerTickIndex = minTick + 10n
    const upperTickIndex = maxTick - 10n

    const liquidityDelta = toLiquidity(100n)

    const poolBefore = await getPool(invariant, poolKey)
    const [slippageLimitLower, slippageLimitUpper] = [poolBefore.sqrtPrice, MaxSqrtPrice]
    await initPosition(
      invariant,
      positionOwner,
      poolKey,
      initialBalance,
      initialBalance,
      lowerTickIndex,
      upperTickIndex,
      liquidityDelta,
      slippageLimitLower,
      slippageLimitUpper
    )

    const position = await getPosition(invariant, positionOwner.address, 0n)
    const pool = await getPool(invariant, poolKey)
    const { exists: lowerInMap, ...lowerTick } = await getTick(invariant, poolKey, lowerTickIndex)
    const { exists: upperInMap, ...upperTick } = await getTick(invariant, poolKey, upperTickIndex)
    const ownerX = await balanceOf(tokenX.contractId, positionOwner.address)
    const ownerY = await balanceOf(tokenY.contractId, positionOwner.address)
    const { x: dexX, y: dexY } = await getReserveBalances(invariant, poolKey)
    const expectedXIncrease = 317n
    const expectedYIncrease = 32n

    expect(lowerInMap).toBeTruthy()
    expect(lowerTick.index).toBe(lowerTickIndex)
    expect(lowerTick.liquidityGross).toBe(liquidityDelta)
    expect(lowerTick.liquidityChange).toBe(liquidityDelta)
    expect(lowerTick.sign).toBeTruthy()

    expect(upperInMap).toBeTruthy()
    expect(upperTick.index).toBe(upperTickIndex)
    expect(upperTick.liquidityGross).toBe(liquidityDelta)
    expect(upperTick.liquidityChange).toBe(liquidityDelta)
    expect(upperTick.sign).toBeFalsy()

    expect(pool.liquidity).toBe(liquidityDelta)
    expect(pool.currentTickIndex).toBe(initTick)

    const expectedPosition = {
      exists: true,
      liquidity: liquidityDelta,
      lowerTickIndex,
      upperTickIndex,
      feeGrowthInsideX: 0n,
      feeGrowthInsideY: 0n,
      tokensOwedX: 0n,
      tokensOwedY: 0n,
      owner: positionOwner.address
    }

    expect(position).toMatchObject(expectedPosition)

    expect(ownerX).toBe(initialBalance - dexX)
    expect(ownerY).toBe(initialBalance - dexY)
    expect(dexX).toBe(expectedXIncrease)
    expect(dexY).toBe(expectedYIncrease)
  })
  test('create position below curent tick', async () => {
    const initTick = -23028n
    const initialBalance = 10000000000n
    const protocolFee = 0n
    const fee = 2n * 10n ** (PercentageScale - 4n)
    const tickSpacing = 4n

    const positionOwner = await getSigner(ONE_ALPH * 1000n, 0)

    const invariant = await deployInvariant(admin, protocolFee)
    const [tokenX, tokenY] = await initTokensXY(admin, initialBalance)
    await withdrawTokens(positionOwner, [tokenX, initialBalance], [tokenY, initialBalance])

    const feeTier = await newFeeTier(fee, tickSpacing)
    const poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    const initSqrtPrice = (
      await invariant.view.calculateSqrtPrice({ args: { tickIndex: initTick } })
    ).returns

    await initFeeTier(invariant, admin, feeTier)
    await initPool(invariant, admin, tokenX, tokenY, feeTier, initSqrtPrice, initTick)

    const lowerTickIndex = -46080n
    const upperTickIndex = -23040n

    const liquidityDelta = toLiquidity(10000n)

    const poolBefore = await getPool(invariant, poolKey)
    const [slippageLimitLower, slippageLimitUpper] = [poolBefore.sqrtPrice, MaxSqrtPrice]

    await initPosition(
      invariant,
      positionOwner,
      poolKey,
      initialBalance,
      initialBalance,
      lowerTickIndex,
      upperTickIndex,
      liquidityDelta,
      slippageLimitLower,
      slippageLimitUpper
    )

    const position = await getPosition(invariant, positionOwner.address, 0n)
    const pool = await getPool(invariant, poolKey)
    const { exists: lowerInMap, ...lowerTick } = await getTick(invariant, poolKey, lowerTickIndex)
    const { exists: upperInMap, ...upperTick } = await getTick(invariant, poolKey, upperTickIndex)
    const lowerBit = await isTickInitialized(invariant, poolKey, lowerTickIndex)
    const upperBit = await isTickInitialized(invariant, poolKey, upperTickIndex)
    const ownerX = await balanceOf(tokenX.contractId, positionOwner.address)
    const ownerY = await balanceOf(tokenY.contractId, positionOwner.address)
    const { x: dexX, y: dexY } = await getReserveBalances(invariant, poolKey)
    const expectedXIncrease = 0n
    const expectedYIncrease = 2162n

    expect(lowerInMap).toBeTruthy()
    expect(lowerTick.index).toBe(lowerTickIndex)
    expect(lowerTick.liquidityGross).toBe(liquidityDelta)
    expect(lowerTick.liquidityChange).toBe(liquidityDelta)
    expect(lowerTick.sign).toBeTruthy()
    expect(lowerBit).toBeTruthy()

    expect(upperInMap).toBeTruthy()
    expect(upperTick.index).toBe(upperTickIndex)
    expect(upperTick.liquidityGross).toBe(liquidityDelta)
    expect(upperTick.liquidityChange).toBe(liquidityDelta)
    expect(upperTick.sign).toBeFalsy()
    expect(upperBit).toBeTruthy()

    expect(pool.liquidity).toBe(0n)
    expect(pool.currentTickIndex).toBe(initTick)

    const expectedPosition = {
      exists: true,
      liquidity: liquidityDelta,
      lowerTickIndex,
      upperTickIndex,
      feeGrowthInsideX: 0n,
      feeGrowthInsideY: 0n,
      tokensOwedX: 0n,
      tokensOwedY: 0n,
      owner: positionOwner.address
    }

    expect(position).toMatchObject(expectedPosition)

    expect(ownerX).toBe(initialBalance - dexX)
    expect(ownerY).toBe(initialBalance - dexY)
    expect(dexX).toBe(expectedXIncrease)
    expect(dexY).toBe(expectedYIncrease)
  })
  test('create position above current tick', async () => {
    const initTick = -23028n
    const initialBalance = 10000000000n
    const protocolFee = 0n
    const fee = 2n * 10n ** (PercentageScale - 4n)
    const tickSpacing = 4n

    const positionOwner = await getSigner(ONE_ALPH * 1000n, 0)

    const invariant = await deployInvariant(admin, protocolFee)
    const [tokenX, tokenY] = await initTokensXY(admin, initialBalance)
    await withdrawTokens(positionOwner, [tokenX, initialBalance], [tokenY, initialBalance])

    const feeTier = await newFeeTier(fee, tickSpacing)
    const poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    const initSqrtPrice = (
      await invariant.view.calculateSqrtPrice({ args: { tickIndex: initTick } })
    ).returns

    await initFeeTier(invariant, admin, feeTier)
    await initPool(invariant, admin, tokenX, tokenY, feeTier, initSqrtPrice, initTick)

    const lowerTickIndex = -22980n
    const upperTickIndex = 0n

    const liquidityDelta = toLiquidity(10000n)

    const poolBefore = await getPool(invariant, poolKey)
    const [slippageLimitLower, slippageLimitUpper] = [poolBefore.sqrtPrice, MaxSqrtPrice]

    await initPosition(
      invariant,
      positionOwner,
      poolKey,
      initialBalance,
      initialBalance,
      lowerTickIndex,
      upperTickIndex,
      liquidityDelta,
      slippageLimitLower,
      slippageLimitUpper
    )

    const position = await getPosition(invariant, positionOwner.address, 0n)
    const pool = await getPool(invariant, poolKey)
    const { exists: lowerInMap, ...lowerTick } = await getTick(invariant, poolKey, lowerTickIndex)
    const { exists: upperInMap, ...upperTick } = await getTick(invariant, poolKey, upperTickIndex)
    const ownerX = await balanceOf(tokenX.contractId, positionOwner.address)
    const ownerY = await balanceOf(tokenY.contractId, positionOwner.address)
    const { x: dexX, y: dexY } = await getReserveBalances(invariant, poolKey)
    const expectedXIncrease = 21549n
    const expectedYIncrease = 0n

    expect(lowerInMap).toBeTruthy()
    expect(lowerTick.index).toBe(lowerTickIndex)
    expect(lowerTick.liquidityGross).toBe(liquidityDelta)
    expect(lowerTick.liquidityChange).toBe(liquidityDelta)
    expect(lowerTick.sign).toBeTruthy()

    expect(upperInMap).toBeTruthy()
    expect(upperTick.index).toBe(upperTickIndex)
    expect(upperTick.liquidityGross).toBe(liquidityDelta)
    expect(upperTick.liquidityChange).toBe(liquidityDelta)
    expect(upperTick.sign).toBeFalsy()

    expect(pool.liquidity).toBe(0n)
    expect(pool.currentTickIndex).toBe(initTick)

    const expectedPosition = {
      exists: true,
      liquidity: liquidityDelta,
      lowerTickIndex,
      upperTickIndex,
      feeGrowthInsideX: 0n,
      feeGrowthInsideY: 0n,
      tokensOwedX: 0n,
      tokensOwedY: 0n,
      owner: positionOwner.address
    }

    expect(position).toMatchObject(expectedPosition)

    expect(ownerX).toBe(initialBalance - dexX)
    expect(ownerY).toBe(initialBalance - dexY)
    expect(dexX).toBe(expectedXIncrease)
    expect(dexY).toBe(expectedYIncrease)
  })
})
