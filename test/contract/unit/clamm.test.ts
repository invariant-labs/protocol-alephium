import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { CLAMMInstance } from '../../../artifacts/ts'
import { deployCLAMM } from '../../../src/testUtils'
import {
  calculateAmountDelta,
  calculateFeeGrowthInside,
  calculateMaxLiquidityPerTick,
  calculateSqrtPrice,
  computeSwapStep,
  expectError,
  expectVMError,
  feeGrowthFromFee,
  getDeltaX,
  getDeltaY,
  getNextSqrtPriceFromInput,
  getNextSqrtPriceFromOutput,
  getNextSqrtPriceXUp,
  getNextSqrtPriceYDown,
  getTickAtSqrtPrice,
  isEnoughAmountToChangePrice,
  toFee
} from '../../../src/testUtils'
import {
  ArithmeticError,
  CLAMMError,
  FEE_GROWTH_DENOMINATOR,
  GLOBAL_MAX_TICK,
  GLOBAL_MIN_TICK,
  LIQUIDITY_DENOMINATOR,
  MAX_SQRT_PRICE,
  MAX_U256,
  MIN_SQRT_PRICE,
  SQRT_PRICE_DENOMINATOR,
  VMError
} from '../../../src/consts'
import { FeeGrowth, Liquidity, Percentage, SqrtPrice, TokenAmount } from '../../../src/types'
import { toFeeGrowth, toLiquidity, toPercentage, toSqrtPrice } from '../../../src/math'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let sender: PrivateKeyWallet

