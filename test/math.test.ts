import { web3 } from '@alephium/web3'
import {
  calculateFee,
  calculateSqrtPrice,
  getLiquidity,
  getLiquidityByX,
  getLiquidityByY
} from '../src/math'
import { expectError } from '../src/testUtils'
import { UtilsError } from '../src/consts'
import { Pool, Position, Tick } from '../artifacts/ts/types'
import { newFeeTier, newPoolKey } from '../src/utils'
import { getBasicFeeTickSpacing } from '../src/snippets'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

describe('math spec', () => {
  describe('get liquidity by tests', () => {
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
  describe('test calculateFee', () => {
    test('Should return correct amounts', async () => {
      const [fee, tickSpacing] = await getBasicFeeTickSpacing()
      const feeTier = await newFeeTier(fee, tickSpacing)
      const poolKey = await newPoolKey(
        '55cd8e663fecd454071a2bf9937bf306a58e344694a16009b5d87421b06f7000',
        '55cd8e663fecd454071a2bf9937bf306a58e344694a16009b5d87421b06e7000',
        feeTier
      )
      const pool: Pool = {
        poolKey,
        liquidity: 10000000000000n,
        sqrtPrice: 999505344804856076727628n,
        currentTickIndex: -10n,
        feeGrowthGlobalX: 49000000000000000000000n,
        feeGrowthGlobalY: 0n,
        feeProtocolTokenX: 1n,
        feeProtocolTokenY: 0n,
        startTimestamp: 1720687408546n,
        lastTimestamp: 1720687408644n,
        feeReceiver: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        reserveX: '55cd8e663fecd454071a2bf9937bf306a58e344694a16009b5d87421b06f7000',
        reserveY: '55cd8e663fecd454071a2bf9937bf306a58e344694a16009b5d87421b06f7000'
      }
      const position: Position = {
        poolKey,
        liquidity: 10000000000000n,
        lowerTickIndex: -10n,
        upperTickIndex: 10n,
        feeGrowthInsideX: 0n,
        feeGrowthInsideY: 0n,
        lastBlockNumber: 51n,
        tokensOwedX: 0n,
        tokensOwedY: 0n,
        owner: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
      }
      const lowerTick: Tick = {
        index: -10n,
        sign: true,
        liquidityChange: 10000000000000n,
        liquidityGross: 10000000000000n,
        sqrtPrice: 999500149965000000000000n,
        feeGrowthOutsideX: 0n,
        feeGrowthOutsideY: 0n,
        secondsOutside: 98n
      }
      const upperTick: Tick = {
        index: 10n,
        sign: false,
        liquidityChange: 10000000000000n,
        liquidityGross: 10000000000000n,
        sqrtPrice: 1000500100010000000000000n,
        feeGrowthOutsideX: 0n,
        feeGrowthOutsideY: 0n,
        secondsOutside: 0n
      }
      const [x, y] = await calculateFee(pool, position, lowerTick, upperTick)
      expect(x).toBe(490n)
      expect(y).toBe(0n)
    })
  })
})
