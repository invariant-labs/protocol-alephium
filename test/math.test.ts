import { web3 } from '@alephium/web3'
import { calculateSqrtPrice, getLiquidity, getLiquidityByX, getLiquidityByY } from '../src/math'
import { expectError } from '../src/testUtils'
import { UtilsError } from '../src/consts'

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
        UtilsError.UpperLTCurrentSqrtPrice,
        getLiquidityByX(x, lowerTick, upperTick, currentSqrtPrice, true)
      )
      await expectError(
        UtilsError.UpperLTCurrentSqrtPrice,
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
        UtilsError.CurrentLTLowerSqrtPrice,
        getLiquidityByY(y, lowerTick, upperTick, currentSqrtPrice, true)
      )
      await expectError(
        UtilsError.CurrentLTLowerSqrtPrice,
        getLiquidityByY(y, lowerTick, upperTick, currentSqrtPrice, false)
      )
    }
  })
  test('get liquidity', async () => {
    const y = 47600000000n
    const currentSqrtPrice = await calculateSqrtPrice(-20000n)
    // Below current tick
    {
      const expectedL = 278905227910392327n
      const expectedX = 0n
      const lowerTick = -22000n
      const upperTick = -21000n
      const expectedResult = { l: expectedL, x: expectedX, y }

      const resultUp = await getLiquidity(
        expectedX,
        y,
        lowerTick,
        upperTick,
        currentSqrtPrice,
        true
      )
      const resultDown = await getLiquidity(
        expectedX,
        y,
        lowerTick,
        upperTick,
        currentSqrtPrice,
        false
      )

      expect(resultUp).toMatchObject(expectedResult)
      expect(resultDown).toMatchObject(expectedResult)
    }
    // In current tick
    {
      const expectedXUp = 77539808126n
      const expectedXDown = 77539808125n
      const expectedLUp = 58494529055434693n
      const expectedLDown = 58494529055291192n
      const lowerTick = -25000n
      const upperTick = -19000n
      const expectedResultUp = { l: expectedLUp, x: expectedXUp }
      const expectedResultDown = { l: expectedLDown, x: expectedXDown }

      const resultUp = await getLiquidity(
        expectedXUp,
        y,
        lowerTick,
        upperTick,
        currentSqrtPrice,
        true
      )
      const resultDown = await getLiquidity(
        expectedXDown,
        y,
        lowerTick,
        upperTick,
        currentSqrtPrice,
        false
      )

      expect(resultUp).toMatchObject(expectedResultUp)
      expect(resultDown).toMatchObject(expectedResultDown)
    }
    // Above current Tick
    {
      const lowerTick = 150n
      const upperTick = 800n

      const x = 430000000n
      const expectedY = 0n
      const expectedResult = { l: 1354882631162385n, y: expectedY }

      const resultUp = await getLiquidity(
        x,
        expectedY,
        lowerTick,
        upperTick,
        currentSqrtPrice,
        true
      )

      const resultDown = await getLiquidity(
        x,
        expectedY,
        lowerTick,
        upperTick,
        currentSqrtPrice,
        false
      )

      expect(resultUp).toMatchObject(expectedResult)
      expect(resultDown).toMatchObject(expectedResult)
    }
  })
})
