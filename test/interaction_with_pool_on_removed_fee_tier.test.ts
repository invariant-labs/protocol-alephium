import { DUST_AMOUNT, ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { MAP_ENTRY_DEPOSIT, balanceOf, deployInvariant, newFeeTier, newPoolKey } from '../src/utils'
import { InvariantError, MinSqrtPrice, PercentageScale } from '../src/consts'
import {
  getPool,
  initPool,
  initFeeTier,
  initTokensXY,
  removeFeeTier,
  feeTierExists,
  withdrawTokens,
  initPosition,
  initSwap,
  removePosition,
  getPools,
  getPosition,
  expectError,
  toLiquidity
} from '../src/testUtils'
import {
  ChangeFeeReceiver,
  ClaimFee,
  InvariantInstance,
  TokenFaucetInstance,
  TransferPosition,
  WithdrawProtocolFee
} from '../artifacts/ts'
import { FeeTier, PoolKey } from '../artifacts/ts/types'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let admin: PrivateKeyWallet
let poolCreator: PrivateKeyWallet
let positionOwner: PrivateKeyWallet
let swapper: PrivateKeyWallet
let feeReceiver: PrivateKeyWallet
let recipient: PrivateKeyWallet
let invariant: InvariantInstance
let tokenX: TokenFaucetInstance
let tokenY: TokenFaucetInstance

describe('interaction with pool on removed fee tiers tests', () => {
  const protocolFee = 10n ** (PercentageScale - 2n)
  const fee = 6n * 10n ** (PercentageScale - 3n)
  const tickSpacing = 10n
  const initTick = 0n
  const initSqrtPrice = 10n ** 24n
  const supply = 10n ** 18n
  const lowerTickIndex = -20n
  const upperTickIndex = 10n
  const mint = 10n ** 10n
  const liquidityDelta = toLiquidity(1000000n)
  let feeTier: FeeTier
  let poolKey: PoolKey

  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
    poolCreator = await getSigner(ONE_ALPH * 1000n, 0)
    positionOwner = await getSigner(ONE_ALPH * 2000n, 0)
    swapper = await getSigner(ONE_ALPH * 1000n, 0)
    feeReceiver = await getSigner(ONE_ALPH * 1000n, 0)
    recipient = await getSigner(ONE_ALPH * 1000n, 0)
  })
  test('create pool', async () => {
    invariant = await deployInvariant(admin, protocolFee)

    feeTier = await newFeeTier(fee, tickSpacing)
    await initFeeTier(invariant, admin, feeTier)
    ;[tokenX, tokenY] = await initTokensXY(admin, supply)
    poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    await initPool(invariant, poolCreator, tokenX, tokenY, feeTier, initSqrtPrice, initTick)

    await getPool(invariant, poolKey)
  })
  test('remove fee tier', async () => {
    await removeFeeTier(invariant, admin, feeTier)
    const [exists] = await feeTierExists(invariant, feeTier)
    expect(exists).toBeFalsy()
  })
  test('try to create same pool again', async () => {
    await expectError(
      InvariantError.FeeTierNotFound,
      initPool(invariant, poolCreator, tokenX, tokenY, feeTier, initSqrtPrice, initTick),
      invariant
    )
  })
  test('init position', async () => {
    await withdrawTokens(positionOwner, [tokenX, mint], [tokenY, mint])

    const poolBefore = await getPool(invariant, poolKey)
    const [slippageLimitLower, slippageLimitUpper] = [poolBefore.sqrtPrice, poolBefore.sqrtPrice]
    await initPosition(
      invariant,
      positionOwner,
      poolKey,
      mint,
      mint,
      lowerTickIndex,
      upperTickIndex,
      liquidityDelta,
      slippageLimitLower,
      slippageLimitUpper
    )

    const poolAfter = await getPool(invariant, poolKey)

    expect(poolAfter.liquidity).toBe(liquidityDelta)
  })
  test('init swap', async () => {
    const amount = 1000n
    await withdrawTokens(swapper, [tokenX, amount], [tokenY, amount])
    const invariantTokenXBalanceBefore = await balanceOf(tokenX.contractId, invariant.address)
    const invariantTokenYBalanceBefore = await balanceOf(tokenY.contractId, invariant.address)
    expect(invariantTokenXBalanceBefore).toBe(500n)
    expect(invariantTokenYBalanceBefore).toBe(1000n)

    const poolBefore = await getPool(invariant, poolKey)
    const slippage = MinSqrtPrice
    await initSwap(invariant, swapper, poolKey, true, amount, true, slippage)
    const poolAfter = await getPool(invariant, poolKey)
    expect(poolAfter.liquidity).toBe(poolBefore.liquidity)
    expect(poolAfter.currentTickIndex).toBe(lowerTickIndex)
    expect(poolAfter.sqrtPrice).toBeLessThan(poolBefore.sqrtPrice)
    expect(poolAfter.feeGrowthGlobalX).toBe(50000000000000000000000n)
    expect(poolAfter.feeGrowthGlobalY).toBe(0n)
    expect(poolAfter.feeProtocolTokenX).toBe(1n)
    expect(poolAfter.feeProtocolTokenY).toBe(0n)

    const swapperX = await balanceOf(tokenX.contractId, swapper.address)
    const swapperY = await balanceOf(tokenY.contractId, swapper.address)
    expect(swapperX).toBe(0n)
    expect(swapperY).toBe(1993n) // 1000 initial mint + 993 as a swap result

    const dexX = await balanceOf(tokenX.contractId, invariant.address)
    const dexY = await balanceOf(tokenY.contractId, invariant.address)
    expect(dexX).toBe(1500n)
    expect(dexY).toBe(7n)
  })
  test('claim fee', async () => {
    const xBefore = await balanceOf(tokenX.contractId, positionOwner.address)
    const yBefore = await balanceOf(tokenY.contractId, positionOwner.address)

    await ClaimFee.execute(positionOwner, {
      initialFields: {
        invariant: invariant.contractId,
        index: 1n
      },
      attoAlphAmount: DUST_AMOUNT
    })
    const expectedTokensClaimed = 5n
    const xAfter = await balanceOf(tokenX.contractId, positionOwner.address)
    const yAfter = await balanceOf(tokenY.contractId, positionOwner.address)

    expect(xAfter - xBefore).toBe(expectedTokensClaimed)
    expect(yAfter - yBefore).toBe(0n)
  })
  test('change fee receiver', async () => {
    await ChangeFeeReceiver.execute(admin, {
      initialFields: {
        invariant: invariant.contractId,
        poolKey,
        newFeeReceiver: feeReceiver.address
      }
    })
    const pool = await getPool(invariant, poolKey)
    expect(pool.feeReceiver).toBe(feeReceiver.address)
  })
  test('withdraw protocol fee', async () => {
    const xBefore = await balanceOf(tokenX.contractId, feeReceiver.address)
    const yBefore = await balanceOf(tokenY.contractId, feeReceiver.address)

    await WithdrawProtocolFee.execute(feeReceiver, {
      initialFields: {
        invariant: invariant.contractId,
        poolKey
      },
      attoAlphAmount: DUST_AMOUNT
    })
    const xAfter = await balanceOf(tokenX.contractId, feeReceiver.address)
    const yAfter = await balanceOf(tokenY.contractId, feeReceiver.address)
    expect(xAfter - xBefore).toBe(1n)
    expect(yAfter - yBefore).toBe(0n)
  })
  test('close position', async () => {
    await removePosition(invariant, positionOwner, 1n)
  })
  test('get pool', async () => {
    await getPool(invariant, poolKey)
  })
  test('get pools', async () => {
    const pools = await getPools(invariant)
    expect(pools.length).toBe(1)
  })
  test('transfer position', async () => {
    const positionOwner = await getSigner(ONE_ALPH * 1000n, 0)

    await withdrawTokens(positionOwner, [tokenX, mint], [tokenY, mint])

    const poolBefore = await getPool(invariant, poolKey)
    const [slippageLimitLower, slippageLimitUpper] = [poolBefore.sqrtPrice, poolBefore.sqrtPrice]

    const xBalance = await balanceOf(tokenX.contractId, positionOwner.address)
    const yBalance = await balanceOf(tokenY.contractId, positionOwner.address)

    await initPosition(
      invariant,
      positionOwner,
      poolKey,
      xBalance,
      yBalance,
      lowerTickIndex,
      upperTickIndex,
      liquidityDelta,
      slippageLimitLower,
      slippageLimitUpper
    )

    await TransferPosition.execute(positionOwner, {
      initialFields: {
        invariant: invariant.contractId,
        index: 1n,
        recipient: recipient.address
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT * 2n + DUST_AMOUNT * 2n
    })

    const transferedPosition = await getPosition(invariant, recipient.address, 1n)
    expect(transferedPosition.exists).toBe(true)
    expect(transferedPosition.liquidity).toBe(liquidityDelta)
    expect(transferedPosition.lowerTickIndex).toBe(lowerTickIndex)
    expect(transferedPosition.upperTickIndex).toBe(upperTickIndex)
    expect(transferedPosition.feeGrowthInsideX).toBe(0n)
    expect(transferedPosition.feeGrowthInsideY).toBe(0n)
    expect(transferedPosition.lastBlockNumber).toBeGreaterThan(0n)
    expect(transferedPosition.tokensOwedX).toBe(0n)
    expect(transferedPosition.tokensOwedY).toBe(0n)
    expect(transferedPosition.owner).toBe(recipient.address)
  })
  test('readd fee tier and try to create same pool', async () => {
    await initFeeTier(invariant, admin, feeTier)

    await expectError(
      InvariantError.PoolKeyAlreadyExist,
      initPool(invariant, poolCreator, tokenX, tokenY, feeTier, initSqrtPrice, initTick),
      invariant
    )
  })
})
