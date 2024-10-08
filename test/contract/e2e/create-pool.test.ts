import { ONE_ALPH, addressFromContractId, fetchContractState, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { newFeeTier, newPoolKey } from '../../../src/utils'
import { CLAMMError, InvariantError } from '../../../src/consts'
import {
  getPool,
  initPool,
  initFeeTier,
  initTokensXY,
  expectError,
  TokenInstance,
  deployInvariant
} from '../../../src/testUtils'
import { CLAMM, Invariant, InvariantInstance } from '../../../artifacts/ts'
import { calculateSqrtPrice, toPercentage, toSqrtPrice } from '../../../src/math'
import { SqrtPrice, TokenAmount } from '../../../src/types'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let invariant: InvariantInstance
let tokenX: TokenInstance
let tokenY: TokenInstance
let admin: PrivateKeyWallet
let poolCreator: PrivateKeyWallet

describe('create pool tests', () => {
  const protocolFee = toPercentage(1n, 2n)
  const fee = toPercentage(5n, 1n)
  const supply = (10n ** 6n + 1000n) as TokenAmount

  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
    poolCreator = await getSigner(ONE_ALPH * 1000n, 0)
  })
  beforeEach(async () => {
    invariant = await deployInvariant(admin, protocolFee)
    ;[tokenX, tokenY] = await initTokensXY(admin, supply)
  })
  test('create pool', async () => {
    const tickSpacing = 100n
    const feeTier = newFeeTier(fee, tickSpacing)
    await initFeeTier(invariant, admin, feeTier)

    const poolKey = newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    const initTick = 0n
    const initSqrtPrice = toSqrtPrice(1n)
    await initPool(invariant, poolCreator, tokenX, tokenY, feeTier, initSqrtPrice, initTick)

    const pool = await getPool(invariant, poolKey)
    const expectedPool = {
      currentTickIndex: initTick,
      sqrtPrice: initSqrtPrice,
      feeGrowthGlobalX: 0n,
      feeGrowthGlobalY: 0n,
      feeProtocolTokenX: 0n,
      feeProtocolTokenY: 0n,
      liquidity: 0n,
      poolKey,
      feeReceiver: admin.address
    }
    expect(pool).toMatchObject(expectedPool)
  })
  test('x to y and y to x', async () => {
    const tickSpacing = 100n
    const feeTier = newFeeTier(fee, tickSpacing)
    await initFeeTier(invariant, admin, feeTier)

    const supply = (10n ** 6n + 1000n) as TokenAmount
    const [tokenX, tokenY] = await initTokensXY(admin, supply)
    const poolKey = newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    const initTick = 0n
    const initSqrtPrice = toSqrtPrice(1n)
    await initPool(invariant, poolCreator, tokenX, tokenY, feeTier, initSqrtPrice, initTick)

    await getPool(invariant, poolKey)

    await expectError(
      InvariantError.PoolKeyAlreadyExist,
      initPool(invariant, poolCreator, tokenY, tokenX, feeTier, initSqrtPrice, initTick),
      invariant
    )
  })
  test('with same tokens', async () => {
    const tickSpacing = 100n
    const feeTier = newFeeTier(fee, tickSpacing)
    await initFeeTier(invariant, admin, feeTier)

    const supply = (10n ** 6n + 1000n) as TokenAmount
    const [tokenX] = await initTokensXY(admin, supply)

    const initTick = 0n
    const initSqrtPrice = toSqrtPrice(1n)

    await expectError(
      InvariantError.TokensAreSame,
      initPool(invariant, poolCreator, tokenX, tokenX, feeTier, initSqrtPrice, initTick),
      invariant
    )
  })
  test('fee tier not added', async () => {
    const tickSpacing = 100n
    const feeTier = newFeeTier(fee, tickSpacing)

    const supply = (10n ** 6n + 1000n) as TokenAmount
    const [tokenX, tokenY] = await initTokensXY(admin, supply)

    const initTick = 0n
    const initSqrtPrice = toSqrtPrice(1n)

    await expectError(
      InvariantError.FeeTierNotFound,
      initPool(invariant, poolCreator, tokenX, tokenY, feeTier, initSqrtPrice, initTick),
      invariant
    )
  })
  test('init tick not divided by tick spacing', async () => {
    const tickSpacing = 3n
    const feeTier = newFeeTier(fee, tickSpacing)
    await initFeeTier(invariant, admin, feeTier)

    const supply = (10n ** 6n + 1000n) as TokenAmount
    const [tokenX, tokenY] = await initTokensXY(admin, supply)

    const initTick = 2n
    const initSqrtPrice = calculateSqrtPrice(initTick)

    const clamm = CLAMM.at(
      addressFromContractId((await fetchContractState(Invariant, invariant)).fields.clamm)
    )
    await expectError(
      CLAMMError.InvalidTickSpacing,
      initPool(invariant, poolCreator, tokenX, tokenY, feeTier, initSqrtPrice, initTick),
      clamm
    )
  })
  test('init sqrt price minimal difference from tick', async () => {
    const tickSpacing = 3n
    const feeTier = newFeeTier(fee, tickSpacing)
    await initFeeTier(invariant, admin, feeTier)

    const supply = (10n ** 6n + 1000n) as TokenAmount
    const [tokenX, tokenY] = await initTokensXY(admin, supply)
    const poolKey = newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    const initTick = 0n
    const initSqrtPrice = (calculateSqrtPrice(initTick) + 1n) as SqrtPrice
    await initPool(invariant, poolCreator, tokenX, tokenY, feeTier, initSqrtPrice, initTick)

    const pool = await getPool(invariant, poolKey)
    expect(pool.currentTickIndex).toBe(initTick)
  })
  test('init sqrt price has closer init tick', async () => {
    const tickSpacing = 1n
    const feeTier = newFeeTier(fee, tickSpacing)
    await initFeeTier(invariant, admin, feeTier)

    const supply = (10n ** 6n + 1000n) as TokenAmount
    const [tokenX, tokenY] = await initTokensXY(admin, supply)
    const poolKey = newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    const initTick = 2n
    const initSqrtPrice = 1000175003749000000000000n as SqrtPrice
    await expectError(
      InvariantError.TickAndSqrtPriceMismatch,
      initPool(invariant, poolCreator, tokenX, tokenY, feeTier, initSqrtPrice, initTick),
      invariant
    )

    const correctInitTick = 3n
    await initPool(invariant, poolCreator, tokenX, tokenY, feeTier, initSqrtPrice, correctInitTick)

    const pool = await getPool(invariant, poolKey)
    expect(pool.currentTickIndex).toBe(correctInitTick)
  })
  test('init sqrt price has closer init tick with tick spacing over one', async () => {
    const tickSpacing = 3n
    const feeTier = newFeeTier(fee, tickSpacing)
    await initFeeTier(invariant, admin, feeTier)

    const supply = (10n ** 6n + 1000n) as TokenAmount
    const [tokenX, tokenY] = await initTokensXY(admin, supply)
    const poolKey = newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    const initTick = 0n
    const initSqrtPrice = 1000225003749000000000000n as SqrtPrice
    await expectError(
      InvariantError.TickAndSqrtPriceMismatch,
      initPool(invariant, poolCreator, tokenX, tokenY, feeTier, initSqrtPrice, initTick),
      invariant
    )

    const correctInitTick = 3n
    await initPool(invariant, poolCreator, tokenX, tokenY, feeTier, initSqrtPrice, correctInitTick)

    const pool = await getPool(invariant, poolKey)
    expect(pool.currentTickIndex).toBe(correctInitTick)
  })
})
