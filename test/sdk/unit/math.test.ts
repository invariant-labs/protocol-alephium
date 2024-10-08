import { web3 } from '@alephium/web3'
import {
  calculateFee,
  calculatePriceImpact,
  calculateSqrtPrice,
  calculateSqrtPriceAfterSlippage,
  calculateTokenAmountsWithSlippage,
  getConcentrationArray,
  getLiquidity,
  getLiquidityByX,
  getLiquidityByY,
  priceToSqrtPrice,
  sqrtPriceToPrice,
  toLiquidity,
  toPercentage,
  toPrice,
  toSqrtPrice
} from '../../../src/math'
import { UtilsError } from '../../../src/consts'
import { newFeeTier, newPoolKey } from '../../../src/utils'
import { getBasicFeeTickSpacing } from '../../../src/snippets'
import {
  FeeGrowth,
  Liquidity,
  Pool,
  Position,
  SqrtPrice,
  Tick,
  TokenAmount
} from '../../../src/types'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

describe('math spec', () => {
  describe('get liquidity by tests', () => {
    test('by x', async () => {
      const x = 430000n as TokenAmount
      const currentSqrtPrice = calculateSqrtPrice(100n)

      // Below current tick
      {
        const lowerTick = -50n
        const upperTick = 10n
        expect(() => getLiquidityByX(x, lowerTick, upperTick, currentSqrtPrice, true)).toThrow(
          UtilsError.UpperLTCurrentSqrtPrice.toString()
        )
        expect(() => getLiquidityByX(x, lowerTick, upperTick, currentSqrtPrice, false)).toThrow(
          UtilsError.UpperLTCurrentSqrtPrice.toString()
        )
      }
      // In current tick
      {
        const expectedL = 43239299699070n
        const expectedYUp = 434322n
        const expectedYDown = 434321n
        const lowerTick = 80n
        const upperTick = 120n
        const resultUp = getLiquidityByX(x, lowerTick, upperTick, currentSqrtPrice, true)
        const resultDown = getLiquidityByX(x, lowerTick, upperTick, currentSqrtPrice, false)
        expect(resultUp).toMatchObject({ l: expectedL, amount: expectedYUp })
        expect(resultDown).toMatchObject({ l: expectedL, amount: expectedYDown })
      }
      // Above current tick
      {
        const lowerTick = 150n
        const upperTick = 800n
        const expectedResult = { l: 1354882630774n, amount: 0n }

        const resultUp = getLiquidityByX(x, lowerTick, upperTick, currentSqrtPrice, true)
        const resultDown = getLiquidityByX(x, lowerTick, upperTick, currentSqrtPrice, false)
        expect(resultUp).toMatchObject(expectedResult)
        expect(resultDown).toMatchObject(expectedResult)
      }
    })
    test('by y', async () => {
      const y = 47600000000n as TokenAmount
      const currentSqrtPrice = calculateSqrtPrice(-20000n)
      // Below current tick
      {
        const expectedL = 278905227913027805n
        const expectedX = 0n
        const lowerTick = -22000n
        const upperTick = -21000n
        const expectedResult = { l: expectedL, amount: expectedX }

        const resultUp = getLiquidityByY(y, lowerTick, upperTick, currentSqrtPrice, true)
        const resultDown = getLiquidityByY(y, lowerTick, upperTick, currentSqrtPrice, false)

        expect(resultUp).toMatchObject(expectedResult)
        expect(resultDown).toMatchObject(expectedResult)
      }
      // In current tick
      {
        const expectedL = 58494529057380141n
        const expectedXUp = 77539808174n
        const expectedXDown = 77539808173n
        const lowerTick = -25000n
        const upperTick = -19000n

        const resultUp = getLiquidityByY(y, lowerTick, upperTick, currentSqrtPrice, true)
        const resultDown = getLiquidityByY(y, lowerTick, upperTick, currentSqrtPrice, false)

        expect(resultUp).toMatchObject({ l: expectedL, amount: expectedXUp })
        expect(resultDown).toMatchObject({ l: expectedL, amount: expectedXDown })
      }
      // Above current Tick
      {
        const lowerTick = -10000n
        const upperTick = 0n

        expect(() => getLiquidityByY(y, lowerTick, upperTick, currentSqrtPrice, true)).toThrow(
          UtilsError.CurrentLTLowerSqrtPrice.toString()
        )
        expect(() => getLiquidityByY(y, lowerTick, upperTick, currentSqrtPrice, false)).toThrow(
          UtilsError.CurrentLTLowerSqrtPrice.toString()
        )
      }
    })
    test('get liquidity', async () => {
      const y = 47600000000n as TokenAmount
      const currentSqrtPrice = calculateSqrtPrice(-20000n)
      // Below current tick
      {
        const expectedL = 278905227913027805n
        const expectedX = 0n as TokenAmount
        const lowerTick = -22000n
        const upperTick = -21000n
        const expectedResult = { l: expectedL, x: expectedX, y }

        const resultUp = getLiquidity(expectedX, y, lowerTick, upperTick, currentSqrtPrice, true)
        const resultDown = getLiquidity(expectedX, y, lowerTick, upperTick, currentSqrtPrice, false)

        expect(resultUp).toMatchObject(expectedResult)
        expect(resultDown).toMatchObject(expectedResult)
      }
      // In current tick
      {
        const expectedXUp = 77539808174n as TokenAmount
        const expectedXDown = 77539808173n as TokenAmount
        const expectedLUp = 58494529057380141n
        const expectedLDown = 58494529057221346n
        const lowerTick = -25000n
        const upperTick = -19000n
        const expectedResultUp = { l: expectedLUp, x: expectedXUp }
        const expectedResultDown = { l: expectedLDown, x: expectedXDown }

        const resultUp = getLiquidity(expectedXUp, y, lowerTick, upperTick, currentSqrtPrice, true)
        const resultDown = getLiquidity(
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

        const x = 430000000n as TokenAmount
        const expectedY = 0n as TokenAmount
        const expectedResult = { l: 1354882630774114n, y: expectedY }

        const resultUp = getLiquidity(x, expectedY, lowerTick, upperTick, currentSqrtPrice, true)

        const resultDown = getLiquidity(x, expectedY, lowerTick, upperTick, currentSqrtPrice, false)

        expect(resultUp).toMatchObject(expectedResult)
        expect(resultDown).toMatchObject(expectedResult)
      }
    })
  })
  describe('calculateFee tests', () => {
    test('returns correct amounts', async () => {
      const [fee, tickSpacing] = getBasicFeeTickSpacing()
      const feeTier = newFeeTier(fee, tickSpacing)
      const poolKey = newPoolKey(
        '55cd8e663fecd454071a2bf9937bf306a58e344694a16009b5d87421b06f7000',
        '55cd8e663fecd454071a2bf9937bf306a58e344694a16009b5d87421b06e7000',
        feeTier
      )
      const pool: Pool = {
        poolKey,
        liquidity: 10000000000000n as Liquidity,
        sqrtPrice: 999505344804856076727628n as SqrtPrice,
        currentTickIndex: -10n,
        feeGrowthGlobalX: 49000000000000000000000n as FeeGrowth,
        feeGrowthGlobalY: 0n as FeeGrowth,
        feeProtocolTokenX: 1n as TokenAmount,
        feeProtocolTokenY: 0n as TokenAmount,
        startTimestamp: 1720687408546n,
        lastTimestamp: 1720687408644n,
        feeReceiver: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        reserveX: '55cd8e663fecd454071a2bf9937bf306a58e344694a16009b5d87421b06f7000',
        reserveY: '55cd8e663fecd454071a2bf9937bf306a58e344694a16009b5d87421b06f7000'
      }
      const position: Position = {
        poolKey,
        liquidity: 10000000000000n as Liquidity,
        lowerTickIndex: -10n,
        upperTickIndex: 10n,
        feeGrowthInsideX: 0n as FeeGrowth,
        feeGrowthInsideY: 0n as FeeGrowth,
        lastBlockNumber: 51n,
        tokensOwedX: 0n as TokenAmount,
        tokensOwedY: 0n as TokenAmount,
        owner: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
      }
      const lowerTick: Tick = {
        index: -10n,
        sign: true,
        liquidityChange: 10000000000000n as Liquidity,
        liquidityGross: 10000000000000n as Liquidity,
        sqrtPrice: 999500149965000000000000n as SqrtPrice,
        feeGrowthOutsideX: 0n as FeeGrowth,
        feeGrowthOutsideY: 0n as FeeGrowth,
        secondsOutside: 98n
      }
      const upperTick: Tick = {
        index: 10n,
        sign: false,
        liquidityChange: 10000000000000n as Liquidity,
        liquidityGross: 10000000000000n as Liquidity,
        sqrtPrice: 1000500100010000000000000n as SqrtPrice,
        feeGrowthOutsideX: 0n as FeeGrowth,
        feeGrowthOutsideY: 0n as FeeGrowth,
        secondsOutside: 0n
      }
      const [x, y] = calculateFee(pool, position, lowerTick, upperTick)
      expect(x).toBe(490n)
      expect(y).toBe(0n)
    })
  })
  describe('calculateSqrtPriceAfterSlippage tests', () => {
    test('no slippage up', () => {
      const sqrtPrice = toSqrtPrice(1n, 0n)
      const slippage = toPercentage(0n, 0n)
      const limitSqrt = calculateSqrtPriceAfterSlippage(sqrtPrice, slippage, true)
      expect(limitSqrt).toBe(sqrtPrice)
    })
    test('no slippage down', () => {
      const sqrtPrice = toSqrtPrice(1n, 0n)
      const slippage = toPercentage(0n, 0n)
      const limitSqrt = calculateSqrtPriceAfterSlippage(sqrtPrice, slippage, false)
      expect(limitSqrt).toBe(sqrtPrice)
    })
    test('slippage of 1% up', () => {
      const sqrtPrice = toSqrtPrice(1n, 0n)
      const slippage = toPercentage(1n, 2n)
      const limitSqrt = calculateSqrtPriceAfterSlippage(sqrtPrice, slippage, true)
      // sqrt(1) * sqrt(1 + 0.01) = 1.0049876
      expect(limitSqrt).toBe(1004987562112089027021926n)
    })
    test('slippage of 1% down', () => {
      const sqrtPrice = toSqrtPrice(1n, 0n)
      const slippage = toPercentage(1n, 2n)
      const limitSqrt = calculateSqrtPriceAfterSlippage(sqrtPrice, slippage, false)
      // sqrt(1) * sqrt(1 - 0.01) = 0.99498744
      expect(limitSqrt).toBe(994987437106619954734479n)
    })
    test('slippage of 0.5% up', () => {
      const sqrtPrice = toSqrtPrice(1n, 0n)
      const slippage = toPercentage(5n, 3n)
      const limitSqrt = calculateSqrtPriceAfterSlippage(sqrtPrice, slippage, true)
      // sqrt(1) * sqrt(1 - 0.005) = 1.00249688
      expect(limitSqrt).toBe(1002496882788171067537936n)
    })
    test('slippage of 0.5% down', () => {
      const sqrtPrice = toSqrtPrice(1n, 0n)
      const slippage = toPercentage(5n, 3n)
      const limitSqrt = calculateSqrtPriceAfterSlippage(sqrtPrice, slippage, false)
      // sqrt(1) * sqrt(1 - 0.005) = 0.997496867
      expect(limitSqrt).toBe(997496867163000166582694n)
    })
    test('slippage of 0.00003% up', () => {
      const sqrtPrice = toSqrtPrice(1n, 0n)
      const slippage = toPercentage(3n, 7n)
      const limitSqrt = calculateSqrtPriceAfterSlippage(sqrtPrice, slippage, true)
      // sqrt(1) * sqrt(1 + 0.0000003) = 1.00000015
      expect(limitSqrt).toBe(1000000149999988750001687n)
    })
    test('slippage of 0.00003% down', () => {
      const sqrtPrice = toSqrtPrice(1n, 0n)
      const slippage = toPercentage(3n, 7n)
      const limitSqrt = calculateSqrtPriceAfterSlippage(sqrtPrice, slippage, false)
      // sqrt(1) * sqrt(1 - 0.0000003) = 0.99999985
      expect(limitSqrt).toBe(999999849999988749998312n)
    })
    test('slippage of 100% up', () => {
      const sqrtPrice = toSqrtPrice(1n, 0n)
      const slippage = toPercentage(1n, 0n)
      const limitSqrt = calculateSqrtPriceAfterSlippage(sqrtPrice, slippage, true)
      // sqrt(1) * sqrt(1 + 1) = 1.414213562373095048801688...
      expect(limitSqrt).toBe(1414213562373095048801688n)
    })
    test('slippage of 100% down', () => {
      const sqrtPrice = toSqrtPrice(1n, 0n)
      const slippage = toPercentage(1n, 0n)
      const limitSqrt = calculateSqrtPriceAfterSlippage(sqrtPrice, slippage, false)
      // sqrt(1) * sqrt(1 - 1) = 0
      expect(limitSqrt).toBe(0n)
    })
  })
  describe('calculateTokensWithSlippage tests', () => {
    const liquidity = toLiquidity(100000000n, 0n)

    it('tick Spacing = 1, currentPrice = 1000000000000000000000000, slippage = 1%, [-10, 10] range', () => {
      const tickSpacing = 1n
      const currentSqrtPrice = toSqrtPrice(1n, 0n) //1000000000000000000000000
      const slippage = toPercentage(1n, 2n)
      const lowerTickIndex = -10n
      const upperTickIndex = 10n
      const [x, y] = calculateTokenAmountsWithSlippage(
        tickSpacing,
        currentSqrtPrice,
        liquidity,
        lowerTickIndex,
        upperTickIndex,
        slippage,
        true
      )

      expect(x).toBe(553767n)
      expect(y).toBe(548742n)
    })
    it('tickSpacing = 5n, current price = 1001501050455000000000000, slippage = 1%, [0, 75] range', () => {
      const tickSpacing = 5n
      const currentTickIndex = 30n
      const currentSqrtPrice = calculateSqrtPrice(currentTickIndex) //1001501050455000000000000
      const slippage = toPercentage(1n, 2n)
      const lowerTickIndex = 0n
      const upperTickIndex = 75n

      const [x, y] = calculateTokenAmountsWithSlippage(
        tickSpacing,
        currentSqrtPrice,
        liquidity,
        lowerTickIndex,
        upperTickIndex,
        slippage,
        true
      )

      expect(x).toBe(727426n)
      expect(y).toBe(649610n)
    })
  })

  describe('calculatePriceImpact tests', () => {
    it('increasing price', () => {
      // price change       120 -> 599
      // real price impact  79.96661101836...%
      const startingSqrtPrice = 10954451150103322269139395n as SqrtPrice
      const endingSqrtPrice = 24474476501040834315678144n as SqrtPrice
      const priceImpact = calculatePriceImpact(startingSqrtPrice, endingSqrtPrice)
      expect(priceImpact).toBe(799666110183n)
    })

    it('decreasing price', () => {
      // price change       0.367 -> 1.0001^(-221818)
      // real price impact  99.9999999365...%
      const startingSqrtPrice = 605805249234438377196232n as SqrtPrice
      const endingSqrtPrice = 15258932449895975601n as SqrtPrice
      const priceImpact = calculatePriceImpact(startingSqrtPrice, endingSqrtPrice)
      expect(priceImpact).toBe(999999999365n)
    })
  })

  describe('getConcentrationArray tests', () => {
    it('high current tick ', async () => {
      const tickSpacing = 4n
      const maxConcentration = 10
      const expectedResult = 11

      const result = getConcentrationArray(tickSpacing, maxConcentration, 547548)

      expect(result.length).toBe(expectedResult)
    })
    it('middle current tick ', async () => {
      const tickSpacing = 4n
      const maxConcentration = 10
      const expectedResult = 124

      const result = getConcentrationArray(tickSpacing, maxConcentration, 547094)
      expect(result.length).toBe(expectedResult)
    })
    it('low current tick ', async () => {
      const tickSpacing = 4n
      const maxConcentration = 10
      const expectedResult = 137

      const result = getConcentrationArray(tickSpacing, maxConcentration, 0)
      expect(result.length).toBe(expectedResult)
    })
  })

  describe('sqrt price and price conversion', () => {
    it('price of 1.00', () => {
      // 1.00 = sqrt(1.00)
      const sqrtPrice = priceToSqrtPrice(toPrice(1n))
      const expectedSqrtPrice = 1000000000000000000000000n
      expect(sqrtPrice).toBe(expectedSqrtPrice)
    })
    it('price of 2.00', () => {
      // 1.414213562373095048801688... = sqrt(2.00)
      const sqrtPrice = priceToSqrtPrice(toPrice(2n))
      const expectedSqrtPrice = 1414213562373095048801688n
      expect(sqrtPrice).toBe(expectedSqrtPrice)
    })
    it('price of 0.25', () => {
      // 0.5 = sqrt(0.25)
      const sqrtPrice = priceToSqrtPrice(toPrice(25n, 2n))
      const expectedSqrtPrice = 500000000000000000000000n
      expect(sqrtPrice).toBe(expectedSqrtPrice)
    })
    it('sqrt price of 1.00', () => {
      // sqrt(1.00) = 1.00
      const price = sqrtPriceToPrice(toSqrtPrice(1n))
      const expectedPrice = 1000000000000000000000000n
      expect(price).toBe(expectedPrice)
    })
    it('sqrt price of 2.00', () => {
      // sqrt(1.414213562373095048801688...) = 2.00
      const price = sqrtPriceToPrice(1414213562373095048801688n as SqrtPrice)
      const expectedPrice = 1999999999999999999999997n
      expect(price).toBe(expectedPrice)
    })
    it('sqrt price of 0.25', () => {
      // sqrt(0.25) = 0.5
      const price = sqrtPriceToPrice(toSqrtPrice(5n, 1n))
      const expectedPrice = 250000000000000000000000n
      expect(price).toBe(expectedPrice)
    })
  })
})
