import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { Invariant } from '../../../src/invariant'
import { Network } from '../../../src/network'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { getBasicFeeTickSpacing } from '../../../src/snippets'
import { TokenFaucetInstance } from '../../../artifacts/ts'
import { initTokensXY, withdrawTokens } from '../../../src/testUtils'
import { FeeTier, PoolKey } from '../../../artifacts/ts/types'
import { balanceOf, newFeeTier, newPoolKey } from '../../../src/utils'
import { MAX_POSITIONS_QUERIED } from '../../../src/consts'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let invariant: Invariant
let deployer: PrivateKeyWallet
let positionOwner: PrivateKeyWallet
let tokenX: TokenFaucetInstance
let tokenY: TokenFaucetInstance
let feeTier: FeeTier
let poolKey: PoolKey

describe('get positions test', () => {
  const initialFee = 0n
  const [fee, tickSpacing] = getBasicFeeTickSpacing()
  const initSqrtPrice = 10n ** 24n
  const supply = 10n ** 10n
  const liquidityDelta = 10n

  beforeEach(async () => {
    deployer = await getSigner(ONE_ALPH * 1000n, 0)
    positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
    invariant = await Invariant.deploy(deployer, Network.Local, initialFee)
    ;[tokenX, tokenY] = await initTokensXY(deployer, supply)

    feeTier = await newFeeTier(fee, tickSpacing)
    poolKey = await newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    await invariant.addFeeTier(deployer, feeTier)
    await invariant.createPool(
      deployer,
      tokenX.contractId,
      tokenY.contractId,
      feeTier,
      initSqrtPrice
    )
    await withdrawTokens(positionOwner, [tokenX, supply], [tokenY, supply])
  })
  test('get all positions', async () => {
    for (let i = 1n; i <= 10n; i++) {
      const { sqrtPrice } = await invariant.getPool(poolKey)
      const approveX = await balanceOf(tokenX.contractId, positionOwner.address)
      const approveY = await balanceOf(tokenY.contractId, positionOwner.address)
      await invariant.createPosition(
        positionOwner,
        poolKey,
        -i * tickSpacing,
        i * tickSpacing,
        liquidityDelta,
        approveX,
        approveY,
        sqrtPrice,
        sqrtPrice
      )
    }

    const pages = await invariant.getAllPositions(positionOwner.address)

    expect(pages.map(page => page.entries).flat().length).toBe(10)
    for (const { index, entries } of pages) {
      for (const [positionIndex, [position, pool]] of entries.entries()) {
        const expectedPosition = await invariant.getPosition(
          positionOwner.address,
          BigInt(index) * MAX_POSITIONS_QUERIED + BigInt(positionIndex)
        )
        const expectedPool = await invariant.getPool(expectedPosition.poolKey)

        expect(expectedPosition).toMatchObject(position)
        expect(expectedPool).toMatchObject(pool)
      }
    }
  })
  test('get all positions with positions count', async () => {
    for (let i = 1n; i <= MAX_POSITIONS_QUERIED; i++) {
      const { sqrtPrice } = await invariant.getPool(poolKey)
      const approveX = await balanceOf(tokenX.contractId, positionOwner.address)
      const approveY = await balanceOf(tokenY.contractId, positionOwner.address)
      await invariant.createPosition(
        positionOwner,
        poolKey,
        -i * tickSpacing,
        i * tickSpacing,
        liquidityDelta,
        approveX,
        approveY,
        sqrtPrice,
        sqrtPrice
      )
    }
    const pages = await invariant.getAllPositions(positionOwner.address, MAX_POSITIONS_QUERIED)

    expect(pages.map(page => page.entries).flat().length).toBe(Number(MAX_POSITIONS_QUERIED))
    for (const { index, entries } of pages) {
      for (const [positionIndex, [position, pool]] of entries.entries()) {
        const expectedPosition = await invariant.getPosition(
          positionOwner.address,
          BigInt(index) * MAX_POSITIONS_QUERIED + BigInt(positionIndex)
        )
        const expectedPool = await invariant.getPool(expectedPosition.poolKey)

        expect(expectedPosition).toMatchObject(position)
        expect(expectedPool).toMatchObject(pool)
      }
    }
  }, 27500)
  test('get all positions with skip pages', async () => {
    for (let i = 1n; i <= 4n * MAX_POSITIONS_QUERIED; i++) {
      const { sqrtPrice } = await invariant.getPool(poolKey)
      const approveX = await balanceOf(tokenX.contractId, positionOwner.address)
      const approveY = await balanceOf(tokenY.contractId, positionOwner.address)
      await invariant.createPosition(
        positionOwner,
        poolKey,
        -i * tickSpacing,
        i * tickSpacing,
        liquidityDelta,
        approveX,
        approveY,
        sqrtPrice,
        sqrtPrice
      )
    }
    const pages = await invariant.getAllPositions(positionOwner.address, undefined, [1, 3])

    expect(pages.map(page => page.entries).flat().length).toBe(Number(MAX_POSITIONS_QUERIED * 2n))
    for (const { index, entries } of pages) {
      for (const [positionIndex, [position, pool]] of entries.entries()) {
        const expectedPosition = await invariant.getPosition(
          positionOwner.address,
          BigInt(index) * MAX_POSITIONS_QUERIED + BigInt(positionIndex)
        )
        const expectedPool = await invariant.getPool(expectedPosition.poolKey)

        expect(expectedPosition).toMatchObject(position)
        expect(expectedPool).toMatchObject(pool)
      }
    }
  }, 100000)
  test('get all positions with positions per page and skip pages', async () => {
    for (let i = 1n; i <= 50n; i++) {
      const { sqrtPrice } = await invariant.getPool(poolKey)
      const approveX = await balanceOf(tokenX.contractId, positionOwner.address)
      const approveY = await balanceOf(tokenY.contractId, positionOwner.address)
      await invariant.createPosition(
        positionOwner,
        poolKey,
        -i * tickSpacing,
        i * tickSpacing,
        liquidityDelta,
        approveX,
        approveY,
        sqrtPrice,
        sqrtPrice
      )
    }
    const positionPerPage = 10n
    const pages = await invariant.getAllPositions(
      positionOwner.address,
      undefined,
      [1, 3],
      positionPerPage
    )

    expect(pages.length).toBe(3)
    expect(pages.map(page => page.entries).flat().length).toBe(30)
    for (const { index, entries } of pages) {
      for (const [positionIndex, [position, pool]] of entries.entries()) {
        const expectedPosition = await invariant.getPosition(
          positionOwner.address,
          BigInt(index) * positionPerPage + BigInt(positionIndex)
        )
        const expectedPool = await invariant.getPool(expectedPosition.poolKey)

        expect(expectedPosition).toMatchObject(position)
        expect(expectedPool).toMatchObject(pool)
      }
    }
  })
})
