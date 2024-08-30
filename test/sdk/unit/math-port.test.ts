import { web3 } from '@alephium/web3'
import { Liquidity, SqrtPrice } from '../../../src/types'
import {
  calculateAmountDelta,
  calculateSqrtPrice,
  getDeltaX,
  getDeltaY,
  toLiquidity,
  toSqrtPrice
} from '../../../src/math'
import {
  ArithmeticError,
  CLAMMError,
  GLOBAL_MAX_TICK,
  GLOBAL_MIN_TICK,
  MAX_SQRT_PRICE,
  MAX_U256,
  MIN_SQRT_PRICE
} from '../../../src/consts'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

describe('math spec - port', () => {
  describe('calculate amount delta tests', () => {
    test('current tick between lower tick and upper tick', async () => {
      const currentTickIndex = 2n
      const currentSqrtPrice = 1_000140000000000000000000n as SqrtPrice
      const liquidityDelta = toLiquidity(5000000n)
      const liquiditySign = true
      const upperTick = 3n
      const lowerTick = 0n

      const result = calculateAmountDelta(
        currentTickIndex,
        currentSqrtPrice,
        liquidityDelta,
        liquiditySign,
        upperTick,
        lowerTick
      )
      expect(result).toEqual([51n, 700n, true])
    })

    test('current tick in the middle between lower tick and upper tick', async () => {
      const currentTickIndex = 2n
      const currentSqrtPrice = 1_000140000000000000000000n as SqrtPrice
      const liquidityDelta = toLiquidity(5000000n)
      const liquiditySign = true
      const upperTick = 4n
      const lowerTick = 0n

      const result = calculateAmountDelta(
        currentTickIndex,
        currentSqrtPrice,
        liquidityDelta,
        liquiditySign,
        upperTick,
        lowerTick
      )
      expect(result).toEqual([300n, 700n, true])
    })

    test('current tick smaller than lower tick', async () => {
      const currentTickIndex = 0n
      const currentSqrtPrice = toSqrtPrice(1n)
      const liquidityDelta = toLiquidity(10n)
      const liquiditySign = true
      const upperTick = 4n
      const lowerTick = 2n

      const result = calculateAmountDelta(
        currentTickIndex,
        currentSqrtPrice,
        liquidityDelta,
        liquiditySign,
        upperTick,
        lowerTick
      )
      expect(result).toEqual([1n, 0n, false])
    })

    test('current tick greater than upper tick', async () => {
      const currentTickIndex = 6n
      const currentSqrtPrice = toSqrtPrice(1n)
      const liquidityDelta = toLiquidity(10n)
      const liquiditySign = true
      const upperTick = 4n
      const lowerTick = 2n

      const result = calculateAmountDelta(
        currentTickIndex,
        currentSqrtPrice,
        liquidityDelta,
        liquiditySign,
        upperTick,
        lowerTick
      )
      expect(result).toEqual([0n, 1n, false])
    })
  })

  describe('calculate amount delta tests - domain', () => {
    let maxLiquidity = MAX_U256 as Liquidity

    test('max x', async () => {
      const currentTickIndex = GLOBAL_MIN_TICK
      const currentSqrtPrice = toSqrtPrice(1n)
      const liquidityDelta = maxLiquidity
      const liquiditySign = true
      const upperTick = GLOBAL_MAX_TICK
      const lowerTick = GLOBAL_MIN_TICK + 1n

      const result = calculateAmountDelta(
        currentTickIndex,
        currentSqrtPrice,
        liquidityDelta,
        liquiditySign,
        upperTick,
        lowerTick
      )
      expect(result).toEqual([
        75880998414682858767056931020720040283888865803509762441587530402105305752645n,
        0n,
        false
      ])
    })

    test('max y', async () => {
      const currentTickIndex = GLOBAL_MAX_TICK
      const currentSqrtPrice = toSqrtPrice(1n)
      const liquidityDelta = maxLiquidity
      const liquiditySign = true
      const upperTick = GLOBAL_MAX_TICK - 1n
      const lowerTick = GLOBAL_MIN_TICK

      const result = calculateAmountDelta(
        currentTickIndex,
        currentSqrtPrice,
        liquidityDelta,
        liquiditySign,
        upperTick,
        lowerTick
      )
      expect(result).toEqual([
        0n,
        75880996274614937472454279923345931777432945506580976077368827511053494714377n,
        false
      ])
    })

    test('delta liquidity = 0', async () => {
      const currentTickIndex = 2n
      const currentSqrtPrice = 1_000140000000000000000000n as SqrtPrice
      const liquidityDelta = 0n as Liquidity
      const liquiditySign = true
      const upperTick = 4n
      const lowerTick = 0n

      const result = calculateAmountDelta(
        currentTickIndex,
        currentSqrtPrice,
        liquidityDelta,
        liquiditySign,
        upperTick,
        lowerTick
      )
      expect(result).toEqual([0n, 0n, true])
    })

    test('error handling', async () => {
      const currentTickIndex = 0n
      const currentSqrtPrice = 1_000140000000000000000000n as SqrtPrice
      const liquidityDelta = 0n as Liquidity
      const liquiditySign = true
      const upperTick = 4n
      const lowerTick = 10n

      expect(() =>
        calculateAmountDelta(
          currentTickIndex,
          currentSqrtPrice,
          liquidityDelta,
          liquiditySign,
          upperTick,
          lowerTick
        )
      ).toThrow(CLAMMError.InvalidTickIndex.toString())
    })

    test('all max', async () => {
      const currentTickIndex = 0n
      const currentSqrtPrice = MAX_U256 as SqrtPrice
      const liquidityDelta = MAX_U256 as Liquidity
      const liquiditySign = true
      const upperTick = GLOBAL_MAX_TICK
      const lowerTick = GLOBAL_MIN_TICK

      expect(() =>
        calculateAmountDelta(
          currentTickIndex,
          currentSqrtPrice,
          liquidityDelta,
          liquiditySign,
          upperTick,
          lowerTick
        )
      ).toThrow(ArithmeticError.CastOverflow.toString())
    })
  })
  describe('get delta x', () => {
    test('zero at zero liquidity', async () => {
      const sqrtPriceA = toSqrtPrice(1n)
      const sqrtPriceB = toSqrtPrice(2n)
      const liquidity = 0n as Liquidity
      const resultUp = getDeltaX(sqrtPriceA, sqrtPriceB, liquidity, true)
      const resultDown = getDeltaX(sqrtPriceA, sqrtPriceB, liquidity, false)
      expect(resultUp).toEqual(0n)
      expect(resultDown).toEqual(0n)
    })
    test('equal at equal liquidity', async () => {
      const sqrtPriceA = toSqrtPrice(1n)
      const sqrtPriceB = toSqrtPrice(2n)
      const liquidity = toLiquidity(2n)
      const resultUp = getDeltaX(sqrtPriceA, sqrtPriceB, liquidity, true)
      const resultDown = getDeltaX(sqrtPriceA, sqrtPriceB, liquidity, false)
      expect(resultUp).toEqual(1n)
      expect(resultDown).toEqual(1n)
    })
    test('complex', async () => {
      const sqrtPriceA = 234878324943782000000000000n as SqrtPrice
      const sqrtPriceB = 87854456421658000000000000n as SqrtPrice
      const liquidity = 983983249092n as Liquidity
      const resultUp = getDeltaX(sqrtPriceA, sqrtPriceB, liquidity, true)
      const resultDown = getDeltaX(sqrtPriceA, sqrtPriceB, liquidity, false)
      // 7010.8199533068819376891841727789301497024557314488455622925765280
      expect(resultUp).toEqual(70109n)
      expect(resultDown).toEqual(70108n)
    })
    test('big', async () => {
      const sqrtPriceA = toSqrtPrice(1n)
      const sqrtPriceB = toSqrtPrice(5n, 1n)
      const liquidity = toLiquidity(2n ** 64n - 1n)
      const resultUp = getDeltaX(sqrtPriceA, sqrtPriceB, liquidity, true)
      const resultDown = getDeltaX(sqrtPriceA, sqrtPriceB, liquidity, false)
      expect(resultUp).toEqual(2n ** 64n - 1n)
      expect(resultDown).toEqual(2n ** 64n - 1n)
    })
    test('shouldnt overflow in intermediate operations', async () => {
      const sqrtPriceA = toSqrtPrice(1n)
      const sqrtPriceB = toSqrtPrice(5n, 1n)
      const liquidity = ((1n << 256n) - 1n) as Liquidity
      getDeltaX(sqrtPriceA, sqrtPriceB, liquidity, true)
      getDeltaX(sqrtPriceA, sqrtPriceB, liquidity, false)
    })
    test('huge liquidity', async () => {
      const sqrtPriceA = toSqrtPrice(1n)
      const sqrtPriceB = (toSqrtPrice(1n) + 1000000n) as SqrtPrice
      const liquidity = toLiquidity(1n << 80n)
      getDeltaX(sqrtPriceA, sqrtPriceB, liquidity, true)
      getDeltaX(sqrtPriceA, sqrtPriceB, liquidity, false)
    })
  })
  describe('get delta x - domain', () => {
    const almostMinSqrtPrice = 15259695000000000000n as SqrtPrice
    const maxLiquidity = ((1n << 256n) - 1n) as Liquidity
    const minLiquidity = 1n as Liquidity

    test('maximalize delta sqrt price and liquidity', async () => {
      const params = {
        sqrtPriceA: MAX_SQRT_PRICE,
        sqrtPriceB: MIN_SQRT_PRICE,
        liquidity: maxLiquidity
      }
      const resultUp = getDeltaX(params.sqrtPriceA, params.sqrtPriceB, params.liquidity, true)
      const resultDown = getDeltaX(params.sqrtPriceA, params.sqrtPriceB, params.liquidity, false)
      expect(resultUp).toEqual(
        75884792730156830614567103553061795263351065677581979504561495713443442818879n
      )
      expect(resultDown).toEqual(
        75884792730156830614567103553061795263351065677581979504561495713443442818878n
      )
    })
    test('maximalize delta sqrt price and minimalize liquidity', async () => {
      const params = {
        sqrtPriceA: MAX_SQRT_PRICE,
        sqrtPriceB: MIN_SQRT_PRICE,
        liquidity: minLiquidity
      }
      const resultUp = getDeltaX(params.sqrtPriceA, params.sqrtPriceB, params.liquidity, true)
      const resultDown = getDeltaX(params.sqrtPriceA, params.sqrtPriceB, params.liquidity, false)
      expect(resultUp).toEqual(1n)
      expect(resultDown).toEqual(0n)
    })
    test('minimize denominator on maximize liquidity which fit into token amounts', async () => {
      const params = {
        sqrtPriceA: MIN_SQRT_PRICE,
        sqrtPriceB: almostMinSqrtPrice,
        liquidity: maxLiquidity
      }
      const resultUp = getDeltaX(params.sqrtPriceA, params.sqrtPriceB, params.liquidity, true)
      const resultDown = getDeltaX(params.sqrtPriceA, params.sqrtPriceB, params.liquidity, false)
      expect(resultUp).toEqual(
        3794315473971847510172532341754979462199874072217062973965311338137066234n
      )
      expect(resultDown).toEqual(
        3794315473971847510172532341754979462199874072217062973965311338137066233n
      )
    })
    test('minimize denominator on minimize liquidity which fit into token amounts', async () => {
      const params = {
        sqrtPriceA: MIN_SQRT_PRICE,
        sqrtPriceB: almostMinSqrtPrice,
        liquidity: minLiquidity
      }
      const resultUp = getDeltaX(params.sqrtPriceA, params.sqrtPriceB, params.liquidity, true)
      const resultDown = getDeltaX(params.sqrtPriceA, params.sqrtPriceB, params.liquidity, false)
      expect(resultUp).toEqual(1n)
      expect(resultDown).toEqual(0n)
    })
    test('delta price limited by search range on max liquidity', async () => {
      const searchLimit = 256n
      const tickSpacing = 100n
      const maxSearchLimit = 221818n - searchLimit * tickSpacing
      const minSearchSqrtPrice = calculateSqrtPrice(maxSearchLimit)

      const params = {
        sqrtPriceA: MAX_SQRT_PRICE,
        sqrtPriceB: minSearchSqrtPrice,
        liquidity: maxLiquidity
      }
      const resultUp = getDeltaX(params.sqrtPriceA, params.sqrtPriceB, params.liquidity, true)
      expect(resultUp).toEqual(
        45875017378130362421757891862614875858481775310156442203847653871247n
      )
    })
    test('minimal price difference', async () => {
      const almostMaxSqrtPrice = (MAX_SQRT_PRICE - toSqrtPrice(1n)) as SqrtPrice
      const almostMinSqrtPrice = (MIN_SQRT_PRICE + toSqrtPrice(1n)) as SqrtPrice
      const paramsUpperBound = {
        sqrtPriceA: MAX_SQRT_PRICE,
        sqrtPriceB: almostMaxSqrtPrice,
        liquidity: maxLiquidity,
        roundingUp: true
      }
      const paramsBottomBound = {
        sqrtPriceA: MIN_SQRT_PRICE,
        sqrtPriceB: almostMinSqrtPrice,
        liquidity: maxLiquidity,
        roundingUp: true
      }
      const resultUp = getDeltaX(
        paramsUpperBound.sqrtPriceA,
        paramsUpperBound.sqrtPriceB,
        paramsUpperBound.liquidity,
        paramsUpperBound.roundingUp
      )
      const resultDown = getDeltaX(
        paramsBottomBound.sqrtPriceA,
        paramsBottomBound.sqrtPriceB,
        paramsBottomBound.liquidity,
        paramsBottomBound.roundingUp
      )
      expect(resultUp).toEqual(269608649375997235557394191156352599353486422139915865816324471n)
      expect(resultDown).toEqual(
        75883634844601460750582416171430603974060896681619645705711819135499453546638n
      )
    })
    test('zero liquidity', async () => {
      const params = {
        sqrtPriceA: MAX_SQRT_PRICE,
        sqrtPriceB: MIN_SQRT_PRICE,
        liquidity: 0n as Liquidity
      }
      const resultUp = getDeltaX(params.sqrtPriceA, params.sqrtPriceB, params.liquidity, true)
      const resultDown = getDeltaX(params.sqrtPriceA, params.sqrtPriceB, params.liquidity, false)
      expect(resultUp).toEqual(0n)
      expect(resultDown).toEqual(0n)
    })
  })

  describe('get delta y', () => {
    test('zero at zero liquidity', async () => {
      const sqrtPriceA = toSqrtPrice(1n)
      const sqrtPriceB = toSqrtPrice(1n)
      const liquidity = 0n as Liquidity

      const result = getDeltaY(sqrtPriceA, sqrtPriceB, liquidity, false)
      expect(result).toEqual(0n)
    })

    test('equal at equal liquidity', async () => {
      const sqrtPriceA = toSqrtPrice(1n)
      const sqrtPriceB = toSqrtPrice(2n)
      const liquidity = toLiquidity(2n)

      const result = getDeltaY(sqrtPriceA, sqrtPriceB, liquidity, false)
      expect(result).toEqual(2n)
    })

    test('big numbers', async () => {
      const sqrtPriceA = 234_878324943782000000000000n as SqrtPrice
      const sqrtPriceB = 87_854456421658000000000000n as SqrtPrice
      const liquidity = 9839832_49092n as Liquidity

      const resultUp = getDeltaY(sqrtPriceA, sqrtPriceB, liquidity, true)
      const resultDown = getDeltaY(sqrtPriceA, sqrtPriceB, liquidity, false)

      expect(resultUp).toEqual(1446690239n)
      expect(resultDown).toEqual(1446690238n)
    })

    test('big', async () => {
      const sqrtPriceA = toSqrtPrice(1n)
      const sqrtPriceB = toSqrtPrice(2n)
      const liquidity = toLiquidity(2n ** 64n - 1n)

      const resultUp = getDeltaY(sqrtPriceA, sqrtPriceB, liquidity, true)
      const resultDown = getDeltaY(sqrtPriceA, sqrtPriceB, liquidity, false)

      expect(resultUp).toEqual(liquidity / 1_00000n)
      expect(resultDown).toEqual(liquidity / 1_00000n)
    })

    test('overflow', async () => {
      const sqrtPriceA = toSqrtPrice(1n)
      const sqrtPriceB = (2n ** 256n - 1n) as SqrtPrice
      const liquidity = (2n ** 256n - 1n) as Liquidity

      expect(() => getDeltaY(sqrtPriceA, sqrtPriceB, liquidity, false)).toThrow(
        ArithmeticError.CastOverflow.toString()
      )
      expect(() => getDeltaY(sqrtPriceA, sqrtPriceB, liquidity, true)).toThrow(
        ArithmeticError.CastOverflow.toString()
      )

      // expectError(
      //   ArithmeticError.CastOverflow,
      //   getDeltaY(clamm, sqrtPriceA, sqrtPriceB, liquidity, true),
      //   clamm
      // )
      // expectError(
      //   ArithmeticError.CastOverflow,
      //   getDeltaY(clamm, sqrtPriceA, sqrtPriceB, liquidity, false),
      //   clamm
      // )
    })

    test('huge liquidity', async () => {
      const sqrtPriceA = 1_000000000000000000000000n as SqrtPrice
      const sqrtPriceB = 1_000000000000000001000000n as SqrtPrice
      const liquidity = (2n ** 256n - 1n) as Liquidity

      const resultUp = getDeltaY(sqrtPriceA, sqrtPriceB, liquidity, true)
      const resultDown = getDeltaY(sqrtPriceA, sqrtPriceB, liquidity, false)

      expect(resultUp).toStrictEqual(1157920892373161954235709850086879078532699846656405641n)
      expect(resultDown).toStrictEqual(1157920892373161954235709850086879078532699846656405640n)
    })
  })

  describe('get delta y - domain', () => {
    const minLiquidity = 1n as Liquidity
    const maxLiquidity = (2n ** 256n - 1n) as Liquidity

    it('maximize delta sqrt price and liquidity', async () => {
      const resultUp = getDeltaY(MAX_SQRT_PRICE, MIN_SQRT_PRICE, maxLiquidity, true)
      const resultDown = getDeltaY(MAX_SQRT_PRICE, MIN_SQRT_PRICE, maxLiquidity, false)

      expect(resultUp).toStrictEqual(
        75884790229800029582010010030152469040784228171629896065450012281800526658806n
      )
      expect(resultDown).toStrictEqual(
        75884790229800029582010010030152469040784228171629896065450012281800526658805n
      )
    })

    it('can be zero', async () => {
      const result = getDeltaY(
        MAX_SQRT_PRICE,
        (MAX_SQRT_PRICE - 1n) as SqrtPrice,
        minLiquidity,
        false
      )

      expect(result).toStrictEqual(0n)
    })

    it('liquidity is zero', async () => {
      const sqrtPriceA = MAX_SQRT_PRICE
      const sqrtPriceB = MIN_SQRT_PRICE

      const result = getDeltaY(sqrtPriceA, sqrtPriceB, 0n as Liquidity, true)

      expect(result).toStrictEqual(0n)
    })

    it('all max', async () => {
      const sqrtPriceA = MAX_SQRT_PRICE
      const sqrtPriceB = MAX_SQRT_PRICE
      const liquidity = maxLiquidity
      const result = getDeltaY(sqrtPriceA, sqrtPriceB, liquidity, true)

      expect(result).toStrictEqual(0n)
    })
  })
})
