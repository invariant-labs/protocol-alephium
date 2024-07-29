import { ALPH_TOKEN_ID, ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { balanceOf, newFeeTier, newPoolKey } from '../../../src/utils'
import { MIN_SQRT_PRICE, PERCENTAGE_SCALE } from '../../../src/consts'
import { initTokensXY, withdrawTokens } from '../../../src/testUtils'
import { TokenFaucetInstance } from '../../../artifacts/ts'
import { FeeTier, PoolKey } from '../../../artifacts/ts/types'
import { Invariant } from '../../../src/invariant'
import { Network } from '../../../src/network'
import { getBasicFeeTickSpacing } from '../../../src/snippets'
import { toLiquidity } from '../../../src/math'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

describe('create pool with ALP token as swappable asset tests', () => {
  const protocolFee = 10n ** (PERCENTAGE_SCALE - 2n)
  const [fee, tickSpacing] = getBasicFeeTickSpacing()
  const positionOwnerMint = 3000n
  const swapperMint = 10n ** 15n
  const supply = positionOwnerMint + swapperMint
  const initTick = 0n
  const initSqrtPrice = 10n ** 24n
  const lowerTick = -20n
  const upperTick = 10n
  const liquidityDelta = toLiquidity(1000000n)
  let admin: PrivateKeyWallet
  let poolCreator: PrivateKeyWallet
  let swapper: PrivateKeyWallet
  let positionOwner: PrivateKeyWallet
  let recipient: PrivateKeyWallet
  let invariant: Invariant
  let feeTier: FeeTier
  let poolKey: PoolKey
  let tokenY: TokenFaucetInstance

  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
    poolCreator = await getSigner(ONE_ALPH * 100n, 0)
    positionOwner = await getSigner(ONE_ALPH * 2000n, 0)
    swapper = await getSigner(ONE_ALPH * 1000n, 0)
    recipient = await getSigner(ONE_ALPH * 1000n, 0)
    invariant = await Invariant.deploy(admin, Network.Local, protocolFee)
    feeTier = await newFeeTier(fee, tickSpacing)
    tokenY = (await initTokensXY(admin, supply))[0]
    await withdrawTokens(positionOwner, [tokenY, positionOwnerMint])
    poolKey = await newPoolKey(tokenY.contractId, ALPH_TOKEN_ID, feeTier)
    await invariant.addFeeTier(admin, feeTier)
  })
  test('create pool', async () => {
    await invariant.createPool(
      poolCreator,
      tokenY.contractId,
      ALPH_TOKEN_ID,
      feeTier,
      initSqrtPrice
    )

    const pool = await invariant.getPool(poolKey)
    const expectedPool = {
      currentTickIndex: initTick,
      sqrtPrice: initSqrtPrice,
      feeGrowthGlobalX: 0n,
      feeGrowthGlobalY: 0n,
      feeProtocolTokenX: 0n,
      feeProtocolTokenY: 0n,
      liquidity: 0n,
      poolKey,
      feeReceiver: admin.address,
      exists: true
    }
    expect(pool).toMatchObject(expectedPool)
  })
  test('init position', async () => {
    const { sqrtPrice } = await invariant.getPool(poolKey)

    const tokenYBalance = await balanceOf(poolKey.tokenY, positionOwner.address)

    await invariant.createPosition(
      positionOwner,
      poolKey,
      lowerTick,
      upperTick,
      liquidityDelta,
      1000n,
      tokenYBalance,
      sqrtPrice,
      sqrtPrice
    )

    const pool = await invariant.getPool(poolKey)
    expect(pool.liquidity).toBe(liquidityDelta)
  })
  test('swap alph token', async () => {
    const swapAmount = 1000n

    const swapperBalanceBefore = {
      alph: await balanceOf(poolKey.tokenX, swapper.address),
      y: await balanceOf(poolKey.tokenY, swapper.address)
    }
    await invariant.swap(swapper, poolKey, true, swapAmount, true, MIN_SQRT_PRICE)
    const swapperBalanceAfter = {
      alph: await balanceOf(poolKey.tokenX, swapper.address),
      y: await balanceOf(poolKey.tokenY, swapper.address)
    }

    // 1000n + Gas fee is transferred from user
    expect(swapperBalanceAfter.alph + swapAmount).toBeLessThan(swapperBalanceBefore.alph)
    expect(swapperBalanceAfter.y).toBe(993n)
  })
  test('claim fee', async () => {
    await invariant.claimFee(positionOwner, 0n)
  })
  test('transfer position', async () => {
    await invariant.transferPosition(positionOwner, 0n, recipient.address)
  })
  test('remove position', async () => {
    await invariant.removePosition(recipient, 0n)
  })
  test('withdraw protocol fee', async () => {
    await invariant.withdrawProtocolFee(admin, poolKey)
  })
})
