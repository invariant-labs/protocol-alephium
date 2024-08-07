import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { getBasicFeeTickSpacing } from '../../../src/snippets'
import { newFeeTier, newPoolKey } from '../../../src/utils'
import { Network } from '../../../src/network'
import { Invariant } from '../../../src/invariant'
import { FungibleToken } from '../../../src/fungible-token'
import { toSqrtPrice } from '../../../src/math'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let token: FungibleToken
describe('get position with associates tests', () => {
  beforeAll(async () => {
    token = await FungibleToken.load(Network.Local)
  })
  test('get position with associates', async () => {
    const deployer = await getSigner(ONE_ALPH * 1000n, 0)
    const initialFee = 0n
    const invariant = await Invariant.deploy(deployer, Network.Local, initialFee)

    const token0 = await FungibleToken.deploy(deployer, 0n, 'Token0', 'TK0')
    const token1 = await FungibleToken.deploy(deployer, 0n, 'Token1', 'TK1')

    const feeTier = await newFeeTier(...getBasicFeeTickSpacing())
    const poolKey = await newPoolKey(token0, token1, feeTier)

    await invariant.addFeeTier(deployer, feeTier)

    const positionOwner = await getSigner(ONE_ALPH * 1000n, 0)
    const supply = 10n ** 10n
    await token.mint(positionOwner, supply, token0)
    await token.mint(positionOwner, supply, token1)

    const initSqrtPrice = toSqrtPrice(1n)
    await invariant.createPool(deployer, token0, token1, feeTier, initSqrtPrice)

    const [lowerTickIndex, upperTickIndex] = [-20n, 10n]

    const { sqrtPrice } = await invariant.getPool(poolKey)

    await invariant.createPosition(
      positionOwner,
      poolKey,
      lowerTickIndex,
      upperTickIndex,
      10n,
      supply,
      supply,
      sqrtPrice,
      sqrtPrice
    )

    const positionRegular = await invariant.getPosition(positionOwner.address, 0n)
    delete positionRegular.exists
    const poolRegular = await invariant.getPool(poolKey)
    delete poolRegular.exists
    const lowerTickRegular = await invariant.getTick(poolKey, lowerTickIndex)
    delete lowerTickRegular.exists
    const upperTickRegular = await invariant.getTick(poolKey, upperTickIndex)
    delete upperTickRegular.exists

    const [position, pool, lowerTick, upperTick] = await invariant.getPositionWithAssociates(
      positionOwner.address,
      0n
    )

    expect(position).toStrictEqual(positionRegular)
    expect(pool).toStrictEqual(poolRegular)
    expect(lowerTick).toStrictEqual(lowerTickRegular)
    expect(upperTick).toStrictEqual(upperTickRegular)
  })
})
