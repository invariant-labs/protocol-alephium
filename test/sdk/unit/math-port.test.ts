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
      const liquidityDelta =
        14894636928365657818617562894966478347089917844485661564914997061885569n as Liquidity
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
        115792089237316195423570985008687907853269984665640564039457584007913126723661n,
        0n,
        false
      ])
    })

    test('max y', async () => {
      const currentTickIndex = GLOBAL_MAX_TICK
      const currentSqrtPrice = toSqrtPrice(1n)
      const liquidityDelta =
        14894636928373696130999721733782910261271218958219522272590008580045463n as Liquidity
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
        115792089237316195423570985008687907853269984665640564039457584007913122202687n,
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
      const liquidity = MAX_U256 as Liquidity
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
    const almostMinSqrtPrice = (MIN_SQRT_PRICE + 1n) as SqrtPrice
    const maxLiquidity = MAX_U256 as Liquidity
    const minLiquidity = 1n as Liquidity

    test('maximalize delta sqrt price and liquidity', async () => {
      const maxLiquidity =
        14893892252372018684584396344694974244327977275368655982357119807809415n as Liquidity

      const params = {
        sqrtPriceA: MAX_SQRT_PRICE,
        sqrtPriceB: MIN_SQRT_PRICE,
        liquidity: maxLiquidity
      }
      const resultUp = getDeltaX(params.sqrtPriceA, params.sqrtPriceB, params.liquidity, true)
      const resultDown = getDeltaX(params.sqrtPriceA, params.sqrtPriceB, params.liquidity, false)
      expect(resultUp).toEqual(
        115792089237316195423570985008687907853269984665640564039457584007913127186298n
      )
      expect(resultDown).toEqual(
        115792089237316195423570869216598670494368815695259202827259764340774619665833n
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
      expect(resultUp).toEqual(7774469n)
      expect(resultDown).toEqual(7774468n)
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
        1157920892373161954235709850086879078532699846656405640394575840079131296n
      )
      expect(resultDown).toEqual(
        578960446186580977117854925043439539266349923328202820197287920039565648n
      )
    })
    test('minimize denominator on minimize liquidity which fit into token amounts', async () => {
      const params = {
        sqrtPriceA: MIN_SQRT_PRICE,
        sqrtPriceB: (almostMinSqrtPrice + 99999n) as SqrtPrice,
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
      const maxSearchLimit = GLOBAL_MAX_TICK - searchLimit * tickSpacing
      const minSearchSqrtPrice = calculateSqrtPrice(maxSearchLimit)

      const params = {
        sqrtPriceA: MAX_SQRT_PRICE,
        sqrtPriceB: minSearchSqrtPrice,
        liquidity: maxLiquidity
      }
      const resultUp = getDeltaX(params.sqrtPriceA, params.sqrtPriceB, params.liquidity, true)
      expect(resultUp).toEqual(3867064427937095529780795325095328040602638051663673509970074n)
    })
    test('minimal price difference', async () => {
      const almostMaxSqrtPrice = (MAX_SQRT_PRICE - 1n) as SqrtPrice
      const almostMinSqrtPrice = (MIN_SQRT_PRICE + 1n) as SqrtPrice
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
      expect(resultUp).toEqual(1915744226453965600842067n)
      expect(resultDown).toEqual(
        1157920892373161954235709850086879078532699846656405640394575840079131296n
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
      const maxLiquidity =
        14893892252377511760793030683811718275421081100289805046680361113347505n as Liquidity
      const resultUp = getDeltaY(MAX_SQRT_PRICE, MIN_SQRT_PRICE, maxLiquidity, true)
      const resultDown = getDeltaY(MAX_SQRT_PRICE, MIN_SQRT_PRICE, maxLiquidity, false)

      expect(resultUp).toStrictEqual(
        115792089237316195423570985008687907853269984665640564039457584007913125390908n
      )
      expect(resultDown).toStrictEqual(
        115792089237316195423570985008687907853269984665640564039457584007913125390907n
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
