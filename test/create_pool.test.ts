import { ONE_ALPH, addressFromContractId, fetchContractState, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { deployInvariant } from '../src/utils'
import { CLAMMError, InvariantError, PercentageScale } from '../src/consts'
import {
  getPool,
  initPool,
  initFeeTier,
  initTokensXY,
  objectEquals,
  expectError
} from '../src/testUtils'
import { CLAMM, Invariant } from '../artifacts/ts'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let admin: PrivateKeyWallet
let poolCreator: PrivateKeyWallet

describe('invariant tests', () => {
  beforeAll(async () => {
    admin = await getSigner(ONE_ALPH * 1000n, 0)
    poolCreator = await getSigner(ONE_ALPH * 1000n, 0)
  })
  test('create pool', async () => {
    const protocolFee = 10n ** (PercentageScale - 2n)
    const invariant = await deployInvariant(admin, protocolFee)

    const fee = 5n * 10n ** (PercentageScale - 1n)
    const tickSpacing = 100n
    await initFeeTier(invariant, admin, fee, tickSpacing)

    const supply = 10n ** 6n + 1000n
    const [tokenX, tokenY] = await initTokensXY(admin, supply)

    const initTick = 0n
    const initSqrtPrice = 10n ** 24n
    await initPool(
      invariant,
      poolCreator,
      tokenX,
      tokenY,
      fee,
      tickSpacing,
      initSqrtPrice,
      initTick
    )

    const pool = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
    const expectedPool = {
      currentTickIndex: initTick,
      sqrtPrice: initSqrtPrice,
      feeGrowthGlobalX: 0n,
      feeGrowthGlobalY: 0n,
      feeProtocolTokenX: 0n,
      feeProtocolTokenY: 0n,
      liquidity: 0n,
      tokenX: tokenX.contractId,
      tokenY: tokenY.contractId,
      fee,
      tickSpacing,
      feeReceiver: admin.address,
      exist: true
    }

    objectEquals(pool, expectedPool, ['lastTimestamp', 'startTimestamp'])
  })
  test('create pool x to y and y to x', async () => {
    const protocolFee = 10n ** (PercentageScale - 2n)
    const invariant = await deployInvariant(admin, protocolFee)

    const fee = 5n * 10n ** (PercentageScale - 1n)
    const tickSpacing = 100n
    await initFeeTier(invariant, admin, fee, tickSpacing)

    const supply = 10n ** 6n + 1000n
    const [tokenX, tokenY] = await initTokensXY(admin, supply)

    const initTick = 0n
    const initSqrtPrice = 10n ** 24n
    await initPool(
      invariant,
      poolCreator,
      tokenX,
      tokenY,
      fee,
      tickSpacing,
      initSqrtPrice,
      initTick
    )

    await getPool(invariant, tokenX, tokenY, fee, tickSpacing)

    await expectError(
      InvariantError.PoolKeyAlreadyExist,
      invariant,
      initPool(invariant, poolCreator, tokenY, tokenX, fee, tickSpacing, initSqrtPrice, initTick)
    )
  })
  test('create pool with same tokens', async () => {
    const protocolFee = 10n ** (PercentageScale - 2n)
    const invariant = await deployInvariant(admin, protocolFee)

    const fee = 5n * 10n ** (PercentageScale - 1n)
    const tickSpacing = 100n
    await initFeeTier(invariant, admin, fee, tickSpacing)

    const supply = 10n ** 6n + 1000n
    const [tokenX] = await initTokensXY(admin, supply)

    const initTick = 0n
    const initSqrtPrice = 10n ** 24n

    await expectError(
      InvariantError.TokensAreSame,
      invariant,
      initPool(invariant, poolCreator, tokenX, tokenX, fee, tickSpacing, initSqrtPrice, initTick)
    )
  })
  test('create pool fee tier not added', async () => {
    const protocolFee = 10n ** (PercentageScale - 2n)
    const invariant = await deployInvariant(admin, protocolFee)

    const fee = 5n * 10n ** (PercentageScale - 1n)
    const tickSpacing = 100n

    const supply = 10n ** 6n + 1000n
    const [tokenX, tokenY] = await initTokensXY(admin, supply)

    const initTick = 0n
    const initSqrtPrice = 10n ** 24n

    await expectError(
      InvariantError.FeeTierNotFound,
      invariant,
      initPool(invariant, poolCreator, tokenX, tokenY, fee, tickSpacing, initSqrtPrice, initTick)
    )
  })
  test('create pool init tick not divided by tick spacing', async () => {
    const protocolFee = 10n ** (PercentageScale - 2n)
    const invariant = await deployInvariant(admin, protocolFee)

    const fee = 5n * 10n ** (PercentageScale - 1n)
    const tickSpacing = 3n
    await initFeeTier(invariant, admin, fee, tickSpacing)

    const supply = 10n ** 6n + 1000n
    const [tokenX, tokenY] = await initTokensXY(admin, supply)

    const initTick = 2n
    const initSqrtPrice = (
      await invariant.methods.calculateSqrtPrice({ args: { tickIndex: initTick } })
    ).returns

    const clamm = CLAMM.at(
      addressFromContractId((await fetchContractState(Invariant, invariant)).fields.clamm)
    )
    await expectError(
      CLAMMError.InvalidTickSpacing,
      clamm,
      initPool(invariant, poolCreator, tokenX, tokenY, fee, tickSpacing, initSqrtPrice, initTick)
    )
  })
  test('create pool init sqrt price minimal diffrence from tick', async () => {
    const protocolFee = 10n ** (PercentageScale - 2n)
    const invariant = await deployInvariant(admin, protocolFee)

    const fee = 5n * 10n ** (PercentageScale - 1n)
    const tickSpacing = 3n
    await initFeeTier(invariant, admin, fee, tickSpacing)

    const supply = 10n ** 6n + 1000n
    const [tokenX, tokenY] = await initTokensXY(admin, supply)

    const initTick = 0n
    const initSqrtPrice =
      (await invariant.methods.calculateSqrtPrice({ args: { tickIndex: initTick } })).returns + 1n
    await initPool(
      invariant,
      poolCreator,
      tokenX,
      tokenY,
      fee,
      tickSpacing,
      initSqrtPrice,
      initTick
    )

    const pool = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
    expect(pool.currentTickIndex).toBe(initTick)
  })
  test('create pool init sqrt price has closer init tick', async () => {
    const protocolFee = 10n ** (PercentageScale - 2n)
    const invariant = await deployInvariant(admin, protocolFee)

    const fee = 5n * 10n ** (PercentageScale - 1n)
    const tickSpacing = 1n
    await initFeeTier(invariant, admin, fee, tickSpacing)

    const supply = 10n ** 6n + 1000n
    const [tokenX, tokenY] = await initTokensXY(admin, supply)

    const initTick = 2n
    const initSqrtPrice = 1000175003749000000000000n
    await expectError(
      InvariantError.TickAndSqrtPriceMismatch,
      invariant,
      initPool(invariant, poolCreator, tokenX, tokenY, fee, tickSpacing, initSqrtPrice, initTick)
    )

    const correctInitTick = 3n
    await initPool(
      invariant,
      poolCreator,
      tokenX,
      tokenY,
      fee,
      tickSpacing,
      initSqrtPrice,
      correctInitTick
    )

    const pool = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
    expect(pool.currentTickIndex).toBe(correctInitTick)
  })
  test('create pool init sqrt price has closer init tick with tick spacing over one', async () => {
    const protocolFee = 10n ** (PercentageScale - 2n)
    const invariant = await deployInvariant(admin, protocolFee)

    const fee = 5n * 10n ** (PercentageScale - 1n)
    const tickSpacing = 3n
    await initFeeTier(invariant, admin, fee, tickSpacing)

    const supply = 10n ** 6n + 1000n
    const [tokenX, tokenY] = await initTokensXY(admin, supply)

    const initTick = 0n
    const initSqrtPrice = 1000225003749000000000000n
    await expectError(
      InvariantError.TickAndSqrtPriceMismatch,
      invariant,
      initPool(invariant, poolCreator, tokenX, tokenY, fee, tickSpacing, initSqrtPrice, initTick)
    )

    const correctInitTick = 3n
    await initPool(
      invariant,
      poolCreator,
      tokenX,
      tokenY,
      fee,
      tickSpacing,
      initSqrtPrice,
      correctInitTick
    )

    const pool = await getPool(invariant, tokenX, tokenY, fee, tickSpacing)
    expect(pool.currentTickIndex).toBe(correctInitTick)
  })
})
