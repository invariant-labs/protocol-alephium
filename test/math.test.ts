import { web3 } from '@alephium/web3'
import { calculateSqrtPrice, getLiquidityByX, getLiquidityByY } from '../src/math'
import { expectError } from '../src/testUtils'
import { CLAMMError } from '../src/consts'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

describe('math spec', () => {
  test('Calculating off-chain works', async () => {
    const sqrtPrice = await calculateSqrtPrice(0n)
    expect(sqrtPrice).toBe(10n ** 24n)
  })
  test('get liquidity by x', async () => {
    const x = 430000n
    const currentSqrtPrice = await calculateSqrtPrice(100n)

    // Bellow current tick
    {
      const lowerTick = -50n
      const upperTick = 10n
      await expectError(
        CLAMMError.UpperLTCurrentSqrtPrice,
        getLiquidityByX(x, lowerTick, upperTick, currentSqrtPrice, true)
      )
      await expectError(
        CLAMMError.UpperLTCurrentSqrtPrice,
        getLiquidityByX(x, lowerTick, upperTick, currentSqrtPrice, false)
      )
    }
    // In current tick
    {
      const expectedL = 43239299731929n
      const expectedYUp = 434322n
      const expectedYDown = 434321n
      const lowerTick = 80n
      const upperTick = 120n
      const resultUp = await getLiquidityByX(x, lowerTick, upperTick, currentSqrtPrice, true)
      const resultDown = await getLiquidityByX(x, lowerTick, upperTick, currentSqrtPrice, false)
      expect(resultUp).toMatchObject({ l: expectedL, amount: expectedYUp })
      expect(resultDown).toMatchObject({ l: expectedL, amount: expectedYDown })
    }
    // Above current tick
    {
      const lowerTick = 150n
      const upperTick = 800n
      const expectedResult = { l: 1354882631162n, amount: 0n }

      const resultUp = await getLiquidityByX(x, lowerTick, upperTick, currentSqrtPrice, true)
      const resultDown = await getLiquidityByX(x, lowerTick, upperTick, currentSqrtPrice, false)
      expect(resultUp).toMatchObject(expectedResult)
      expect(resultDown).toMatchObject(expectedResult)
    }
  })
  test('get liquidity by y', async () => {
    const y = 47600000000n
    const currentSqrtPrice = await calculateSqrtPrice(-20000n)
    // Below current tick
    {
      const expectedL = 278905227910392327n
      const expectedX = 0n
      const lowerTick = -22000n
      const upperTick = -21000n
      const expectedResult = { l: expectedL, amount: expectedX }

      const resultUp = await getLiquidityByY(y, lowerTick, upperTick, currentSqrtPrice, true)
      const resultDown = await getLiquidityByY(y, lowerTick, upperTick, currentSqrtPrice, false)

      expect(resultUp).toMatchObject(expectedResult)
      expect(resultDown).toMatchObject(expectedResult)
    }
    // In current tick
    {
      const expectedL = 58494529055434693n
      const expectedXUp = 77539808126n
      const expectedXDown = 77539808125n
      const lowerTick = -25000n
      const upperTick = -19000n

      const resultUp = await getLiquidityByY(y, lowerTick, upperTick, currentSqrtPrice, true)
      const resultDown = await getLiquidityByY(y, lowerTick, upperTick, currentSqrtPrice, false)

      expect(resultUp).toMatchObject({ l: expectedL, amount: expectedXUp })
      expect(resultDown).toMatchObject({ l: expectedL, amount: expectedXDown })
    }
    // Above current Tick
    {
      const lowerTick = -10000n
      const upperTick = 0n

      await expectError(
        CLAMMError.CurrentLTLowerSqrtPrice,
        getLiquidityByY(y, lowerTick, upperTick, currentSqrtPrice, true)
      )
      await expectError(
        CLAMMError.CurrentLTLowerSqrtPrice,
        getLiquidityByY(y, lowerTick, upperTick, currentSqrtPrice, false)
      )
    }
  })
})
