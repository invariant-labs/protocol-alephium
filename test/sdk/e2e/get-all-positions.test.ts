import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { Invariant } from '../../../src/invariant'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { getBasicFeeTickSpacing } from '../../../src/snippets'
import { TokenFaucetInstance } from '../../../artifacts/ts'
import { initTokensXY, withdrawTokens } from '../../../src/testUtils'
import { balanceOf, newFeeTier, newPoolKey } from '../../../src/utils'
import { FeeTier, Liquidity, Percentage, PoolKey, TokenAmount } from '../../../src/types'
import { toSqrtPrice } from '../../../src'
import { POSITIONS_ENTRIES_LIMIT } from '../../../src/consts'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let invariant: Invariant
let deployer: PrivateKeyWallet
let positionOwner: PrivateKeyWallet
let tokenX: TokenFaucetInstance
let tokenY: TokenFaucetInstance
let feeTier: FeeTier
let poolKey: PoolKey

describe('get all positions test', () => {
  const initialFee = 0n as Percentage
  const [fee, tickSpacing] = getBasicFeeTickSpacing()
  const initSqrtPrice = toSqrtPrice(1n)
  const supply = (10n ** 10n) as TokenAmount
  const liquidityDelta = 10n as Liquidity

  beforeEach(async () => {
    deployer = await getSigner(ONE_ALPH * 1000n, 0)
    positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
    invariant = await Invariant.deploy(deployer, initialFee)
    ;[tokenX, tokenY] = await initTokensXY(deployer, supply)

    feeTier = newFeeTier(fee, tickSpacing)
    poolKey = newPoolKey(tokenX.contractId, tokenY.contractId, feeTier)

    await invariant.addFeeTier(deployer, feeTier)
    await invariant.createPool(deployer, poolKey, initSqrtPrice)
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
        0n as Percentage
      )
    }

    const pages = await invariant.getAllPositions(positionOwner.address)

    expect(pages.map(page => page.entries).flat().length).toBe(10)
    for (const { index, entries } of pages) {
      for (const [positionIndex, [position, pool]] of entries.entries()) {
        const expectedPosition = await invariant.getPosition(
          positionOwner.address,
          BigInt(index) * POSITIONS_ENTRIES_LIMIT + BigInt(positionIndex)
        )
        const expectedPool = await invariant.getPool(expectedPosition.poolKey)

        expect(expectedPosition).toMatchObject(position)
        expect(expectedPool).toMatchObject(pool)
      }
    }
  })
  test('get all positions with positions count', async () => {
    for (let i = 1n; i <= POSITIONS_ENTRIES_LIMIT; i++) {
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
        0n as Percentage
      )
    }
    const pages = await invariant.getAllPositions(positionOwner.address, POSITIONS_ENTRIES_LIMIT)

    expect(pages.map(page => page.entries).flat().length).toBe(Number(POSITIONS_ENTRIES_LIMIT))
    for (const { index, entries } of pages) {
      for (const [positionIndex, [position, pool]] of entries.entries()) {
        const expectedPosition = await invariant.getPosition(
          positionOwner.address,
          BigInt(index) * POSITIONS_ENTRIES_LIMIT + BigInt(positionIndex)
        )
        const expectedPool = await invariant.getPool(expectedPosition.poolKey)

        expect(expectedPosition).toMatchObject(position)
        expect(expectedPool).toMatchObject(pool)
      }
    }
  })
  test('get all positions with skip pages', async () => {
    for (let i = 1n; i <= 4n * POSITIONS_ENTRIES_LIMIT; i++) {
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
        0n as Percentage
      )
    }
    const pages = await invariant.getAllPositions(positionOwner.address, undefined, [1, 3])

    expect(pages.map(page => page.entries).flat().length).toBe(Number(POSITIONS_ENTRIES_LIMIT * 2n))
    for (const { index, entries } of pages) {
      for (const [positionIndex, [position, pool]] of entries.entries()) {
        const expectedPosition = await invariant.getPosition(
          positionOwner.address,
          BigInt(index) * POSITIONS_ENTRIES_LIMIT + BigInt(positionIndex)
        )
        const expectedPool = await invariant.getPool(expectedPosition.poolKey)

        expect(expectedPosition).toMatchObject(position)
        expect(expectedPool).toMatchObject(pool)
      }
    }
  })
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
        0n as Percentage
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