describe('clamm tests', () => {
  beforeAll(async () => {
    sender = await getSigner(ONE_ALPH * 100000n, 0)
  })

  test('fee growth from fee', async () => {
    const clamm = await deployCLAMM(sender)
    {
      const liquidity = toLiquidity(1n)
      const amount = 1n as TokenAmount
      const result = await feeGrowthFromFee(clamm, liquidity, amount)
      expect(result).toStrictEqual(10000000000000000000000000000n)
    }
    {
      const liquidity = toLiquidity(2n)
      const amount = 1n as TokenAmount
      const result = await feeGrowthFromFee(clamm, liquidity, amount)
      expect(result).toStrictEqual(5n * 10n ** 27n)
    }
    {
      const liquidity = toLiquidity((1n << 64n) - 1n)
      const amount = 1n as TokenAmount
      const result = await feeGrowthFromFee(clamm, liquidity, amount)
      expect(result).toStrictEqual(542101086n)
    }
    {
      const liquidity = toLiquidity(100n)
      const amount = 1000000n as TokenAmount
      const result = await feeGrowthFromFee(clamm, liquidity, amount)
      expect(result).toStrictEqual(10000n * 10n ** 28n)
    }
  })
  test('fee growth from fee - domain', async () => {
    const clamm = await deployCLAMM(sender)

    // max FeeGrowth case inside of domain
    {
      const maxLiquidity = MAX_U256 as Liquidity
      const maxToken = MAX_U256 as TokenAmount
      const feeGrowth = await feeGrowthFromFee(clamm, maxLiquidity, maxToken)

      expect(feeGrowth).toStrictEqual(1000000000000000000000000000000000n)
    }
    // min FeeGrowth case inside of domain
    {
      const basisPoint = 10000n
      const minToken = 1n
      const maxLiquidity = (minToken *
        FEE_GROWTH_DENOMINATOR *
        LIQUIDITY_DENOMINATOR *
        basisPoint) as Liquidity
      await feeGrowthFromFee(clamm, maxLiquidity, (minToken + basisPoint) as TokenAmount)
      // outside of domain trigger overflow due to result not fit into FeeGrowth
      {
        const liquidity = 1n as Liquidity
        const fee = MAX_U256 as TokenAmount

        await expectError(
          ArithmeticError.CastOverflow,
          feeGrowthFromFee(clamm, liquidity, fee),
          clamm
        )
      }
      // amount = 0
      {
        const liquidity = toLiquidity(1000n)
        const fee = 0n as TokenAmount
        const feeGrowth = await feeGrowthFromFee(clamm, liquidity, fee)
        expect(feeGrowth).toStrictEqual(0n)
      }
      // L = 0
      {
        const liquidity = 0n as Liquidity
        const fee = 1100n as TokenAmount
        await expectError(
          ArithmeticError.MulNotPositiveDenominator,
          feeGrowthFromFee(clamm, liquidity, fee),
          clamm
        )
      }
    }
  })
  test('fee growth to fee', async () => {
    const clamm = await deployCLAMM(sender)

    // Equal
    {
      const amount = 100n as TokenAmount
      const liquidity = toLiquidity(1000000n)
      const feeGrowth = await feeGrowthFromFee(clamm, liquidity, amount)
      const out = await toFee(clamm, liquidity, feeGrowth)
      expect(out).toStrictEqual(100n)
    }
    // Greater Liquidity
    {
      const amount = 100n as TokenAmount
      const liquidityBefore = toLiquidity(1000000n)
      const liquidityAfter = toLiquidity(10000000n)
      const feeGrowth = await feeGrowthFromFee(clamm, liquidityBefore, amount)
      const out = await toFee(clamm, liquidityAfter, feeGrowth)

      expect(out).toStrictEqual(1000n)
    }
    // huge liquidity
    {
      const amount = 100000000000000n as TokenAmount
      const liquidity = toLiquidity(1n << 77n)
      const feeGrowth = await feeGrowthFromFee(clamm, liquidity, amount)
      // real    6.61744490042422139897126953655970282852649688720703125 × 10^-10
      // expected 6617444900424221398
      expect(feeGrowth).toStrictEqual(6617444900424221398n)
      const out = await toFee(clamm, liquidity, feeGrowth)
      // real    9.99999999999999999853225897430980027744256 × 10^13
      // expected 99999999999999
      expect(out).toStrictEqual(99_999_999_999_999n)
    }
  })
  test('fee growth to fee - domain', async () => {
    const clamm = await deployCLAMM(sender)
    // overflowing mul
    {
      const amount = 600000000000000000n as TokenAmount
      const liquidity = toLiquidity(10000000000000000000n)
      const feeGrowth = await feeGrowthFromFee(clamm, liquidity, amount)
      expect(feeGrowth).toStrictEqual(600000000000000000000000000n)
      const out = await toFee(clamm, liquidity, feeGrowth)
      expect(out).toStrictEqual(600000000000000000n)
    }
    // max value inside domain
    {
      const liquidity = MAX_U256 as Liquidity
      const feeGrowth = (100000n * 10n ** 28n) as FeeGrowth
      const out = await toFee(clamm, liquidity, feeGrowth)
      expect(out).toStrictEqual(
        115792089237316195423570985008687907853269984665640564039457584007913129639935n
      )
    }
    // Overflow
    {
      const liquidity = MAX_U256 as Liquidity
      const feeGrowth = MAX_U256 as FeeGrowth
      await expectError(ArithmeticError.CastOverflow, toFee(clamm, liquidity, feeGrowth), clamm)
    }
    // FeeGrowth = 0
    {
      const liquidity = toLiquidity(1000n)
      const feeGrowth = 0n as FeeGrowth
      const out = await toFee(clamm, liquidity, feeGrowth)
      expect(out).toStrictEqual(0n)
    }
    // Liquidity = 0
    {
      const liquidity = 0n as Liquidity
      const feeGrowth = toFeeGrowth(1000n)
      const out = await toFee(clamm, liquidity, feeGrowth)
      expect(out).toStrictEqual(0n)
    }
  })
  test('tick from sqrt price', async () => {
    const clamm = await deployCLAMM(sender)
    {
      const sqrtPrice = 999006987054867461743028n as SqrtPrice
      const result = await getTickAtSqrtPrice(clamm, sqrtPrice, 10n)
      expect(result).toBe(-20n)
    }
  })
  test('align tick to tickspacing', async () => {
    const clamm = await deployCLAMM(sender)
    {
      const accurateTick = 0n
      const tickSpacing = 3n
      const result = (
        await clamm.view.alignTickToSpacing({
          args: { accurateTick, tickSpacing }
        })
      ).returns
      expect(result).toBe(0n)
    }
    {
      const accurateTick = 14n
      const tickSpacing = 10n
      const result = (
        await clamm.view.alignTickToSpacing({
          args: { accurateTick, tickSpacing }
        })
      ).returns
      expect(result).toBe(10n)
    }
    {
      const accurateTick = 20n
      const tickSpacing = 10n
      const result = (
        await clamm.view.alignTickToSpacing({
          args: { accurateTick, tickSpacing }
        })
      ).returns
      expect(result).toBe(20n)
    }
    {
      const accurateTick = -14n
      const tickSpacing = 10n
      const result = (
        await clamm.view.alignTickToSpacing({
          args: { accurateTick, tickSpacing }
        })
      ).returns
      expect(result).toBe(-20n)
    }
    {
      const accurateTick = -21n
      const tickSpacing = 10n
      const result = (
        await clamm.view.alignTickToSpacing({
          args: { accurateTick, tickSpacing }
        })
      ).returns
      expect(result).toBe(-30n)
    }
    {
      const accurateTick = -120n
      const tickSpacing = 3n
      const result = (
        await clamm.view.alignTickToSpacing({
          args: { accurateTick, tickSpacing }
        })
      ).returns
      expect(result).toBe(-120n)
    }
  })
  test('log spacing over 1', async () => {
    const clamm = await deployCLAMM(sender)
    {
      for (let i = 0n; i < 100n; i++) {
        const sqrtPriceDecimal = await calculateSqrtPrice(clamm, i)

        let tick = await getTickAtSqrtPrice(clamm, sqrtPriceDecimal, 3n)
        let expectedTick = (
          await clamm.view.alignTickToSpacing({
            args: { accurateTick: i, tickSpacing: 3n }
          })
        ).returns
        expect(tick).toEqual(expectedTick)
      }
    }
    {
      for (let i = -100n; i < 0; i++) {
        const sqrtPriceDecimal = await calculateSqrtPrice(clamm, i)
        let tick = await getTickAtSqrtPrice(clamm, sqrtPriceDecimal, 3n)
        let expectedTick = (
          await clamm.view.alignTickToSpacing({
            args: { accurateTick: i, tickSpacing: 3n }
          })
        ).returns
        expect(tick).toEqual(expectedTick)
      }
    }
  })
  test('log', async () => {
    const clamm = await deployCLAMM(sender)
    {
      for (let i = 0n; i < 100n; i++) {
        const sqrtPriceDecimal = await calculateSqrtPrice(clamm, i)
        let tick = await getTickAtSqrtPrice(clamm, sqrtPriceDecimal, 1n)
        expect(tick).toEqual(i)
      }
    }
    {
      for (let i = -100n; i < 0; i++) {
        const sqrtPriceDecimal = await calculateSqrtPrice(clamm, i)
        let tick = await getTickAtSqrtPrice(clamm, sqrtPriceDecimal, 1n)
        expect(tick).toEqual(i)
      }
    }
  })

  describe('get delta x', () => {
    let clamm: CLAMMInstance

    beforeAll(async () => {
      clamm = await deployCLAMM(sender)
    })
    test('zero at zero liquidity', async () => {
      const sqrtPriceA = toSqrtPrice(1n)
      const sqrtPriceB = toSqrtPrice(2n)
      const liquidity = 0n as Liquidity
      const resultUp = await getDeltaX(clamm, sqrtPriceA, sqrtPriceB, liquidity, true)
      const resultDown = await getDeltaX(clamm, sqrtPriceA, sqrtPriceB, liquidity, false)
      expect(resultUp).toEqual(0n)
      expect(resultDown).toEqual(0n)
    })
    test('equal at equal liquidity', async () => {
      const sqrtPriceA = toSqrtPrice(1n)
      const sqrtPriceB = toSqrtPrice(2n)
      const liquidity = toLiquidity(2n)
      const resultUp = await getDeltaX(clamm, sqrtPriceA, sqrtPriceB, liquidity, true)
      const resultDown = await getDeltaX(clamm, sqrtPriceA, sqrtPriceB, liquidity, false)
      expect(resultUp).toEqual(1n)
      expect(resultDown).toEqual(1n)
    })
    test('complex', async () => {
      const sqrtPriceA = 234878324943782000000000000n as SqrtPrice
      const sqrtPriceB = 87854456421658000000000000n as SqrtPrice
      const liquidity = 983983249092n as Liquidity
      const resultUp = await getDeltaX(clamm, sqrtPriceA, sqrtPriceB, liquidity, true)
      const resultDown = await getDeltaX(clamm, sqrtPriceA, sqrtPriceB, liquidity, false)
      // 7010.8199533068819376891841727789301497024557314488455622925765280
      expect(resultUp).toEqual(70109n)
      expect(resultDown).toEqual(70108n)
    })
    test('big', async () => {
      const sqrtPriceA = toSqrtPrice(1n)
      const sqrtPriceB = toSqrtPrice(5n, 1n)
      const liquidity = toLiquidity(2n ** 64n - 1n)
      const resultUp = await getDeltaX(clamm, sqrtPriceA, sqrtPriceB, liquidity, true)
      const resultDown = await getDeltaX(clamm, sqrtPriceA, sqrtPriceB, liquidity, false)
      expect(resultUp).toEqual(2n ** 64n - 1n)
      expect(resultDown).toEqual(2n ** 64n - 1n)
    })
    test('shouldnt overflow in intermediate operations', async () => {
      const sqrtPriceA = toSqrtPrice(1n)
      const sqrtPriceB = toSqrtPrice(5n, 1n)
      const liquidity = MAX_U256 as Liquidity
      await getDeltaX(clamm, sqrtPriceA, sqrtPriceB, liquidity, true)
      await getDeltaX(clamm, sqrtPriceA, sqrtPriceB, liquidity, false)
    })
    test('huge liquidity', async () => {
      const sqrtPriceA = toSqrtPrice(1n)
      const sqrtPriceB = (toSqrtPrice(1n) + 1000000n) as SqrtPrice
      const liquidity = toLiquidity(1n << 80n)
      await getDeltaX(clamm, sqrtPriceA, sqrtPriceB, liquidity, true)
      await getDeltaX(clamm, sqrtPriceA, sqrtPriceB, liquidity, false)
    })
  })
  describe('get delta x - domain', () => {
    let clamm: CLAMMInstance
    const almostMinSqrtPrice = (MIN_SQRT_PRICE + 1n) as SqrtPrice
    const maxLiquidity = MAX_U256 as Liquidity
    const minLiquidity = 1n as Liquidity

    beforeAll(async () => {
      clamm = await deployCLAMM(sender)
    })
    test('maximalize delta sqrt price and liquidity', async () => {
      {
        const maxLiquidity =
          14893892252372018684584396344694974244327977275368655982357119807809415n as Liquidity
        const params = {
          sqrtPriceA: MAX_SQRT_PRICE,
          sqrtPriceB: MIN_SQRT_PRICE,
          liquidity: maxLiquidity
        }
        const resultUp = await getDeltaX(
          clamm,
          params.sqrtPriceA,
          params.sqrtPriceB,
          params.liquidity,
          true
        )
        expect(resultUp).toEqual(
          115792089237316195423570985008687907853269984665640564039457584007913127186298n
        )

        await expectVMError(
          VMError.VMExecutionError,
          getDeltaX(
            clamm,
            params.sqrtPriceA,
            params.sqrtPriceB,
            (params.liquidity + 1n) as Liquidity,
            true
          )
        )
      }

      {
        const maxLiquidity =
          14893892252372018684584411238587226621839738068399339794075395228890515n as Liquidity
        const params = {
          sqrtPriceA: MAX_SQRT_PRICE,
          sqrtPriceB: MIN_SQRT_PRICE,
          liquidity: maxLiquidity
        }
        const resultUp = await getDeltaX(
          clamm,
          params.sqrtPriceA,
          params.sqrtPriceB,
          params.liquidity,
          false
        )
        expect(resultUp).toEqual(
          115792089237316195423570985008687907853269984665640564039457584007913124933217n
        )

        await expectVMError(
          VMError.VMExecutionError,
          getDeltaX(
            clamm,
            params.sqrtPriceA,
            params.sqrtPriceB,
            (params.liquidity + 1n) as Liquidity,
            false
          )
        )
      }
    })
    test('maximalize delta sqrt price and minimalize liquidity', async () => {
      const params = {
        sqrtPriceA: MAX_SQRT_PRICE,
        sqrtPriceB: MIN_SQRT_PRICE,
        liquidity: minLiquidity
      }
      const resultUp = await getDeltaX(
        clamm,
        params.sqrtPriceA,
        params.sqrtPriceB,
        params.liquidity,
        true
      )
      const resultDown = await getDeltaX(
        clamm,
        params.sqrtPriceA,
        params.sqrtPriceB,
        params.liquidity,
        false
      )
      expect(resultUp).toEqual(7774469n)
      expect(resultDown).toEqual(7774468n)
    })
    test('minimize denominator on maximize liquidity which fit into token amounts', async () => {
      const params = {
        sqrtPriceA: MIN_SQRT_PRICE,
        sqrtPriceB: almostMinSqrtPrice,
        liquidity: maxLiquidity
      }
      const resultUp = await getDeltaX(
        clamm,
        params.sqrtPriceA,
        params.sqrtPriceB,
        params.liquidity,
        true
      )
      const resultDown = await getDeltaX(
        clamm,
        params.sqrtPriceA,
        params.sqrtPriceB,
        params.liquidity,
        false
      )
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
      const resultUp = await getDeltaX(
        clamm,
        params.sqrtPriceA,
        params.sqrtPriceB,
        params.liquidity,
        true
      )
      const resultDown = await getDeltaX(
        clamm,
        params.sqrtPriceA,
        params.sqrtPriceB,
        params.liquidity,
        false
      )
      expect(resultUp).toEqual(1n)
      expect(resultDown).toEqual(0n)
    })
    test('delta price limited by search range on max liquidity', async () => {
      const searchLimit = 256n
      const tickSpacing = 100n
      const maxSearchLimit = GLOBAL_MAX_TICK - searchLimit * tickSpacing
      const minSearchSqrtPrice = await calculateSqrtPrice(clamm, maxSearchLimit)

      const params = {
        sqrtPriceA: MAX_SQRT_PRICE,
        sqrtPriceB: minSearchSqrtPrice,
        liquidity: maxLiquidity
      }
      const resultUp = await getDeltaX(
        clamm,
        params.sqrtPriceA,
        params.sqrtPriceB,
        params.liquidity,
        true
      )
      expect(resultUp).toEqual(3867064427937095529780795325095328040602638051663673509970074n)
    })
    test('minimal price difference', async () => {
      const almostMaxSqrtPrice = (MAX_SQRT_PRICE - 1n) as SqrtPrice
      const almostMinSqrtPrice = (MIN_SQRT_PRICE + 1n) as SqrtPrice
      const maxLiquidity =
        115792089237316195423570985008687907853269984665640564039457584007913129639935n as Liquidity
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
      const resultUp = await getDeltaX(
        clamm,
        paramsUpperBound.sqrtPriceA,
        paramsUpperBound.sqrtPriceB,
        paramsUpperBound.liquidity,
        paramsUpperBound.roundingUp
      )
      const resultDown = await getDeltaX(
        clamm,
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
      const resultUp = await getDeltaX(
        clamm,
        params.sqrtPriceA,
        params.sqrtPriceB,
        params.liquidity,
        true
      )
      const resultDown = await getDeltaX(
        clamm,
        params.sqrtPriceA,
        params.sqrtPriceB,
        params.liquidity,
        false
      )
      expect(resultUp).toEqual(0n)
      expect(resultDown).toEqual(0n)
    })
  })

  describe('get delta y', () => {
    let clamm: CLAMMInstance

    beforeEach(async () => {
      clamm = await deployCLAMM(sender)
    })

    test('zero at zero liquidity', async () => {
      const sqrtPriceA = toSqrtPrice(1n)
      const sqrtPriceB = toSqrtPrice(1n)
      const liquidity = 0n as Liquidity

      const result = await getDeltaY(clamm, sqrtPriceA, sqrtPriceB, liquidity, false)
      expect(result).toEqual(0n)
    })

    test('equal at equal liquidity', async () => {
      const sqrtPriceA = toSqrtPrice(1n)
      const sqrtPriceB = toSqrtPrice(2n)
      const liquidity = toLiquidity(2n)

      const result = await getDeltaY(clamm, sqrtPriceA, sqrtPriceB, liquidity, false)
      expect(result).toEqual(2n)
    })

    test('big numbers', async () => {
      const sqrtPriceA = 234_878324943782000000000000n as SqrtPrice
      const sqrtPriceB = 87_854456421658000000000000n as SqrtPrice
      const liquidity = 9839832_49092n as Liquidity

      const resultUp = await getDeltaY(clamm, sqrtPriceA, sqrtPriceB, liquidity, true)
      const resultDown = await getDeltaY(clamm, sqrtPriceA, sqrtPriceB, liquidity, false)

      expect(resultUp).toEqual(1446690239n)
      expect(resultDown).toEqual(1446690238n)
    })

    test('big', async () => {
      const sqrtPriceA = toSqrtPrice(1n)
      const sqrtPriceB = toSqrtPrice(2n)
      const liquidity = toLiquidity(2n ** 64n - 1n)

      const resultUp = await getDeltaY(clamm, sqrtPriceA, sqrtPriceB, liquidity, true)
      const resultDown = await getDeltaY(clamm, sqrtPriceA, sqrtPriceB, liquidity, false)

      expect(resultUp).toEqual(liquidity / 1_00000n)
      expect(resultDown).toEqual(liquidity / 1_00000n)
    })

    test('overflow', async () => {
      const sqrtPriceA = toSqrtPrice(1n)
      const sqrtPriceB = MAX_U256 as SqrtPrice
      const liquidity = MAX_U256 as Liquidity

      await expectError(
        ArithmeticError.CastOverflow,
        getDeltaY(clamm, sqrtPriceA, sqrtPriceB, liquidity, true),
        clamm
      )
      await expectError(
        ArithmeticError.CastOverflow,
        getDeltaY(clamm, sqrtPriceA, sqrtPriceB, liquidity, false),
        clamm
      )
    })

    test('huge liquidity', async () => {
      const sqrtPriceA = 1_000000000000000000000000n as SqrtPrice
      const sqrtPriceB = 1_000000000000000001000000n as SqrtPrice
      const liquidity = MAX_U256 as Liquidity

      const resultUp = await getDeltaY(clamm, sqrtPriceA, sqrtPriceB, liquidity, true)
      const resultDown = await getDeltaY(clamm, sqrtPriceA, sqrtPriceB, liquidity, false)

      expect(resultUp).toStrictEqual(1157920892373161954235709850086879078532699846656405641n)
      expect(resultDown).toStrictEqual(1157920892373161954235709850086879078532699846656405640n)
    })
  })

  describe('get delta y - domain', () => {
    let clamm: CLAMMInstance
    const minLiquidity = 1n as Liquidity
    const maxLiquidity = MAX_U256 as Liquidity

    beforeEach(async () => {
      clamm = await deployCLAMM(sender)
    })

    it('maximize delta sqrt price and liquidity', async () => {
      const maxLiquidity =
        14893892252377511760793030683811718275421081100289805046680361113347505n as Liquidity
      const resultUp = await getDeltaY(clamm, MAX_SQRT_PRICE, MIN_SQRT_PRICE, maxLiquidity, true)
      const resultDown = await getDeltaY(clamm, MAX_SQRT_PRICE, MIN_SQRT_PRICE, maxLiquidity, false)

      expect(resultUp).toStrictEqual(
        115792089237316195423570985008687907853269984665640564039457584007913125390908n
      )
      expect(resultDown).toStrictEqual(
        115792089237316195423570985008687907853269984665640564039457584007913125390907n
      )
    })

    it('can be zero', async () => {
      const result = await getDeltaY(
        clamm,
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

      const result = await getDeltaY(clamm, sqrtPriceA, sqrtPriceB, 0n as Liquidity, true)

      expect(result).toStrictEqual(0n)
    })

    it('all max', async () => {
      const sqrtPriceA = MAX_SQRT_PRICE
      const sqrtPriceB = MAX_SQRT_PRICE
      const liquidity = maxLiquidity
      const result = await getDeltaY(clamm, sqrtPriceA, sqrtPriceB, liquidity, true)

      expect(result).toStrictEqual(0n)
    })
  })

  test('get next sqrt price y down - base samples', async () => {
    const clamm = await deployCLAMM(sender)

    {
      const startingSqrtPrice = SQRT_PRICE_DENOMINATOR
      const liquidity = LIQUIDITY_DENOMINATOR
      const y = 1n as TokenAmount
      const nextSqrtPrice = await getNextSqrtPriceYDown(
        clamm,
        startingSqrtPrice,
        liquidity,
        y,
        true
      )
      expect(nextSqrtPrice).toEqual(2n * SQRT_PRICE_DENOMINATOR)
    }
    {
      const startingSqrtPrice = SQRT_PRICE_DENOMINATOR
      const liquidity = (2n * LIQUIDITY_DENOMINATOR) as Liquidity
      const y = 3n as TokenAmount
      const nextSqrtPrice = await getNextSqrtPriceYDown(
        clamm,
        startingSqrtPrice,
        liquidity,
        y,
        true
      )
      expect(nextSqrtPrice).toEqual(25n * 10n ** 23n)
    }
    {
      const startingSqrtPrice = (2n * SQRT_PRICE_DENOMINATOR) as SqrtPrice
      const liquidity = (3n * LIQUIDITY_DENOMINATOR) as Liquidity
      const y = 5n as TokenAmount
      const nextSqrtPrice = await getNextSqrtPriceYDown(
        clamm,
        startingSqrtPrice,
        liquidity,
        y,
        true
      )
      expect(nextSqrtPrice).toEqual((11n * SQRT_PRICE_DENOMINATOR) / 3n)
    }
    {
      const startingSqrtPrice = (24234n * SQRT_PRICE_DENOMINATOR) as SqrtPrice
      const liquidity = (3000n * LIQUIDITY_DENOMINATOR) as Liquidity
      const y = 5000n as TokenAmount
      const nextSqrtPrice = await getNextSqrtPriceYDown(
        clamm,
        startingSqrtPrice,
        liquidity,
        y,
        true
      )
      expect(nextSqrtPrice).toEqual((72707n * SQRT_PRICE_DENOMINATOR) / 3n)
    }
    {
      const startingSqrtPrice = (1n * SQRT_PRICE_DENOMINATOR) as SqrtPrice
      const liquidity = (2n * LIQUIDITY_DENOMINATOR) as Liquidity
      const y = 1n as TokenAmount
      const nextSqrtPrice = await getNextSqrtPriceYDown(
        clamm,
        startingSqrtPrice,
        liquidity,
        y,
        false
      )
      expect(nextSqrtPrice).toEqual(5n * 10n ** 23n)
    }
    {
      const startingSqrtPrice = (100000n * SQRT_PRICE_DENOMINATOR) as SqrtPrice
      const liquidity = (500000000n * LIQUIDITY_DENOMINATOR) as Liquidity
      const y = 4000n as TokenAmount
      const nextSqrtPrice = await getNextSqrtPriceYDown(
        clamm,
        startingSqrtPrice,
        liquidity,
        y,
        false
      )
      expect(nextSqrtPrice).toEqual(99999999992000000000000000000n)
    }
    {
      const startingSqrtPrice = (3n * SQRT_PRICE_DENOMINATOR) as SqrtPrice
      const liquidity = (222n * LIQUIDITY_DENOMINATOR) as Liquidity
      const y = 37n as TokenAmount
      const nextSqrtPrice = await getNextSqrtPriceYDown(
        clamm,
        startingSqrtPrice,
        liquidity,
        y,
        false
      )
      expect(nextSqrtPrice).toEqual(2833333333333333333333333n)
    }
  })
  test('get next sqrt price y down - domain', async () => {
    const clamm = await deployCLAMM(sender)

    const minY = 1n as TokenAmount
    const maxY = MAX_U256 as TokenAmount
    const almostMinSqrtPrice = (MIN_SQRT_PRICE + 1n) as SqrtPrice
    const almostMaxSqrtPrice = (MAX_SQRT_PRICE - 1n) as SqrtPrice
    const minSqrtPriceOutsideDomain = 1n as SqrtPrice
    const minLiquidity = 1n as Liquidity
    const maxLiquidity = MAX_U256 as Liquidity
    const minOverflowTokenY = 115792089237316195423570985008687907853269984665575031n
    const oneLiquidity = toLiquidity(1n)

    // Min value inside domain
    {
      // increases MIN_SQRT_PRICE
      {
        const params = {
          startingSqrtPrice: MIN_SQRT_PRICE,
          liquidity: maxLiquidity,
          y: (minY + (1n << 128n) * (1n << 32n)) as TokenAmount,
          addY: true
        }
        const nextSqrtPrice = await getNextSqrtPriceYDown(
          clamm,
          params.startingSqrtPrice,
          params.liquidity,
          params.y,
          true
        )
        expect(nextSqrtPrice).toEqual(MIN_SQRT_PRICE + 1n)
      }
      // decreases almostMinSqrtPrice
      {
        const params = {
          startingSqrtPrice: almostMinSqrtPrice,
          liquidity: maxLiquidity,
          y: minY,
          addY: false
        }
        const nextSqrtPrice = await getNextSqrtPriceYDown(
          clamm,
          params.startingSqrtPrice,
          params.liquidity,
          params.y,
          false
        )
        expect(nextSqrtPrice).toEqual(MIN_SQRT_PRICE)
      }
    }
    // Max value inside domain
    {
      // decreases MAX_SQRT_PRICE
      {
        const params = {
          startingSqrtPrice: MAX_SQRT_PRICE,
          liquidity: maxLiquidity,
          y: (minY + (1n << 128n) * (1n << 32n)) as TokenAmount,
          addY: false
        }
        const nextSqrtPrice = await getNextSqrtPriceYDown(
          clamm,
          params.startingSqrtPrice,
          params.liquidity,
          params.y,
          false
        )
        expect(nextSqrtPrice).toEqual(MAX_SQRT_PRICE - 2n)
      }
      // increases almostMaxSqrtPrice
      {
        const params = {
          startingSqrtPrice: almostMaxSqrtPrice,
          liquidity: maxLiquidity,
          y: (minY + 600000000n) as TokenAmount,
          addY: true
        }
        const nextSqrtPrice = await getNextSqrtPriceYDown(
          clamm,
          params.startingSqrtPrice,
          params.liquidity,
          params.y,
          true
        )
        expect(nextSqrtPrice).toEqual(MAX_SQRT_PRICE - 1n)
      }
    }
    // Extension TokenAmount to SqrtPrice decimal overflow
    {
      {
        const params = {
          startingSqrtPrice: MAX_SQRT_PRICE,
          liquidity: minLiquidity,
          y: maxY,
          addY: true
        }
        await expectError(
          ArithmeticError.CastOverflow,
          getNextSqrtPriceYDown(clamm, params.startingSqrtPrice, params.liquidity, params.y, true),
          clamm
        )
      }
      {
        const params = {
          startingSqrtPrice: minSqrtPriceOutsideDomain,
          liquidity: minLiquidity,
          y: maxY,
          addY: false
        }
        await expectError(
          ArithmeticError.CastOverflow,
          getNextSqrtPriceYDown(clamm, params.startingSqrtPrice, params.liquidity, params.y, false),
          clamm
        )
      }
    }
    // Overflow in SqrtPrice Difference
    {
      {
        const params = {
          startingSqrtPrice: MAX_SQRT_PRICE,
          liquidity: oneLiquidity,
          y: (minOverflowTokenY - 2n) as TokenAmount,
          addY: true
        }

        await expectVMError(
          VMError.ArithmeticError,
          getNextSqrtPriceYDown(clamm, params.startingSqrtPrice, params.liquidity, params.y, true)
        )
      }
      {
        const params = {
          startingSqrtPrice: minSqrtPriceOutsideDomain,
          liquidity: oneLiquidity,
          y: (minOverflowTokenY - 2n) as TokenAmount,
          addY: false
        }
        await expectVMError(
          VMError.ArithmeticError,
          getNextSqrtPriceYDown(clamm, params.startingSqrtPrice, params.liquidity, params.y, false)
        )
      }
    }
    // Quotient overflow
    {
      const minYOverflowDecimalExtension = (1n << 225n) as TokenAmount
      const irrelevantSqrtPrice = 1n as SqrtPrice
      const irrelevantLiquidity = oneLiquidity
      {
        const params = {
          startingSqrtPrice: irrelevantSqrtPrice,
          liquidity: irrelevantLiquidity,
          y: minYOverflowDecimalExtension,
          addY: true
        }
        await expectError(
          ArithmeticError.CastOverflow,
          getNextSqrtPriceYDown(clamm, params.startingSqrtPrice, params.liquidity, params.y, true),
          clamm
        )
      }
      {
        const params = {
          startingSqrtPrice: irrelevantSqrtPrice,
          liquidity: irrelevantLiquidity,
          y: minYOverflowDecimalExtension,
          addY: false
        }
        await expectError(
          ArithmeticError.CastOverflow,
          getNextSqrtPriceYDown(clamm, params.startingSqrtPrice, params.liquidity, params.y, false),
          clamm
        )
      }
    }
    // Y max
    {
      const params = {
        startingSqrtPrice: MIN_SQRT_PRICE,
        liquidity: maxLiquidity,
        y: maxY,
        addY: true
      }
      const nextSqrtPrice = await getNextSqrtPriceYDown(
        clamm,
        params.startingSqrtPrice,
        params.liquidity,
        params.y,
        true
      )
      expect(nextSqrtPrice).toEqual(100000000000000001286261639329n)
    }
    // L = 0
    {
      const params = {
        startingSqrtPrice: MIN_SQRT_PRICE,
        liquidity: 0n as Liquidity,
        y: minY,
        addY: true
      }
      await expectError(
        ArithmeticError.DivNotPositiveDivisor,
        getNextSqrtPriceYDown(clamm, params.startingSqrtPrice, params.liquidity, params.y, true),
        clamm
      )
    }
    // TokenAmount is zero
    {
      const params = {
        startingSqrtPrice: MIN_SQRT_PRICE,
        liquidity: maxLiquidity,
        y: 0n as TokenAmount,
        addY: true
      }
      const nextSqrtPrice = await getNextSqrtPriceYDown(
        clamm,
        params.startingSqrtPrice,
        params.liquidity,
        params.y,
        true
      )
      expect(nextSqrtPrice).toEqual(MIN_SQRT_PRICE)
    }
  })

  test('calculate max liquidity per tick - tick spacing 1, max liquidity / 1095227', async () => {
    const clamm = await deployCLAMM(sender)
    const maxLiquidity = await calculateMaxLiquidityPerTick(clamm, 1n)
    expect(maxLiquidity).toEqual(
      105724282945285493713696781588372006765054171113057442922296093876349952n
    )
  })

  test('calculate max liquidity per tick - tick spacing 2, max liquidity / 547613', async () => {
    const clamm = await deployCLAMM(sender)
    const maxLiquidity = await calculateMaxLiquidityPerTick(clamm, 2n)
    expect(maxLiquidity).toEqual(
      211448758954437158036005326770343121608270776379743658458542043391798824n
    )
  })

  test('calculate max liquidity per tick - tick spacing 5, max liquidity / 219045', async () => {
    const clamm = await deployCLAMM(sender)
    const maxLiquidity = await calculateMaxLiquidityPerTick(clamm, 5n)
    expect(maxLiquidity).toEqual(
      528622380046639710669364673965111770883927890002696085459415115651638383n
    )
  })

  test('calculate max liquidity per tick - tick spacing 100, max liquidity / 10952', async () => {
    const clamm = await deployCLAMM(sender)
    const maxLiquidity = await calculateMaxLiquidityPerTick(clamm, 100n)
    expect(maxLiquidity).toEqual(
      10572688936935372116834458090639874712679874421625325423617383492322236088n
    )
  })

  test('is enough amount to change price - domain', async () => {
    const clamm = await deployCLAMM(sender)
    const zeroLiquidity = 0n as Liquidity
    const maxFee = (10n ** 12n) as Percentage
    const maxAmount = MAX_U256 as TokenAmount
    const minAmount = 1n as TokenAmount
    const minLiquidity = 1n as Liquidity
    const minFee = 0n as Percentage
    // max fee
    {
      const params = {
        amount: minAmount,
        startingSqrtPrice: MAX_SQRT_PRICE,
        liquidity: minLiquidity,
        fee: maxFee,
        byAmountIn: false,
        xToY: false
      }
      await expectVMError(
        VMError.ArithmeticError,
        isEnoughAmountToChangePrice(
          clamm,
          params.amount,
          params.startingSqrtPrice,
          params.liquidity,
          params.fee,
          params.byAmountIn,
          params.xToY
        )
      )
    }
    // L = 0
    {
      const params = {
        amount: maxAmount,
        startingSqrtPrice: MAX_SQRT_PRICE,
        liquidity: zeroLiquidity,
        fee: maxFee,
        byAmountIn: false,
        xToY: false
      }
      const isEnough = await isEnoughAmountToChangePrice(
        clamm,
        params.amount,
        params.startingSqrtPrice,
        params.liquidity,
        params.fee,
        params.byAmountIn,
        params.xToY
      )
      expect(isEnough).toBe(true)
    }
    // Min amount
    {
      const params = {
        amount: minAmount,
        startingSqrtPrice: MAX_SQRT_PRICE,
        liquidity: minLiquidity,
        fee: minFee,
        byAmountIn: false,
        xToY: false
      }
      await expectVMError(
        VMError.ArithmeticError,
        isEnoughAmountToChangePrice(
          clamm,
          params.amount,
          params.startingSqrtPrice,
          params.liquidity,
          params.fee,
          params.byAmountIn,
          params.xToY
        )
      )
    }
    // Max amount
    const params = {
      amount: maxAmount,
      startingSqrtPrice: MAX_SQRT_PRICE,
      liquidity: minLiquidity,
      fee: minFee,
      byAmountIn: false,
      xToY: false
    }
    await expectVMError(
      VMError.ArithmeticError,
      isEnoughAmountToChangePrice(
        clamm,
        params.amount,
        params.startingSqrtPrice,
        params.liquidity,
        params.fee,
        params.byAmountIn,
        params.xToY
      )
    )
  })

  describe('calculate fee growth inside', () => {
    let clamm: CLAMMInstance
    const globalFeeGrowthX = toFeeGrowth(15n)
    const globalFeeGrowthY = toFeeGrowth(15n)

    const tickLowerIndex = -2n
    const tickLowerFeeGrowthOutsideX = 0n as FeeGrowth
    const tickLowerFeeGrowthOutsideY = 0n as FeeGrowth

    const tickUpperIndex = 2n
    const tickUpperFeeGrowthOutsideX = 0n as FeeGrowth
    const tickUpperFeeGrowthOutsideY = 0n as FeeGrowth

    beforeEach(async () => {
      clamm = await deployCLAMM(sender)
    })

    test('sqrt price between ticks', async () => {
      // <──────────────                    ──────────────>
      // fee_outside_t0| fee_growth_inside |fee_outside_t1
      //<───────────── t0 ────── C ────── t1 ───────────────────>
      // fee_growth_inside = fee_growth_global - t0.fee_outside - t1.fee_outside

      const tickCurrent = 0n

      // current tick inside range
      // lower    current     upper
      // |        |           |
      // -2       0           2

      const result = await calculateFeeGrowthInside(
        clamm,
        tickLowerIndex,
        tickLowerFeeGrowthOutsideX,
        tickLowerFeeGrowthOutsideY,
        tickUpperIndex,
        tickUpperFeeGrowthOutsideX,
        tickUpperFeeGrowthOutsideY,
        tickCurrent,
        globalFeeGrowthX,
        globalFeeGrowthY
      )
      expect(result[0]).toBe(15_0000000000000000000000000000n)
      expect(result[1]).toBe(15_0000000000000000000000000000n)
    })

    test('sqrt price below ticks', async () => {
      //                      ───────fee_outside_t0──────────>
      //                     |fee_growth_inside| fee_outside_t1
      // ─────── c ─────── t0 ──────────────> t1 ───────────>
      // fee_growth_inside = t0.fee_outside - t1.fee_outside

      const tickCurrent = -4n

      // current tick below range
      // current  lower       upper
      // |        |           |
      // -4       2           2

      const result = await calculateFeeGrowthInside(
        clamm,
        tickLowerIndex,
        tickLowerFeeGrowthOutsideX,
        tickLowerFeeGrowthOutsideY,
        tickUpperIndex,
        tickUpperFeeGrowthOutsideX,
        tickUpperFeeGrowthOutsideY,
        tickCurrent,
        globalFeeGrowthX,
        globalFeeGrowthY
      )

      expect(result[0]).toBe(0n)
      expect(result[1]).toBe(0n)
    })

    test('sqrt price above ticks', async () => {
      // <──────────fee_outside_t0──────────
      // fee_outside_t1  | fee_growth_inside|
      // ────────────── t1 ──────────────── t0 ─────── c ───────────>
      // fee_growth_inside = t0.fee_outside - t1.fee_outside

      const tickCurrent = 3n

      // current tick upper range
      // lower    upper       current
      // |        |           |
      // -2       2           4

      const result = await calculateFeeGrowthInside(
        clamm,
        tickLowerIndex,
        tickLowerFeeGrowthOutsideX,
        tickLowerFeeGrowthOutsideY,
        tickUpperIndex,
        tickUpperFeeGrowthOutsideX,
        tickUpperFeeGrowthOutsideY,
        tickCurrent,
        globalFeeGrowthX,
        globalFeeGrowthY
      )

      expect(result[0]).toBe(0n)
      expect(result[1]).toBe(0n)
    })

    test('sqrt price above ticks, liquidity outside upper tick', async () => {
      const tickCurrent = 3n

      const tickUpperFeeGrowthOutsideX = 1n as FeeGrowth
      const tickUpperFeeGrowthOutsideY = 2n as FeeGrowth

      const globalFeeGrowthX = toFeeGrowth(5n)
      const globalFeeGrowthY = toFeeGrowth(5n)

      // current tick upper range
      // lower    upper       current
      // |        |           |
      // -2       2           3

      const result = await calculateFeeGrowthInside(
        clamm,
        tickLowerIndex,
        tickLowerFeeGrowthOutsideX,
        tickLowerFeeGrowthOutsideY,
        tickUpperIndex,
        tickUpperFeeGrowthOutsideX,
        tickUpperFeeGrowthOutsideY,
        tickCurrent,
        globalFeeGrowthX,
        globalFeeGrowthY
      )

      expect(result[0]).toBe(1n)
      expect(result[1]).toBe(2n)
    })

    test('sqrt price in between ticks, liquidity outside upper tick', async () => {
      const tickCurrent = 0n

      const tickUpperFeeGrowthOutsideX = toFeeGrowth(2n)
      const tickUpperFeeGrowthOutsideY = toFeeGrowth(3n)

      // current tick inside range
      // lower    current     upper
      // |        |           |
      // -2       0           2

      const result = await calculateFeeGrowthInside(
        clamm,
        tickLowerIndex,
        tickLowerFeeGrowthOutsideX,
        tickLowerFeeGrowthOutsideY,
        tickUpperIndex,
        tickUpperFeeGrowthOutsideX,
        tickUpperFeeGrowthOutsideY,
        tickCurrent,
        globalFeeGrowthX,
        globalFeeGrowthY
      )

      expect(result[0]).toBe(13_0000000000000000000000000000n)
      expect(result[1]).toBe(12_0000000000000000000000000000n)
    })

    test('sqrt price in between ticks, liquidity outside lower tick', async () => {
      const tickCurrent = 0n

      const tickLowerFeeGrowthOutsideX = toFeeGrowth(2n)
      const tickLowerFeeGrowthOutsideY = toFeeGrowth(3n)

      // current tick inside range
      // lower    current     upper
      // |        |           |
      // -2       0           2

      const result = await calculateFeeGrowthInside(
        clamm,
        tickLowerIndex,
        tickLowerFeeGrowthOutsideX,
        tickLowerFeeGrowthOutsideY,
        tickUpperIndex,
        tickUpperFeeGrowthOutsideX,
        tickUpperFeeGrowthOutsideY,
        tickCurrent,
        globalFeeGrowthX,
        globalFeeGrowthY
      )

      expect(result[0]).toBe(13_0000000000000000000000000000n)
      expect(result[1]).toBe(12_0000000000000000000000000000n)
    })
  })

  describe('calculate fee growth inside - domain', () => {
    let clamm: CLAMMInstance

    const tickCurrent = 0n
    const globalFeeGrowthX = toFeeGrowth(20n)
    const globalFeeGrowthY = toFeeGrowth(20n)

    const tickLowerIndex = -20n
    const tickLowerFeeGrowthOutsideX = toFeeGrowth(20n)
    const tickLowerFeeGrowthOutsideY = toFeeGrowth(20n)

    const tickUpperIndex = -10n
    const tickUpperFeeGrowthOutsideX = toFeeGrowth(15n)
    const tickUpperFeeGrowthOutsideY = toFeeGrowth(15n)

    beforeEach(async () => {
      clamm = await deployCLAMM(sender)
    })

    test('max fee growth', async () => {
      const result = await calculateFeeGrowthInside(
        clamm,
        tickLowerIndex,
        tickLowerFeeGrowthOutsideX,
        tickLowerFeeGrowthOutsideY,
        tickUpperIndex,
        tickUpperFeeGrowthOutsideX,
        tickUpperFeeGrowthOutsideY,
        tickCurrent,
        globalFeeGrowthX,
        globalFeeGrowthY
      )

      expect(result[0]).toBe(2n ** 256n - 1n - 5_0000000000000000000000000000n + 1n)
      expect(result[1]).toBe(2n ** 256n - 1n - 5_0000000000000000000000000000n + 1n)
    })
  })

  test('calculate sqrt price', async () => {
    const clamm = await deployCLAMM(sender)
    {
      const sqrtPrice = await calculateSqrtPrice(clamm, 30n)
      expect(sqrtPrice).toEqual(1001501050455136530035005n)
    }
    {
      const sqrtPrice = await calculateSqrtPrice(clamm, 20n)
      expect(sqrtPrice).toEqual(1001000450120021002520210n)
    }
    {
      const sqrtPrice = await calculateSqrtPrice(clamm, 10n)
      expect(sqrtPrice).toEqual(1000500100010000500010000n)
    }
    {
      const sqrtPrice = await calculateSqrtPrice(clamm, 0n)
      expect(sqrtPrice).toEqual(1000000000000000000000000n)
    }
    {
      const sqrtPrice = await calculateSqrtPrice(clamm, -10n)
      expect(sqrtPrice).toEqual(999500149965006998740209n)
    }
    {
      const params = { args: { tickIndex: -20n } }
      const sqrtPrice = await calculateSqrtPrice(clamm, -20n)
      expect(sqrtPrice).toEqual(999000549780071479985003n)
    }
    {
      const params = { args: { tickIndex: -30n } }
      const sqrtPrice = await calculateSqrtPrice(clamm, -30n)

      expect(sqrtPrice).toEqual(998501199320305883758749n)
    }
    {
      const result = await calculateSqrtPrice(clamm, 20_000n)
      expect(result).toBe(2_718145926825224864037656n)
    }
    {
      const result = await calculateSqrtPrice(clamm, 200_000n)
      expect(result).toBe(22015_456048552198645701365772n)
    }
    {
      const result = await calculateSqrtPrice(clamm, -20_000n)
      expect(result).toBe(367897834377123709894002n)
    }
    {
      const result = await calculateSqrtPrice(clamm, -200_000n)
      expect(result).toBe(45422633889328990341n)
    }
    {
      const result = await calculateSqrtPrice(clamm, 221_818n)
      expect(result).toBe(65535_384161610681941078870693n)
    }
    {
      const result = await calculateSqrtPrice(clamm, -221_818n)
      expect(result).toBe(15258932449895975601n)
    }
    {
      const result = await calculateSqrtPrice(clamm, GLOBAL_MAX_TICK)
      expect(result).toBe(MAX_SQRT_PRICE)
    }
    {
      const result = await calculateSqrtPrice(clamm, GLOBAL_MIN_TICK)
      expect(result).toBe(MIN_SQRT_PRICE)
    }
  })

  describe('calculate amount delta', () => {
    let clamm: CLAMMInstance

    beforeEach(async () => {
      clamm = await deployCLAMM(sender)
    })

    test('current tick between lower tick and upper tick', async () => {
      const currentTickIndex = 2n
      const currentSqrtPrice = 1_000140000000000000000000n as SqrtPrice
      const liquidityDelta = toLiquidity(5000000n)
      const liquiditySign = true
      const upperTick = 3n
      const lowerTick = 0n

      const result = await calculateAmountDelta(
        clamm,
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

      const result = await calculateAmountDelta(
        clamm,
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

      const result = await calculateAmountDelta(
        clamm,
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

      const result = await calculateAmountDelta(
        clamm,
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

  describe('calculate amount delta - domain', () => {
    let clamm: CLAMMInstance

    beforeEach(async () => {
      clamm = await deployCLAMM(sender)
    })

    test('max x', async () => {
      const currentTickIndex = GLOBAL_MIN_TICK
      const currentSqrtPrice = toSqrtPrice(1n)
      const liquidityDelta =
        14894636928365657818617562894966478347089917844485661564914997061885569n as Liquidity
      const liquiditySign = true
      const upperTick = GLOBAL_MAX_TICK
      const lowerTick = GLOBAL_MIN_TICK + 1n

      const result = await calculateAmountDelta(
        clamm,
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

      const result = await calculateAmountDelta(
        clamm,
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

      const result = await calculateAmountDelta(
        clamm,
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

      await expectError(
        CLAMMError.InvalidTickIndex,
        calculateAmountDelta(
          clamm,
          currentTickIndex,
          currentSqrtPrice,
          liquidityDelta,
          liquiditySign,
          upperTick,
          lowerTick
        ),
        clamm
      )
    })

    test('all max', async () => {
      const currentTickIndex = 0n
      const currentSqrtPrice = MAX_U256 as SqrtPrice
      const liquidityDelta = MAX_U256 as Liquidity
      const liquiditySign = true
      const upperTick = GLOBAL_MAX_TICK
      const lowerTick = GLOBAL_MIN_TICK

      await expectVMError(
        VMError.ArithmeticError,
        calculateAmountDelta(
          clamm,
          currentTickIndex,
          currentSqrtPrice,
          liquidityDelta,
          liquiditySign,
          upperTick,
          lowerTick
        )
      )
    })
  })

  describe('get next sqrt price x up', () => {
    let clamm: CLAMMInstance

    beforeEach(async () => {
      clamm = await deployCLAMM(sender)
    })

    test('add 1', async () => {
      const startingSqrtPrice = toSqrtPrice(1n)
      const liquidity = toLiquidity(1n)
      const x = 1n as TokenAmount

      const result = await getNextSqrtPriceXUp(clamm, startingSqrtPrice, liquidity, x, true)
      expect(result).toEqual(500000000000000000000000n)
    })

    test('add 2', async () => {
      const startingSqrtPrice = toSqrtPrice(1n)
      const liquidity = toLiquidity(2n)
      const x = 3n as TokenAmount

      const result = await getNextSqrtPriceXUp(clamm, startingSqrtPrice, liquidity, x, true)
      expect(result).toEqual(400000000000000000000000n)
    })

    test('add 3', async () => {
      const startingSqrtPrice = toSqrtPrice(2n)
      const liquidity = toLiquidity(3n)
      const x = 5n as TokenAmount

      const result = await getNextSqrtPriceXUp(clamm, startingSqrtPrice, liquidity, x, true)
      expect(result).toEqual(461538461538461538461539n)
    })

    test('add 4', async () => {
      const startingSqrtPrice = toSqrtPrice(24234n)
      const liquidity = toLiquidity(3000n)
      const x = 5000n as TokenAmount

      const result = await getNextSqrtPriceXUp(clamm, startingSqrtPrice, liquidity, x, true)
      expect(result).toEqual(599985145205615112277488n)
    })

    test('sub 1', async () => {
      const startingSqrtPrice = toSqrtPrice(1n)
      const liquidity = toLiquidity(2n)
      const x = 1n as TokenAmount

      const result = await getNextSqrtPriceXUp(clamm, startingSqrtPrice, liquidity, x, false)
      expect(result).toEqual(2_000000000000000000000000n)
    })

    test('sub 2', async () => {
      const startingSqrtPrice = toSqrtPrice(100000n)
      const liquidity = toLiquidity(500000000n)
      const x = 4000n as TokenAmount

      const result = await getNextSqrtPriceXUp(clamm, startingSqrtPrice, liquidity, x, false)
      expect(result).toEqual(500000_000000000000000000000000n)
    })

    test('sub 3', async () => {
      const startingSqrtPrice = 3_333333333333333333333333n as SqrtPrice
      const liquidity = 222_22222n as Liquidity
      const x = 37n as TokenAmount

      const result = await getNextSqrtPriceXUp(clamm, startingSqrtPrice, liquidity, x, false)
      expect(result).toEqual(7490636797542399944773031n)
    })
  })

  describe('get next sqrt price x up - domain', () => {
    let clamm: CLAMMInstance
    const maxLiquidity = MAX_U256 as Liquidity
    const minLiquidity = 1n as Liquidity
    const maxX = MAX_U256 as TokenAmount
    const minX = 1n as TokenAmount
    const almostMinSqrtPrice = (MIN_SQRT_PRICE + 1n) as SqrtPrice
    const almostMaxSqrtPrice = (MAX_SQRT_PRICE - 1n) as SqrtPrice

    beforeEach(async () => {
      clamm = await deployCLAMM(sender)
    })

    test('min value inside domain / increases min sqrt price', async () => {
      const params = {
        startingSqrtPrice: MIN_SQRT_PRICE,
        liquidity: maxLiquidity,
        x: 600000000n as TokenAmount,
        addX: false
      }

      const result = await getNextSqrtPriceXUp(
        clamm,
        params.startingSqrtPrice,
        params.liquidity,
        params.x,
        params.addX
      )
      expect(result).toEqual(MIN_SQRT_PRICE + 1n)
    })

    test('min value inside domain / decreases almost min sqrt price', async () => {
      const params = {
        startingSqrtPrice: almostMinSqrtPrice,
        liquidity: maxLiquidity,
        x: ((2n ** 128n - 1n) * 2n ** 111n) as TokenAmount,
        addX: true
      }
      const result = await getNextSqrtPriceXUp(
        clamm,
        params.startingSqrtPrice,
        params.liquidity,
        params.x,
        params.addX
      )
      expect(result).toEqual(MIN_SQRT_PRICE)
    })

    test('max value inside domain / decreases max sqrt price', async () => {
      const params = {
        startingSqrtPrice: MAX_SQRT_PRICE,
        liquidity: maxLiquidity,
        x: (2n ** 81n) as TokenAmount,
        addX: true
      }
      const result = await getNextSqrtPriceXUp(
        clamm,
        params.startingSqrtPrice,
        params.liquidity,
        params.x,
        params.addX
      )
      expect(result).toEqual(almostMaxSqrtPrice)
    })

    test('max value inside domain / increases almost max sqrt price', async () => {
      const params = {
        startingSqrtPrice: almostMaxSqrtPrice,
        liquidity: maxLiquidity,
        x: (2n ** 64n - 1n) as TokenAmount,
        addX: false
      }
      const result = await getNextSqrtPriceXUp(
        clamm,
        params.startingSqrtPrice,
        params.liquidity,
        params.x,
        params.addX
      )
      expect(result).toEqual(MAX_SQRT_PRICE)
    })

    test('all max', async () => {
      const params = {
        startingSqrtPrice: MAX_SQRT_PRICE,
        liquidity: maxLiquidity,
        x: maxX,
        addX: true
      }
      const result = await getNextSqrtPriceXUp(
        clamm,
        params.startingSqrtPrice,
        params.liquidity,
        params.x,
        params.addX
      )
      expect(result).toEqual(9999999999999999872n)
    })

    test('subtraction underflow', async () => {
      const params = {
        startingSqrtPrice: MAX_SQRT_PRICE,
        liquidity: minLiquidity,
        x: maxX,
        addX: false
      }
      await expectVMError(
        VMError.ArithmeticError,
        getNextSqrtPriceXUp(
          clamm,
          params.startingSqrtPrice,
          params.liquidity,
          params.x,
          params.addX
        )
      )
    })

    test('max possible result test', async () => {
      const params = {
        startingSqrtPrice: MAX_SQRT_PRICE,
        liquidity: maxLiquidity,
        x: minX,
        addX: true
      }
      const result = await getNextSqrtPriceXUp(
        clamm,
        params.startingSqrtPrice,
        params.liquidity,
        params.x,
        params.addX
      )
      expect(result).toEqual(MAX_SQRT_PRICE)
    })

    test('liquidity is zero', async () => {
      const params = {
        startingSqrtPrice: MAX_SQRT_PRICE,
        liquidity: 0n as Liquidity,
        x: minX,
        addX: true
      }
      const result = await getNextSqrtPriceXUp(
        clamm,
        params.startingSqrtPrice,
        params.liquidity,
        params.x,
        params.addX
      )
      expect(result).toEqual(0n)
    })

    test('amount is zero', async () => {
      const params = {
        startingSqrtPrice: MAX_SQRT_PRICE,
        liquidity: maxLiquidity,
        x: 0n as TokenAmount,
        addX: true
      }
      const result = await getNextSqrtPriceXUp(
        clamm,
        params.startingSqrtPrice,
        params.liquidity,
        params.x,
        params.addX
      )
      expect(result).toEqual(MAX_SQRT_PRICE)
    })
  })

  describe('next sqrt price from input - domain', () => {
    let clamm: CLAMMInstance
    const maxLiquidity = MAX_U256 as Liquidity
    const minLiquidity = 1n as Liquidity
    const maxAmount = MAX_U256 as TokenAmount
    const almostMaxSqrtPrice = (MAX_SQRT_PRICE - 1n) as SqrtPrice
    const almostMinSqrtPrice = (MIN_SQRT_PRICE + 1n) as SqrtPrice

    beforeEach(async () => {
      clamm = await deployCLAMM(sender)
    })

    test('max result, increase sqrt_price case', async () => {
      const params = {
        startingSqrtPrice: almostMaxSqrtPrice,
        liquidity: maxLiquidity,
        amount: ((2n ** 128n - 1n) * 10n ** 10n) as TokenAmount,
        xToY: false
      }
      const result = await getNextSqrtPriceFromInput(
        clamm,
        params.startingSqrtPrice,
        params.liquidity,
        params.amount,
        params.xToY
      )
      expect(result).toEqual(MAX_SQRT_PRICE + 1n)
    })

    test('min result, decrease sqrt_price case', async () => {
      const params = {
        startingSqrtPrice: almostMinSqrtPrice,
        liquidity: maxLiquidity,
        amount: ((2n ** 128n - 1n) * 2n ** 111n) as TokenAmount,
        xToY: true
      }
      const result = await getNextSqrtPriceFromInput(
        clamm,
        params.startingSqrtPrice,
        params.liquidity,
        params.amount,
        params.xToY
      )
      expect(result).toEqual(MIN_SQRT_PRICE)
    })

    test('amount = 0', async () => {
      const params = {
        startingSqrtPrice: MIN_SQRT_PRICE,
        liquidity: maxLiquidity,
        amount: 0n as TokenAmount,
        xToY: true
      }
      const result = await getNextSqrtPriceFromInput(
        clamm,
        params.startingSqrtPrice,
        params.liquidity,
        params.amount,
        params.xToY
      )
      expect(result).toEqual(MIN_SQRT_PRICE)
    })

    test('liquidity = 0', async () => {
      const params = {
        startingSqrtPrice: MIN_SQRT_PRICE,
        liquidity: 0n as Liquidity,
        amount: 20n as TokenAmount,
        xToY: true
      }
      const result = await getNextSqrtPriceFromInput(
        clamm,
        params.startingSqrtPrice,
        params.liquidity,
        params.amount,
        params.xToY
      )
      expect(result).toEqual(0n)
    })

    test('error handling', async () => {
      const params = {
        startingSqrtPrice: MAX_SQRT_PRICE,
        liquidity: minLiquidity,
        amount: maxAmount,
        xToY: false
      }
      await expectError(
        ArithmeticError.CastOverflow,
        getNextSqrtPriceFromInput(
          clamm,
          params.startingSqrtPrice,
          params.liquidity,
          params.amount,
          params.xToY
        ),
        clamm
      )
    })
  })

  describe('next sqrt price from output - domain', () => {
    let clamm: CLAMMInstance
    const maxLiquidity = MAX_U256 as Liquidity
    const minLiquidity = 1n as Liquidity
    const maxAmount = MAX_U256 as TokenAmount

    const almostMaxSqrtPrice = (MAX_SQRT_PRICE - 1n) as SqrtPrice
    const almostMinSqrtPrice = (MIN_SQRT_PRICE + 1n) as SqrtPrice

    beforeEach(async () => {
      clamm = await deployCLAMM(sender)
    })

    test('max result, increase sqrt_price case', async () => {
      const params = {
        startingSqrtPrice: almostMaxSqrtPrice,
        liquidity: maxLiquidity,
        amount: 1n as TokenAmount,
        xToY: false
      }
      const result = await getNextSqrtPriceFromOutput(
        clamm,
        params.startingSqrtPrice,
        params.liquidity,
        params.amount,
        params.xToY
      )
      expect(result).toEqual(MAX_SQRT_PRICE)
    })

    test('min result, decrease sqrt_price case', async () => {
      const params = {
        startingSqrtPrice: almostMinSqrtPrice,
        liquidity: maxLiquidity,
        amount: 1n as TokenAmount,
        xToY: true
      }
      const result = await getNextSqrtPriceFromOutput(
        clamm,
        params.startingSqrtPrice,
        params.liquidity,
        params.amount,
        params.xToY
      )
      expect(result).toEqual(MIN_SQRT_PRICE)
    })

    test('amount = 0', async () => {
      const params = {
        startingSqrtPrice: MIN_SQRT_PRICE,
        liquidity: maxLiquidity,
        amount: 0n as TokenAmount,
        xToY: true
      }
      const result = await getNextSqrtPriceFromOutput(
        clamm,
        params.startingSqrtPrice,
        params.liquidity,
        params.amount,
        params.xToY
      )
      expect(result).toEqual(MIN_SQRT_PRICE)
    })

    test('liquidity = 0', async () => {
      const params = {
        startingSqrtPrice: MIN_SQRT_PRICE,
        liquidity: 0n as Liquidity,
        amount: 20n as TokenAmount,
        xToY: true
      }
      await expectError(
        ArithmeticError.DivNotPositiveDivisor,
        getNextSqrtPriceFromOutput(
          clamm,
          params.startingSqrtPrice,
          params.liquidity,
          params.amount,
          params.xToY
        ),
        clamm
      )
    })

    test('error handling', async () => {
      const params = {
        startingSqrtPrice: MAX_SQRT_PRICE,
        liquidity: minLiquidity,
        amount: maxAmount,
        xToY: false
      }
      await expectVMError(
        VMError.ArithmeticError,
        getNextSqrtPriceFromOutput(
          clamm,
          params.startingSqrtPrice,
          params.liquidity,
          params.amount,
          params.xToY
        )
      )
    })
  })

  describe('compute swap step', () => {
    let clamm: CLAMMInstance

    beforeEach(async () => {
      clamm = await deployCLAMM(sender)
    })

    test('one token by amount in', async () => {
      const currentSqrtPrice = toSqrtPrice(1n)
      const targetSqrtPrice = 1_004987562112089027021926n as SqrtPrice
      const liquidity = toLiquidity(2000n)
      const amount = 1n as TokenAmount
      const fee = 600000000n as Percentage

      const result = await computeSwapStep(
        clamm,
        currentSqrtPrice,
        targetSqrtPrice,
        liquidity,
        amount,
        true,
        fee
      )
      expect(result).toEqual({
        nextSqrtPrice: currentSqrtPrice,
        amountIn: 0n,
        amountOut: 0n,
        feeAmount: 1n
      })
    })

    test('amount out capped at target sqrt price', async () => {
      const currentSqrtPrice = toSqrtPrice(1n)
      const targetSqrtPrice = 1_004987562112089027021926n as SqrtPrice
      const liquidity = toLiquidity(2000n)
      const amount = 20n as TokenAmount
      const fee = 600000000n as Percentage

      const resultIn = await computeSwapStep(
        clamm,
        currentSqrtPrice,
        targetSqrtPrice,
        liquidity,
        amount,
        true,
        fee
      )
      const resultOut = await computeSwapStep(
        clamm,
        currentSqrtPrice,
        targetSqrtPrice,
        liquidity,
        amount,
        false,
        fee
      )
      expect(resultIn).toEqual({
        nextSqrtPrice: targetSqrtPrice,
        amountIn: 10n,
        amountOut: 9n,
        feeAmount: 1n
      })
      expect(resultOut).toEqual({
        nextSqrtPrice: targetSqrtPrice,
        amountIn: 10n,
        amountOut: 9n,
        feeAmount: 1n
      })
    })

    test('amount in not capped', async () => {
      const currentSqrtPrice = 1_010000000000000000000000n as SqrtPrice
      const targetSqrtPrice = toSqrtPrice(10n)
      const liquidity = toLiquidity(300000000n)
      const amount = 1000000n as TokenAmount
      const fee = 600000000n as Percentage

      const result = await computeSwapStep(
        clamm,
        currentSqrtPrice,
        targetSqrtPrice,
        liquidity,
        amount,
        true,
        fee
      )
      expect(result).toEqual({
        nextSqrtPrice: 1_013331333333333333333333n,
        amountIn: 999400n,
        amountOut: 976487n,
        feeAmount: 600n
      })
    })

    test('amount out not capped', async () => {
      const currentSqrtPrice = toSqrtPrice(101n)
      const targetSqrtPrice = toSqrtPrice(100n)
      const liquidity = toLiquidity(5000000000000n)
      const amount = 2000000n as TokenAmount
      const fee = 600000000n as Percentage

      const result = await computeSwapStep(
        clamm,
        currentSqrtPrice,
        targetSqrtPrice,
        liquidity,
        amount,
        false,
        fee
      )
      expect(result).toEqual({
        nextSqrtPrice: 100_999999600000000000000000n,
        amountIn: 197n,
        amountOut: amount,
        feeAmount: 1n
      })
    })

    test('empty swap step when sqrt price is at tick', async () => {
      const currentSqrtPrice = 999500149965000000000000n as SqrtPrice
      const targetSqrtPrice = 999500149965000000000000n as SqrtPrice
      const liquidity = toLiquidity(200060000n)
      const amount = 1000000n as TokenAmount
      const fee = 600000000n as Percentage

      const result = await computeSwapStep(
        clamm,
        currentSqrtPrice,
        targetSqrtPrice,
        liquidity,
        amount,
        true,
        fee
      )
      expect(result).toEqual({
        nextSqrtPrice: currentSqrtPrice,
        amountIn: 0n,
        amountOut: 0n,
        feeAmount: 0n
      })
    })

    test('if liquidity is high, small amount in should not push sqrt price', async () => {
      const currentSqrtPrice = 999500149965000000000000n as SqrtPrice
      const targetSqrtPrice = 1_999500149965000000000000n as SqrtPrice
      const liquidity = toLiquidity(100000000000000000000000000n)
      const amount = 10n as TokenAmount
      const fee = 600000000n as Percentage

      const result = await computeSwapStep(
        clamm,
        currentSqrtPrice,
        targetSqrtPrice,
        liquidity,
        amount,
        true,
        fee
      )
      expect(result).toEqual({
        nextSqrtPrice: currentSqrtPrice,
        amountIn: 0n,
        amountOut: 0n,
        feeAmount: 10n
      })
    })

    test('amount in > u64 for swap to target sqrt price and when liquidity > 2^64', async () => {
      const currentSqrtPrice = toSqrtPrice(1n)
      const targetSqrtPrice = 1_000050000000000000000000n as SqrtPrice
      const liquidity = toLiquidity(368944000000000000000000n)
      const amount = 1n as TokenAmount
      const fee = 600000000n as Percentage

      const result = await computeSwapStep(
        clamm,
        currentSqrtPrice,
        targetSqrtPrice,
        liquidity,
        amount,
        true,
        fee
      )
      expect(result).toEqual({
        nextSqrtPrice: currentSqrtPrice,
        amountIn: 0n,
        amountOut: 0n,
        feeAmount: 1n
      })
    })

    test('amount out > u64 for swap to target sqrt price and when liquidity > 2^64', async () => {
      const currentSqrtPrice = toSqrtPrice(1n)
      const targetSqrtPrice = 1_000050000000000000000000n as SqrtPrice
      const liquidity = toLiquidity(368944000000000000000000n)
      const amount = 1n as TokenAmount
      const fee = 600000000n as Percentage

      const result = await computeSwapStep(
        clamm,
        currentSqrtPrice,
        targetSqrtPrice,
        liquidity,
        amount,
        false,
        fee
      )
      expect(result).toEqual({
        nextSqrtPrice: 1_000000000000000000000003n,
        amountIn: 2n,
        amountOut: 1n,
        feeAmount: 1n
      })
    })

    test('liquidity is zero and by amount in should skip to target sqrt price', async () => {
      const currentSqrtPrice = toSqrtPrice(1n)
      const targetSqrtPrice = 1_000050000000000000000000n as SqrtPrice
      const liquidity = 0n as Liquidity
      const amount = 100000n as TokenAmount
      const fee = 600000000n as Percentage

      const resultIn = await computeSwapStep(
        clamm,
        currentSqrtPrice,
        targetSqrtPrice,
        liquidity,
        amount,
        true,
        fee
      )
      const resultOut = await computeSwapStep(
        clamm,
        currentSqrtPrice,
        targetSqrtPrice,
        liquidity,
        amount,
        false,
        fee
      )
      expect(resultIn).toEqual({
        nextSqrtPrice: targetSqrtPrice,
        amountIn: 0n,
        amountOut: 0n,
        feeAmount: 0n
      })
      expect(resultOut).toEqual({
        nextSqrtPrice: targetSqrtPrice,
        amountIn: 0n,
        amountOut: 0n,
        feeAmount: 0n
      })
    })

    test('normal swap step but fee is set to 0', async () => {
      const currentSqrtPrice = 999950000000000000000000n as SqrtPrice
      const targetSqrtPrice = toSqrtPrice(1n)
      const liquidity = toLiquidity(50000000n)
      const amount = 1000n as TokenAmount
      const fee = 0n as Percentage

      const result = await computeSwapStep(
        clamm,
        currentSqrtPrice,
        targetSqrtPrice,
        liquidity,
        amount,
        true,
        fee
      )
      expect(result).toEqual({
        nextSqrtPrice: 999970000000000000000000n,
        amountIn: 1000n,
        amountOut: 1000n,
        feeAmount: 0n
      })
    })

    test('by amount out and x to y edge cases', async () => {
      const tickIndex = -10n
      const targetSqrtPrice = await calculateSqrtPrice(clamm, tickIndex)
      const currentSqrtPrice = (targetSqrtPrice + toSqrtPrice(1n)) as SqrtPrice
      const liquidity = toLiquidity(340282366920938463463374607n)
      const oneToken = 1n as TokenAmount
      const tokensWithSameOutput = 85n as TokenAmount
      const zeroToken = 0n as TokenAmount
      const maxFee = 900000000000n as Percentage
      const minFee = 0n as Percentage

      const oneTokenResult = await computeSwapStep(
        clamm,
        currentSqrtPrice,
        targetSqrtPrice,
        liquidity,
        oneToken,
        false,
        maxFee
      )
      const tokensWithSameOutputResult = await computeSwapStep(
        clamm,
        currentSqrtPrice,
        targetSqrtPrice,
        liquidity,
        tokensWithSameOutput,
        false,
        maxFee
      )
      const zeroTokenResult = await computeSwapStep(
        clamm,
        currentSqrtPrice,
        targetSqrtPrice,
        liquidity,
        zeroToken,
        false,
        minFee
      )
      expect(oneTokenResult).toEqual({
        nextSqrtPrice: currentSqrtPrice - 1n,
        amountIn: 86n,
        amountOut: 1n,
        feeAmount: 78n
      })
      expect(tokensWithSameOutputResult).toEqual({
        nextSqrtPrice: currentSqrtPrice - 1n,
        amountIn: 86n,
        amountOut: 85n,
        feeAmount: 78n
      })
      expect(zeroTokenResult).toEqual({
        nextSqrtPrice: currentSqrtPrice,
        amountIn: 0n,
        amountOut: 0n,
        feeAmount: 0n
      })
    })
  })

  describe('compute swap step - domain', () => {
    let clamm: CLAMMInstance

    const oneSqrtPrice = toSqrtPrice(1n)
    const twoSqrtPrice = toSqrtPrice(2n)
    const oneLiquidity = toLiquidity(1n)
    const maxLiquidity = MAX_U256 as Liquidity
    const maxAmount = MAX_U256 as TokenAmount
    const maxAmountNotReachedTargetSqrtPrice = (MAX_U256 - 1n) as TokenAmount
    const maxFee = toPercentage(1n)
    const minFee = 0n as Percentage

    beforeEach(async () => {
      clamm = await deployCLAMM(sender)
    })

    test('100% fee | max amount', async () => {
      const params = {
        currentSqrtPrice: oneSqrtPrice,
        targetSqrtPrice: twoSqrtPrice,
        liquidity: oneLiquidity,
        amount: maxAmount,
        byAmountIn: true,
        fee: maxFee
      }
      const result = await computeSwapStep(
        clamm,
        params.currentSqrtPrice,
        params.targetSqrtPrice,
        params.liquidity,
        params.amount,
        params.byAmountIn,
        params.fee
      )
      expect(result).toEqual({
        nextSqrtPrice: 1_000000000000000000000000n,
        amountIn: 0n,
        amountOut: 0n,
        feeAmount: maxAmount
      })
    })

    test('0% fee | max amount | max liquidity | sqrt price slice', async () => {
      const params = {
        currentSqrtPrice: oneSqrtPrice,
        targetSqrtPrice: twoSqrtPrice,
        liquidity: maxLiquidity,
        amount: maxAmount,
        byAmountIn: true,
        fee: minFee
      }
      const result = await computeSwapStep(
        clamm,
        params.currentSqrtPrice,
        params.targetSqrtPrice,
        params.liquidity,
        params.amount,
        params.byAmountIn,
        params.fee
      )
      expect(result).toEqual({
        nextSqrtPrice: 2_000000000000000000000000n,
        amountIn: 1157920892373161954235709850086879078532699846656405640394575840079131297n,
        amountOut: 578960446186580977117854925043439539266349923328202820197287920039565648n,
        feeAmount: 0n
      })
    })

    test('by amount in == true || close to target sqrt price but not reached', async () => {
      const bigLiquidity = 100000000000000_00000n as Liquidity
      const amountPushingSqrtPriceToTarget = 100000000000000n as TokenAmount

      const params = {
        currentSqrtPrice: oneSqrtPrice,
        targetSqrtPrice: twoSqrtPrice,
        liquidity: bigLiquidity,
        amount: (amountPushingSqrtPriceToTarget - 1n) as TokenAmount,
        byAmountIn: true,
        fee: minFee
      }
      const result = await computeSwapStep(
        clamm,
        params.currentSqrtPrice,
        params.targetSqrtPrice,
        params.liquidity,
        params.amount,
        params.byAmountIn,
        params.fee
      )
      expect(result).toEqual({
        nextSqrtPrice: 1_999999999999990000000000n,
        amountIn: 99999999999999n,
        amountOut: 49999999999999n,
        feeAmount: 0n
      })
    })

    test('maximize fee amount || close to target sqrt price but not reached', async () => {
      const params = {
        currentSqrtPrice: oneSqrtPrice,
        targetSqrtPrice: twoSqrtPrice,
        liquidity: maxLiquidity,
        amount: MAX_U256 as TokenAmount,
        byAmountIn: true,
        fee: (maxFee - 19n) as Percentage
      }
      const result = await computeSwapStep(
        clamm,
        params.currentSqrtPrice,
        params.targetSqrtPrice,
        params.liquidity,
        params.amount,
        params.byAmountIn,
        params.fee
      )
      expect(result).toEqual({
        nextSqrtPrice: 10_00001899999999999999999n,
        amountIn: 2200049695509007711889927822791908294976419858560291638216994249494n,
        amountOut: 2200045515422528409085952759527180615861658807361317178894970210709n,
        feeAmount: 115792089235116145728061977296797980030478076370664144180897292369696135390441n
      })
    })

    test('get next sqrt price from input -> get next sqrt price x up', async () => {
      const params = {
        currentSqrtPrice: MAX_SQRT_PRICE,
        targetSqrtPrice: MIN_SQRT_PRICE,
        liquidity:
          14893892252372018684584396344694974244327977275368655982357119807809415n as Liquidity,
        amount: maxAmountNotReachedTargetSqrtPrice,
        byAmountIn: true,
        fee: minFee
      }
      const result = await computeSwapStep(
        clamm,
        params.currentSqrtPrice,
        params.targetSqrtPrice,
        params.liquidity,
        params.amount,
        params.byAmountIn,
        params.fee
      )
      expect(result).toEqual({
        nextSqrtPrice: MIN_SQRT_PRICE,
        amountIn: 115792089237316195423570985008687907853269984665640564039457584007913127186298n,
        amountOut: 115792089237273489678171488614551827950927273765573549347385441617238758671171n,
        feeAmount: 0n
      })
    })

    test('get next sqrt price from input -> get next sqrt price y down / scale', async () => {
      const params = {
        currentSqrtPrice: MIN_SQRT_PRICE,
        targetSqrtPrice: MAX_SQRT_PRICE,
        liquidity:
          14893892252372018684584411238587226621839738068399339794075395228890515n as Liquidity,
        amount: maxAmountNotReachedTargetSqrtPrice,
        byAmountIn: true,
        fee: minFee
      }
      const result = await computeSwapStep(
        clamm,
        params.currentSqrtPrice,
        params.targetSqrtPrice,
        params.liquidity,
        params.amount,
        params.byAmountIn,
        params.fee
      )

      expect(result).toEqual({
        nextSqrtPrice: MAX_SQRT_PRICE,
        amountIn: 115792089237273489678171604406641065267122697336558558035293294887223422058656n,
        amountOut: 115792089237316195423570985008687907853269984665640564039457584007913124933217n,
        feeAmount: 0n
      })
    })

    test('get next sqrt price from input -> get next sqrt price y down / big div - no possible to trigger from compute swap step', async () => {
      const minOverflowTokenAmount = 340282366920939n as TokenAmount
      const params = {
        currentSqrtPrice: MIN_SQRT_PRICE,
        targetSqrtPrice: MAX_SQRT_PRICE,
        liquidity: (oneLiquidity - 1n) as Liquidity,
        amount: (minOverflowTokenAmount - 1n) as TokenAmount,
        byAmountIn: true,
        fee: minFee
      }

      const result = await computeSwapStep(
        clamm,
        params.currentSqrtPrice,
        params.targetSqrtPrice,
        params.liquidity,
        params.amount,
        params.byAmountIn,
        params.fee
      )
      expect(result).toEqual({
        nextSqrtPrice: MAX_SQRT_PRICE,
        amountIn: 777439029062n,
        amountOut: 777439029062n,
        feeAmount: 0n
      })
    })

    test('get next sqrt price from output -> get next sqrt price x up / min sqrt price different at maximum amount', async () => {
      const minDiff = 232826265438719159684n
      const params = {
        currentSqrtPrice: (MAX_SQRT_PRICE - minDiff) as SqrtPrice,
        targetSqrtPrice: MAX_SQRT_PRICE,
        liquidity: maxLiquidity,
        amount: (MAX_U256 - 1n) as TokenAmount,
        byAmountIn: false,
        fee: minFee
      }
      const result = await computeSwapStep(
        clamm,
        params.currentSqrtPrice,
        params.targetSqrtPrice,
        params.liquidity,
        params.amount,
        params.byAmountIn,
        params.fee
      )
      expect(result).toEqual({
        nextSqrtPrice: MAX_SQRT_PRICE,
        amountIn: 269594397044712364927302271135767871256767389391069984018896158734608n,
        amountOut: 446035573781064836058621344013922633754231023n,
        feeAmount: 0n
      })
    })

    test('get next sqrt price from output -> get next sqrt price x up / min sqrt price different at maximum amount', async () => {
      const params = {
        currentSqrtPrice: MIN_SQRT_PRICE,
        targetSqrtPrice: MAX_SQRT_PRICE,
        liquidity: 281477613507675_00000n as Liquidity,
        amount: (MAX_U256 - 1n) as TokenAmount,
        byAmountIn: false,
        fee: minFee
      }
      const result = await computeSwapStep(
        clamm,
        params.currentSqrtPrice,
        params.targetSqrtPrice,
        params.liquidity,
        params.amount,
        params.byAmountIn,
        params.fee
      )
      expect(result).toEqual({
        nextSqrtPrice: MAX_SQRT_PRICE,
        amountIn: 218833870886803958855620056n,
        amountOut: 218833870886884667854278009n,
        feeAmount: 0n
      })
    })

    test('get next sqrt price from output -> get next sqrt price x up / min token change', async () => {
      const params = {
        currentSqrtPrice: 9873007294522358128427212253744918n as SqrtPrice,
        targetSqrtPrice: MAX_SQRT_PRICE,
        liquidity: toLiquidity(10000000000n),
        amount: 1n as TokenAmount,
        byAmountIn: false,
        fee: minFee
      }
      const result = await computeSwapStep(
        clamm,
        params.currentSqrtPrice,
        params.targetSqrtPrice,
        params.liquidity,
        params.amount,
        params.byAmountIn,
        params.fee
      )
      expect(result).toEqual({
        nextSqrtPrice: MAX_SQRT_PRICE,
        amountIn: 7675737962355106071345n,
        amountOut: 1n,
        feeAmount: 0n
      })
    })

    test('get next sqrt price from output -> get next sqrt price x up / max amount out, by amount in == false', async () => {
      const params = {
        currentSqrtPrice: MAX_SQRT_PRICE,
        targetSqrtPrice: MIN_SQRT_PRICE,
        liquidity:
          14893892252372018684584396344694974244327977275368655982357119807809415n as Liquidity,
        amount: maxAmount,
        byAmountIn: false,
        fee: minFee
      }

      const result = await computeSwapStep(
        clamm,
        params.currentSqrtPrice,
        params.targetSqrtPrice,
        params.liquidity,
        params.amount,
        params.byAmountIn,
        params.fee
      )
      expect(result).toEqual({
        nextSqrtPrice: MIN_SQRT_PRICE,
        amountIn: 115792089237316195423570985008687907853269984665640564039457584007913127186298n,
        amountOut: 115792089237273489678171488614551827950927273765573549347385441617238758671171n,
        feeAmount: 0n
      })
    })
  })
})
