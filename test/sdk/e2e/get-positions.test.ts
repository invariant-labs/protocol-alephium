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

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let invariant: Invariant
let deployer: PrivateKeyWallet
let positionOwner: PrivateKeyWallet
let tokenX: TokenFaucetInstance
let tokenY: TokenFaucetInstance
let feeTier: FeeTier
let poolKey: PoolKey

describe('get positions test', () => {
  const initialFee = 0n as Percentage
  const [fee] = getBasicFeeTickSpacing()
  const tickSpacing = 1n
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

    const { sqrtPrice } = await invariant.getPool(poolKey)

    await invariant.createPosition(
      positionOwner,
      poolKey,
      -10n,
      10n,
      liquidityDelta,
      supply,
      supply,
      sqrtPrice,
      0n as Percentage
    )
    const approveX = await balanceOf(tokenX.contractId, positionOwner.address)
    const approveY = await balanceOf(tokenY.contractId, positionOwner.address)
    await invariant.createPosition(
      positionOwner,
      poolKey,
      -20n,
      20n,
      liquidityDelta,
      approveX,
      approveY,
      sqrtPrice,
      0n as Percentage
    )
  })
  test('get positions', async () => {
    const [positions, totalPositions] = await invariant.getPositions(positionOwner.address, 2n, 0n)
    expect(positions.length).toBe(2)
    expect(totalPositions).toBe(2n)
  })
  test('get less than all', async () => {
    const [positions, totalPositions] = await invariant.getPositions(positionOwner.address, 1n, 0n)
    expect(positions.length).toBe(1)
    expect(totalPositions).toBe(2n)
  })
  test('try to get more than all', async () => {
    const [positions, totalPositions] = await invariant.getPositions(positionOwner.address, 3n, 0n)
    expect(positions.length).toBe(2)
    expect(totalPositions).toBe(2n)
  })
  test('get with offset', async () => {
    const [positions, totalPositions] = await invariant.getPositions(positionOwner.address, 1n, 1n)
    expect(positions.length).toBe(1)
    expect(totalPositions).toBe(2n)
  })
  test('get with offset less than all', async () => {
    const { sqrtPrice } = await invariant.getPool(poolKey)
    const approveX = await balanceOf(tokenX.contractId, positionOwner.address)
    const approveY = await balanceOf(tokenY.contractId, positionOwner.address)
    await invariant.createPosition(
      positionOwner,
      poolKey,
      -30n,
      30n,
      liquidityDelta,
      approveX,
      approveY,
      sqrtPrice,
      0n as Percentage
    )

    const [positions, totalPositions] = await invariant.getPositions(positionOwner.address, 1n, 1n)
    expect(positions.length).toBe(1)
    expect(totalPositions).toBe(3n)
  })
  test('try to get with offset more than all', async () => {
    const [positions, totalPositions] = await invariant.getPositions(positionOwner.address, 2n, 1n)
    expect(positions.length).toBe(1)
    expect(totalPositions).toBe(2n)
  })
  test('find limit of queried positions in single query', async () => {
    const positionToOpen = 81n

    for (let i = 1n; i <= positionToOpen; i++) {
      const { sqrtPrice } = await invariant.getPool(poolKey)
      const approveX = await balanceOf(tokenX.contractId, positionOwner.address)
      const approveY = await balanceOf(tokenY.contractId, positionOwner.address)
      await invariant.createPosition(
        positionOwner,
        poolKey,
        -i,
        i,
        liquidityDelta,
        approveX,
        approveY,
        sqrtPrice,
        0n as Percentage
      )
    }
    const [positions, totalPositions] = await invariant.getPositions(
      positionOwner.address,
      999n,
      0n
    )
    // additional 2 positions from beforeEach hook
    const totalOpened = positionToOpen + 2n
    expect(positions.length).toBe(Number(totalOpened))
    expect(totalPositions).toBe(totalOpened)
  }, 30000)
})
