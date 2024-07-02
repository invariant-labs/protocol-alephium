import { ONE_ALPH, addressFromContractId, fetchContractState, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { CLAMM, CreatePosition, Invariant } from '../artifacts/ts'
import { balanceOf, deployInvariant } from '../src/utils'
import {
  expectError,
  getPool,
  getPosition,
  getTick,
  initFeeTier,
  initPool,
  initPosition,
  initSwap,
  initTokensXY,
  isTickInitialized,
  removePosition,
  withdrawTokens
} from '../src/testUtils'
import {
  CLAMMError,
  InvariantError,
  LiquidityScale,
  MaxSqrtPrice,
  MinSqrtPrice,
  PercentageScale
} from '../src/consts'

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
    await withdrawTokens(positionOwner, [tokenX, supply], [tokenY, supply])

    const initTick = 10n
    const initSqrtPrice = (
      await invariant.view.calculateSqrtPrice({ args: { tickIndex: initTick } })
    ).returns

    await initFeeTier(invariant, admin, fee, tickSpacing)
    await initPool(invariant, admin, tokenX, tokenY, fee, tickSpacing, initSqrtPrice, initTick)

    const lowerTickIndex = -10n
    const upperTickIndex = 10n
    const liquidityDelta = 10n

    await initPosition(
      invariant,
      positionOwner,
      tokenX,
      supply,
      tokenY,
      supply,
      fee,
      tickSpacing,
      lowerTickIndex,
      upperTickIndex,
      liquidityDelta,
      0n,
      MaxSqrtPrice
    )

    const position = await getPosition(invariant, positionOwner.address, 1n)
    const expectedPosition = {
      exist: true,
      liquidity: 10n,
      lowerTickIndex: -10n,
      upperTickIndex: 10n,
      feeGrowthInsideX: 0n,
      feeGrowthInsideY: 0n,
      tokensOwedX: 0n,
      tokensOwedY: 0n,
      owner: positionOwner.address
    }
    const pool = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
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

    const initTick = 10n
    const initSqrtPrice = (
      await invariant.view.calculateSqrtPrice({ args: { tickIndex: initTick } })
    ).returns

    await initFeeTier(invariant, admin, fee, tickSpacing)
    await initPool(invariant, admin, tokenX, tokenY, fee, tickSpacing, initSqrtPrice, initTick)

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
        tokenX,
        supply,
        tokenY,
        supply,
        fee,
        tickSpacing,
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

    const initTick = 0n
    const initSqrtPrice = (
      await invariant.view.calculateSqrtPrice({ args: { tickIndex: initTick } })
    ).returns

    await initFeeTier(invariant, admin, fee, tickSpacing)
    await initPool(invariant, admin, tokenX, tokenY, fee, tickSpacing, initSqrtPrice, initTick)

    const lowerTickIndex = -20n
    const upperTickIndex = 10n
    const incorrectLowerTickIndex = lowerTickIndex - 50n
    const incorrectUpperTickIndex = upperTickIndex + 50n

    {
      const liquidityDelta = 1000000n * 10n ** LiquidityScale
      const poolBefore = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
      const ownerX = await balanceOf(tokenX.contractId, positionOwner.address)
      const ownerY = await balanceOf(tokenY.contractId, positionOwner.address)
      const [slippageLimitLower, slippageLimitUpper] = [poolBefore.sqrtPrice, poolBefore.sqrtPrice]

      await initPosition(
        invariant,
        positionOwner,
        tokenX,
        ownerX,
        tokenY,
        ownerY,
        fee,
        tickSpacing,
        lowerTickIndex,
        upperTickIndex,
        liquidityDelta,
        slippageLimitLower,
        slippageLimitUpper
      )

      const position = await getPosition(invariant, positionOwner.address, 1n)
      const expectedPosition = {
        exist: true,
        liquidity: liquidityDelta,
        lowerTickIndex,
        upperTickIndex,
        feeGrowthInsideX: 0n,
        feeGrowthInsideY: 0n,
        tokensOwedX: 0n,
        tokensOwedY: 0n,
        owner: positionOwner.address
      }
      const pool = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
      expect(pool.liquidity).toBe(liquidityDelta)
      expect(position).toMatchObject(expectedPosition)
    }
    {
      const liquidityDelta = 1000000n * (1000000n * 10n ** LiquidityScale)
      const poolBefore = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
      await withdrawTokens(positionOwner, [tokenX, mint], [tokenY, mint])
      const ownerX = await balanceOf(tokenX.contractId, positionOwner.address)
      const ownerY = await balanceOf(tokenY.contractId, positionOwner.address)

      const [slippageLimitLower, slippageLimitUpper] = [poolBefore.sqrtPrice, poolBefore.sqrtPrice]

      await initPosition(
        invariant,
        positionOwner,
        tokenX,
        ownerX,
        tokenY,
        ownerY,
        fee,
        tickSpacing,
        incorrectLowerTickIndex,
        incorrectUpperTickIndex,
        liquidityDelta,
        slippageLimitLower,
        slippageLimitUpper
      )

      const position = await getPosition(invariant, positionOwner.address, 2n)
      const expectedPosition = {
        exist: true,
        liquidity: liquidityDelta,
        lowerTickIndex: incorrectLowerTickIndex,
        upperTickIndex: incorrectUpperTickIndex,
        feeGrowthInsideX: 0n,
        feeGrowthInsideY: 0n,
        tokensOwedX: 0n,
        tokensOwedY: 0n,
        owner: positionOwner.address
      }
      const pool = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
      expect(pool.liquidity).toBe(liquidityDelta + 1000000n * 10n ** LiquidityScale)
      expect(position).toMatchObject(expectedPosition)
    }

    const swapper = await getSigner(ONE_ALPH * 1000n, 0)
    const amount = 1000n
    await withdrawTokens(swapper, [tokenX, amount], [tokenY, amount])

    const poolBefore = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
    const slippage = MinSqrtPrice

    await initSwap(
      invariant,
      swapper,
      tokenX,
      tokenY,
      fee,
      tickSpacing,
      true,
      amount,
      true,
      slippage
    )

    const poolAfter = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)

    const expectedPool = {
      exist: true,
      tokenX: tokenX.contractId,
      tokenY: tokenY.contractId,
      fee,
      tickSpacing,
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

    const dexXBefore = await balanceOf(tokenX.contractId, invariant.address)
    const dexYBefore = await balanceOf(tokenY.contractId, invariant.address)

    await removePosition(invariant, positionOwner, 1n)

    const pool = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
    const { exist: lowerInMap } = await getTick(
      invariant,
      tokenX,
      tokenY,
      fee,
      tickSpacing,
      lowerTickIndex
    )
    const { exist: upperInMap } = await getTick(
      invariant,
      tokenX,
      tokenY,
      fee,
      tickSpacing,
      upperTickIndex
    )
    const lowerBit = await isTickInitialized(
      invariant,
      tokenX,
      tokenY,
      fee,
      tickSpacing,
      lowerTickIndex
    )
    const upperBit = await isTickInitialized(
      invariant,
      tokenX,
      tokenY,
      fee,
      tickSpacing,
      upperTickIndex
    )

    const dexX = await balanceOf(tokenX.contractId, invariant.address)
    const dexY = await balanceOf(tokenY.contractId, invariant.address)
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

    const initSqrtPrice = (
      await invariant.view.calculateSqrtPrice({ args: { tickIndex: initTick } })
    ).returns

    await initFeeTier(invariant, admin, fee, tickSpacing)
    await initPool(invariant, admin, tokenX, tokenY, fee, tickSpacing, initSqrtPrice, initTick)

    const lowerTickIndex = minTick + 10n
    const upperTickIndex = maxTick - 10n

    const liquidityDelta = 100n * 10n ** LiquidityScale

    const poolBefore = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
    const [slippageLimitLower, slippageLimitUpper] = [poolBefore.sqrtPrice, MaxSqrtPrice]
    await initPosition(
      invariant,
      positionOwner,
      tokenX,
      initialBalance,
      tokenY,
      initialBalance,
      fee,
      tickSpacing,
      lowerTickIndex,
      upperTickIndex,
      liquidityDelta,
      slippageLimitLower,
      slippageLimitUpper
    )

    const position = await getPosition(invariant, positionOwner.address, 1n)
    const pool = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
    const { exist: lowerInMap, ...lowerTick } = await getTick(
      invariant,
      tokenX,
      tokenY,
      fee,
      tickSpacing,
      lowerTickIndex
    )
    const { exist: upperInMap, ...upperTick } = await getTick(
      invariant,
      tokenX,
      tokenY,
      fee,
      tickSpacing,
      upperTickIndex
    )
    const ownerX = await balanceOf(tokenX.contractId, positionOwner.address)
    const ownerY = await balanceOf(tokenY.contractId, positionOwner.address)
    const dexX = await balanceOf(tokenX.contractId, invariant.address)
    const dexY = await balanceOf(tokenY.contractId, invariant.address)
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
      exist: true,
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

    const initSqrtPrice = (
      await invariant.view.calculateSqrtPrice({ args: { tickIndex: initTick } })
    ).returns

    await initFeeTier(invariant, admin, fee, tickSpacing)
    await initPool(invariant, admin, tokenX, tokenY, fee, tickSpacing, initSqrtPrice, initTick)

    const lowerTickIndex = -46080n
    const upperTickIndex = -23040n

    const liquidityDelta = 10000n * 10n ** LiquidityScale

    const poolBefore = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
    const [slippageLimitLower, slippageLimitUpper] = [poolBefore.sqrtPrice, MaxSqrtPrice]

    await initPosition(
      invariant,
      positionOwner,
      tokenX,
      initialBalance,
      tokenY,
      initialBalance,
      fee,
      tickSpacing,
      lowerTickIndex,
      upperTickIndex,
      liquidityDelta,
      slippageLimitLower,
      slippageLimitUpper
    )

    const position = await getPosition(invariant, positionOwner.address, 1n)
    const pool = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
    const { exist: lowerInMap, ...lowerTick } = await getTick(
      invariant,
      tokenX,
      tokenY,
      fee,
      tickSpacing,
      lowerTickIndex
    )
    const { exist: upperInMap, ...upperTick } = await getTick(
      invariant,
      tokenX,
      tokenY,
      fee,
      tickSpacing,
      upperTickIndex
    )
    const lowerBit = await isTickInitialized(
      invariant,
      tokenX,
      tokenY,
      fee,
      tickSpacing,
      lowerTickIndex
    )
    const upperBit = await isTickInitialized(
      invariant,
      tokenX,
      tokenY,
      fee,
      tickSpacing,
      upperTickIndex
    )
    const ownerX = await balanceOf(tokenX.contractId, positionOwner.address)
    const ownerY = await balanceOf(tokenY.contractId, positionOwner.address)
    const dexX = await balanceOf(tokenX.contractId, invariant.address)
    const dexY = await balanceOf(tokenY.contractId, invariant.address)
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
      exist: true,
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

    const initSqrtPrice = (
      await invariant.view.calculateSqrtPrice({ args: { tickIndex: initTick } })
    ).returns

    await initFeeTier(invariant, admin, fee, tickSpacing)
    await initPool(invariant, admin, tokenX, tokenY, fee, tickSpacing, initSqrtPrice, initTick)

    const lowerTickIndex = -22980n
    const upperTickIndex = 0n

    const liquidityDelta = 10000n * 10n ** LiquidityScale

    const poolBefore = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
    const [slippageLimitLower, slippageLimitUpper] = [poolBefore.sqrtPrice, MaxSqrtPrice]

    await initPosition(
      invariant,
      positionOwner,
      tokenX,
      initialBalance,
      tokenY,
      initialBalance,
      fee,
      tickSpacing,
      lowerTickIndex,
      upperTickIndex,
      liquidityDelta,
      slippageLimitLower,
      slippageLimitUpper
    )

    const position = await getPosition(invariant, positionOwner.address, 1n)
    const pool = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
    const { exist: lowerInMap, ...lowerTick } = await getTick(
      invariant,
      tokenX,
      tokenY,
      fee,
      tickSpacing,
      lowerTickIndex
    )
    const { exist: upperInMap, ...upperTick } = await getTick(
      invariant,
      tokenX,
      tokenY,
      fee,
      tickSpacing,
      upperTickIndex
    )
    const ownerX = await balanceOf(tokenX.contractId, positionOwner.address)
    const ownerY = await balanceOf(tokenY.contractId, positionOwner.address)
    const dexX = await balanceOf(tokenX.contractId, invariant.address)
    const dexY = await balanceOf(tokenY.contractId, invariant.address)
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
      exist: true,
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
