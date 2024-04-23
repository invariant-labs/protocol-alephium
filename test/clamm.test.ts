import { DeployContractResult, ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { CLAMMInstance } from '../artifacts/ts'
import { MaxTick, MaxU256, deployCLAMM, deployUints, expectError } from '../src/utils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let sender: PrivateKeyWallet

describe('math tests', () => {
  beforeAll(async () => {
    sender = await getSigner(ONE_ALPH * 100000n, 0)
  })

  test('fee growth from fee', async () => {
    const uints = await deployUints(sender)
    const clamm = await deployCLAMM(sender, uints.contractInstance.contractId)
    {
      const liquidity = 10n ** 5n
      const amount = 1n
      const result = (await clamm.contractInstance.methods.feeGrowthFromFee({ args: { liquidity, fee: amount } }))
        .returns
      expect(result).toStrictEqual(10000000000000000000000000000n)
    }
    {
      const liquidity = 2n * 10n ** 5n
      const amount = 1n
      const result = (await clamm.contractInstance.methods.feeGrowthFromFee({ args: { liquidity, fee: amount } }))
        .returns
      expect(result).toStrictEqual(5n * 10n ** 27n)
    }
    {
      const liquidity = ((1n << 64n) - 1n) * 10n ** 5n
      const amount = 1n
      const result = (await clamm.contractInstance.methods.feeGrowthFromFee({ args: { liquidity, fee: amount } }))
        .returns
      expect(result).toStrictEqual(542101086n)
    }
    {
      const liquidity = 100n * 10n ** 5n
      const amount = 1000000n
      const result = (await clamm.contractInstance.methods.feeGrowthFromFee({ args: { liquidity, fee: amount } }))
        .returns
      expect(result).toStrictEqual(10000n * 10n ** 28n)
    }
  })
  test('fee growth from fee - domain', async () => {
    const uints = await deployUints(sender)
    const clamm = await deployCLAMM(sender, uints.contractInstance.contractId)

    const liquidityDenominator = 10n ** 5n
    const sqrtPriceDenominator = 10n ** 24n
    const feeGrowthDenominator = 10n ** 28n
    // max FeeGrowth case inside of domain
    {
      const maxTickSpacing = 100n
      const tickSearchRange = 256n
      const sqrtPriceUpper = 65535383934512647000000000000n
      const sqrtPriceLowerIndex = 221818n - maxTickSpacing * tickSearchRange
      const sqrtPriceLower = (
        await clamm.contractInstance.methods.calculateSqrtPrice({ args: { tickIndex: sqrtPriceLowerIndex } })
      ).returns

      const maxDeltaSqrtPrice = sqrtPriceUpper - sqrtPriceLower
      const maxLiquidity = (1n << 256n) - 1n
      const maxToken = (maxLiquidity * maxDeltaSqrtPrice) / liquidityDenominator / sqrtPriceDenominator
      const feeGrowth = (
        await clamm.contractInstance.methods.feeGrowthFromFee({ args: { liquidity: maxLiquidity, fee: maxToken } })
      ).returns
      expect(feeGrowth).toStrictEqual(473129365723326089999999999999999n)
    }
    // min FeeGrowth case inside of domain
    {
      const basisPoint = 10000n
      const minToken = 1n
      const maxLiquidity = minToken * feeGrowthDenominator * liquidityDenominator * basisPoint
      const feeGrowth = (
        await clamm.contractInstance.methods.feeGrowthFromFee({
          args: { liquidity: maxLiquidity, fee: minToken + basisPoint }
        })
      ).returns
      expect(feeGrowth).toStrictEqual(1n)
    }
    // outside of domain trigger overflow due to result not fit into FeeGrowth
    {
      const liquidity = 1n
      const fee = (1n << 256n) - 1n

      await expectError(
        clamm.contractInstance.methods.feeGrowthFromFee({
          args: { liquidity, fee }
        })
      )
    }
    // amount = 0
    {
      const liquidity = 1000n * 10n ** 5n
      const fee = 0n
      const feeGrowth = (await clamm.contractInstance.methods.feeGrowthFromFee({ args: { liquidity, fee } })).returns
      expect(feeGrowth).toStrictEqual(0n)
    }
    // L = 0
    {
      const liquidity = 0n
      const fee = 1100n
      await expectError(clamm.contractInstance.methods.feeGrowthFromFee({ args: { liquidity, fee } }))
    }
  })
  test('fee growth to fee', async () => {
    const uints = await deployUints(sender)
    const clamm = await deployCLAMM(sender, uints.contractInstance.contractId)
    // Equal
    {
      const amount = 100n
      const liquidity = 1000000n * 10n ** 5n
      const params = { args: { liquidity, fee: amount } }
      const feeGrowth = (await clamm.contractInstance.methods.feeGrowthFromFee(params)).returns
      const outParams = { args: { liquidity, feeGrowth: feeGrowth } }
      const out = (await clamm.contractInstance.methods.toFee(outParams)).returns
      expect(out).toStrictEqual(100n)
    }
    // Greater Liquidity
    {
      const amount = 100n
      const liquidityBefore = 1000000n * 10n ** 5n
      const liquidityAfter = 10000000n * 10n ** 5n
      const params = { args: { liquidity: liquidityBefore, fee: amount } }
      const feeGrowth = (await clamm.contractInstance.methods.feeGrowthFromFee(params)).returns
      const outParams = { args: { liquidity: liquidityAfter, feeGrowth } }
      const out = (await clamm.contractInstance.methods.toFee(outParams)).returns
      expect(out).toStrictEqual(1000n)
    }
    // huge liquidity
    {
      const amount = 100000000000000n
      const liquidity = (1n << 77n) * 10n ** 5n
      const params = { args: { liquidity, fee: amount } }
      const feeGrowth = (await clamm.contractInstance.methods.feeGrowthFromFee(params)).returns
      // real    6.61744490042422139897126953655970282852649688720703125 × 10^-10
      // expected 6617444900424221398
      expect(feeGrowth).toStrictEqual(6617444900424221398n)
      const outParams = { args: { liquidity, feeGrowth } }
      const out = (await clamm.contractInstance.methods.toFee(outParams)).returns
      // real    9.99999999999999999853225897430980027744256 × 10^13
      // expected 99999999999999
      expect(out).toStrictEqual(99_999_999_999_999n)
    }
  })
  test('fee growth to fee - domain', async () => {
    const uints = await deployUints(sender)
    const clamm = await deployCLAMM(sender, uints.contractInstance.contractId)
    // overflowing mul
    {
      const amount = 600000000000000000n
      const liquidity = 10000000000000000000n * 10n ** 5n
      const params = { args: { liquidity, fee: amount } }
      const feeGrowth = (await clamm.contractInstance.methods.feeGrowthFromFee(params)).returns
      expect(feeGrowth).toStrictEqual(600000000000000000000000000n)
      const outParams = { args: { liquidity, feeGrowth } }
      const out = (await clamm.contractInstance.methods.toFee(outParams)).returns
      expect(out).toStrictEqual(600000000000000000n)
    }
    // max value inside domain
    {
      const liquidity = (1n << 256n) - 1n
      const feeGrowth = 100000n * 10n ** 28n
      const out = (await clamm.contractInstance.methods.toFee({ args: { liquidity, feeGrowth } })).returns
      expect(out).toStrictEqual(115792089237316195423570985008687907853269984665640564039457584007913129639935n)
    }
    // Overflow
    {
      const liquidity = (1n << 256n) - 1n
      const feeGrowth = (1n << 256n) - 1n
      await expectError(clamm.contractInstance.methods.toFee({ args: { liquidity, feeGrowth } }))
    }
    // FeeGrowth = 0
    {
      const liquidity = 1000n * 10n ** 5n
      const feeGrowth = 0n
      const out = (await clamm.contractInstance.methods.toFee({ args: { liquidity, feeGrowth } })).returns
      expect(out).toStrictEqual(0n)
    }
    // Liquidity = 0
    {
      const liquidity = 0n
      const feeGrowth = 1000n * 10n ** 28n
      const out = (await clamm.contractInstance.methods.toFee({ args: { liquidity, feeGrowth } })).returns
      expect(out).toStrictEqual(0n)
    }
  })
  test('tick from sqrt price', async () => {
    const uints = await deployUints(sender)
    const clamm = await deployCLAMM(sender, uints.contractInstance.contractId)
    {
      const sqrtPrice = 999006987054867461743028n
      const result = (
        await clamm.contractInstance.methods.getTickAtSqrtPrice({ args: { sqrtPrice, tickSpacing: 10n } })
      ).returns
      expect(result).toBe(-20n)
    }
  })
  test('align tick to tickspacing', async () => {
    const uints = await deployUints(sender)
    const clamm = await deployCLAMM(sender, uints.contractInstance.contractId)
    {
      const accurateTick = 0n
      const tickSpacing = 3n
      const result = (await clamm.contractInstance.methods.alignTickToSpacing({ args: { accurateTick, tickSpacing } }))
        .returns
      expect(result).toBe(0n)
    }
    {
      const accurateTick = 14n
      const tickSpacing = 10n
      const result = (await clamm.contractInstance.methods.alignTickToSpacing({ args: { accurateTick, tickSpacing } }))
        .returns
      expect(result).toBe(10n)
    }
    {
      const accurateTick = 20n
      const tickSpacing = 10n
      const result = (await clamm.contractInstance.methods.alignTickToSpacing({ args: { accurateTick, tickSpacing } }))
        .returns
      expect(result).toBe(20n)
    }
    {
      const accurateTick = -14n
      const tickSpacing = 10n
      const result = (await clamm.contractInstance.methods.alignTickToSpacing({ args: { accurateTick, tickSpacing } }))
        .returns
      expect(result).toBe(-20n)
    }
    {
      const accurateTick = -21n
      const tickSpacing = 10n
      const result = (await clamm.contractInstance.methods.alignTickToSpacing({ args: { accurateTick, tickSpacing } }))
        .returns
      expect(result).toBe(-30n)
    }
    {
      const accurateTick = -120n
      const tickSpacing = 3n
      const result = (await clamm.contractInstance.methods.alignTickToSpacing({ args: { accurateTick, tickSpacing } }))
        .returns
      expect(result).toBe(-120n)
    }
  })
  test('log spacing over 1', async () => {
    const uints = await deployUints(sender)
    const clamm = await deployCLAMM(sender, uints.contractInstance.contractId)
    {
      for (let i = 0n; i < 100n; i++) {
        const sqrtPriceDecimal = (await clamm.contractInstance.methods.calculateSqrtPrice({ args: { tickIndex: i } }))
          .returns
        let tick = (
          await clamm.contractInstance.methods.getTickAtSqrtPrice({
            args: { sqrtPrice: sqrtPriceDecimal, tickSpacing: 3n }
          })
        ).returns
        let expectedTick = (
          await clamm.contractInstance.methods.alignTickToSpacing({ args: { accurateTick: i, tickSpacing: 3n } })
        ).returns
        expect(tick).toEqual(expectedTick)
      }
    }
    {
      for (let i = -100n; i < 0; i++) {
        const sqrtPriceDecimal = (await clamm.contractInstance.methods.calculateSqrtPrice({ args: { tickIndex: i } }))
          .returns
        let tick = (
          await clamm.contractInstance.methods.getTickAtSqrtPrice({
            args: { sqrtPrice: sqrtPriceDecimal, tickSpacing: 3n }
          })
        ).returns
        let expectedTick = (
          await clamm.contractInstance.methods.alignTickToSpacing({ args: { accurateTick: i, tickSpacing: 3n } })
        ).returns
        expect(tick).toEqual(expectedTick)
      }
    }
  })
  test('log', async () => {
    const uints = await deployUints(sender)
    const clamm = await deployCLAMM(sender, uints.contractInstance.contractId)
    {
      for (let i = 0n; i < 100n; i++) {
        const sqrtPriceDecimal = (await clamm.contractInstance.methods.calculateSqrtPrice({ args: { tickIndex: i } }))
          .returns
        let tick = (
          await clamm.contractInstance.methods.getTickAtSqrtPrice({
            args: { sqrtPrice: sqrtPriceDecimal, tickSpacing: 1n }
          })
        ).returns
        expect(tick).toEqual(i)
      }
    }
    {
      for (let i = -100n; i < 0; i++) {
        const sqrtPriceDecimal = (await clamm.contractInstance.methods.calculateSqrtPrice({ args: { tickIndex: i } }))
          .returns
        let tick = (
          await clamm.contractInstance.methods.getTickAtSqrtPrice({
            args: { sqrtPrice: sqrtPriceDecimal, tickSpacing: 1n }
          })
        ).returns
        expect(tick).toEqual(i)
      }
    }
  })

  describe('get delta x', () => {
    let clamm: DeployContractResult<CLAMMInstance>

    beforeAll(async () => {
      const uints = await deployUints(sender)
      clamm = await deployCLAMM(sender, uints.contractInstance.contractId)
    })
    test('zero at zero liquidity', async () => {
      const sqrtPriceA = 1n * 10n ** 24n
      const sqrtPriceB = 2n * 10n ** 24n
      const liquidity = 0n
      const paramsUp = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: true } }
      const paramsDown = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: false } }
      const resultUp = (await clamm.contractInstance.methods.getDeltaX(paramsUp)).returns
      const resultDown = (await clamm.contractInstance.methods.getDeltaX(paramsDown)).returns
      expect(resultUp).toEqual(0n)
      expect(resultDown).toEqual(0n)
    })
    test('equal at equal liquidity', async () => {
      const sqrtPriceA = 1n * 10n ** 24n
      const sqrtPriceB = 2n * 10n ** 24n
      const liquidity = 2n * 10n ** 5n
      const paramsUp = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: true } }
      const paramsDown = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: false } }
      const resultUp = (await clamm.contractInstance.methods.getDeltaX(paramsUp)).returns
      const resultDown = (await clamm.contractInstance.methods.getDeltaX(paramsDown)).returns
      expect(resultUp).toEqual(1n)
      expect(resultDown).toEqual(1n)
    })
    test('complex', async () => {
      const sqrtPriceA = 234878324943782000000000000n
      const sqrtPriceB = 87854456421658000000000000n
      const liquidity = 983983249092n
      const paramsUp = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: true } }
      const paramsDown = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: false } }
      const resultUp = (await clamm.contractInstance.methods.getDeltaX(paramsUp)).returns
      const resultDown = (await clamm.contractInstance.methods.getDeltaX(paramsDown)).returns
      // 7010.8199533068819376891841727789301497024557314488455622925765280
      expect(resultUp).toEqual(70109n)
      expect(resultDown).toEqual(70108n)
    })
    test('big', async () => {
      const sqrtPriceA = 1n * 10n ** 24n
      const sqrtPriceB = 5n * 10n ** 23n
      const liquidity = (2n ** 64n - 1n) * 10n ** 5n
      const paramsUp = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: true } }
      const paramsDown = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: false } }
      const resultUp = (await clamm.contractInstance.methods.getDeltaX(paramsUp)).returns
      const resultDown = (await clamm.contractInstance.methods.getDeltaX(paramsDown)).returns
      expect(resultUp).toEqual(2n ** 64n - 1n)
      expect(resultDown).toEqual(2n ** 64n - 1n)
    })
    test('shouldnt overflow in intermediate opeartions', async () => {
      const sqrtPriceA = 1n * 10n ** 24n
      const sqrtPriceB = 5n * 10n ** 23n
      const liquidity = (1n << 256n) - 1n
      const paramsUp = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: true } }
      const paramsDown = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: false } }
      await clamm.contractInstance.methods.getDeltaX(paramsUp)
      await clamm.contractInstance.methods.getDeltaX(paramsDown)
    })
    test('huge liquididty', async () => {
      const sqrtPriceA = 1n * 10n ** 24n
      const sqrtPriceB = 1n * 10n ** 24n + 1000000n
      const liquidity = (1n << 80n) * 10n ** 5n
      const paramsUp = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: true } }
      const paramsDown = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: false } }
      await clamm.contractInstance.methods.getDeltaX(paramsUp)
      await clamm.contractInstance.methods.getDeltaX(paramsDown)
    })
  })
  describe('get delta x - domain', () => {
    let clamm: DeployContractResult<CLAMMInstance>
    const maxSqrtPrice = 65535383934512647000000000000n
    const minSqrtPrice = 15258932000000000000n
    const almostMinSqrtPrice = 15259695000000000000n
    const maxLiquidity = (1n << 256n) - 1n
    const minLiquidity = 1n

    beforeAll(async () => {
      const uints = await deployUints(sender)
      clamm = await deployCLAMM(sender, uints.contractInstance.contractId)
    })
    test('maximalize delta sqrt price and liquidity', async () => {
      const params = {
        sqrtPriceA: maxSqrtPrice,
        sqrtPriceB: minSqrtPrice,
        liquidity: maxLiquidity
      }
      const paramsUp = { args: { ...params, roundingUp: true } }
      const paramsDown = { args: { ...params, roundingUp: false } }
      const resultUp = (await clamm.contractInstance.methods.getDeltaX(paramsUp)).returns
      const resultDown = (await clamm.contractInstance.methods.getDeltaX(paramsDown)).returns
      expect(resultUp).toEqual(75884792730156830614567103553061795263351065677581979504561495713443442818879n)
      expect(resultDown).toEqual(75884792730156830614567103553061795263351065677581979504561495713443442818878n)
    })
    test('maximalize delta sqrt price and minimalize liquidity', async () => {
      const params = {
        sqrtPriceA: maxSqrtPrice,
        sqrtPriceB: minSqrtPrice,
        liquidity: minLiquidity
      }
      const paramsUp = { args: { ...params, roundingUp: true } }
      const paramsDown = { args: { ...params, roundingUp: false } }
      const resultUp = (await clamm.contractInstance.methods.getDeltaX(paramsUp)).returns
      const resultDown = (await clamm.contractInstance.methods.getDeltaX(paramsDown)).returns
      expect(resultUp).toEqual(1n)
      expect(resultDown).toEqual(0n)
    })
    test('minimize denominator on maximize liquidity which fit into token amounts', async () => {
      const params = {
        sqrtPriceA: minSqrtPrice,
        sqrtPriceB: almostMinSqrtPrice,
        liquidity: maxLiquidity
      }
      const paramsUp = { args: { ...params, roundingUp: true } }
      const paramsDown = { args: { ...params, roundingUp: false } }
      const resultUp = (await clamm.contractInstance.methods.getDeltaX(paramsUp)).returns
      const resultDown = (await clamm.contractInstance.methods.getDeltaX(paramsDown)).returns
      expect(resultUp).toEqual(3794315473971847510172532341754979462199874072217062973965311338137066234n)
      expect(resultDown).toEqual(3794315473971847510172532341754979462199874072217062973965311338137066233n)
    })
    test('minimize denominator on minimize liquidity which fit into token amounts', async () => {
      const params = {
        sqrtPriceA: minSqrtPrice,
        sqrtPriceB: almostMinSqrtPrice,
        liquidity: minLiquidity
      }
      const paramsUp = { args: { ...params, roundingUp: true } }
      const paramsDown = { args: { ...params, roundingUp: false } }
      const resultUp = (await clamm.contractInstance.methods.getDeltaX(paramsUp)).returns
      const resultDown = (await clamm.contractInstance.methods.getDeltaX(paramsDown)).returns
      expect(resultUp).toEqual(1n)
      expect(resultDown).toEqual(0n)
    })
    test('delta price limited by search range on max liquidity', async () => {
      const searchLimit = 256n
      const tickSpacing = 100n
      const maxSearchLimit = 221818n - searchLimit * tickSpacing
      const minSearchSqrtPrice = (
        await clamm.contractInstance.methods.calculateSqrtPrice({
          args: { tickIndex: maxSearchLimit }
        })
      ).returns

      const params = {
        sqrtPriceA: maxSqrtPrice,
        sqrtPriceB: minSearchSqrtPrice,
        liquidity: maxLiquidity
      }
      const paramsUp = { args: { ...params, roundingUp: true } }
      const resultUp = (await clamm.contractInstance.methods.getDeltaX(paramsUp)).returns
      expect(resultUp).toEqual(45875017378130362421757891862614875858481775310156442203847653871247n)
    })
    test('minimal price diffrence', async () => {
      const almostMaxSqrtPrice = maxSqrtPrice - 1n * 10n ** 24n
      const almostMinSqrtPrice = minSqrtPrice + 1n * 10n ** 24n
      const paramsUpperBound = {
        args: { sqrtPriceA: maxSqrtPrice, sqrtPriceB: almostMaxSqrtPrice, liquidity: maxLiquidity, roundingUp: true }
      }
      const paramsBottomBound = {
        args: { sqrtPriceA: minSqrtPrice, sqrtPriceB: almostMinSqrtPrice, liquidity: maxLiquidity, roundingUp: true }
      }
      const resultUp = (await clamm.contractInstance.methods.getDeltaX(paramsUpperBound)).returns
      const resultDown = (await clamm.contractInstance.methods.getDeltaX(paramsBottomBound)).returns
      expect(resultUp).toEqual(269608649375997235557394191156352599353486422139915865816324471n)
      expect(resultDown).toEqual(75883634844601460750582416171430603974060896681619645705711819135499453546638n)
    })
    test('zero liquidity', async () => {
      const params = {
        sqrtPriceA: maxSqrtPrice,
        sqrtPriceB: minSqrtPrice,
        liquidity: 0n
      }
      const paramsUp = { args: { ...params, roundingUp: true } }
      const paramsDown = { args: { ...params, roundingUp: false } }
      const resultUp = (await clamm.contractInstance.methods.getDeltaX(paramsUp)).returns
      const resultDown = (await clamm.contractInstance.methods.getDeltaX(paramsDown)).returns
      expect(resultUp).toEqual(0n)
      expect(resultDown).toEqual(0n)
    })
  })

  describe('get delta y', () => {
    let clamm: CLAMMInstance

    beforeEach(async () => {
      const uints = await deployUints(sender)
      clamm = (await deployCLAMM(sender, uints.contractInstance.contractId)).contractInstance
    })

    test('zero at zero liquidity', async () => {
      const sqrtPriceA = 1_000000000000000000000000n
      const sqrtPriceB = 1_000000000000000000000000n
      const liquidity = 0n

      const params = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: false } }
      const result = await clamm.methods.getDeltaY(params)

      expect(result.returns).toEqual(0n)
    })

    test('equal at equal liquidity', async () => {
      const sqrtPriceA = 1_000000000000000000000000n
      const sqrtPriceB = 2_000000000000000000000000n
      const liquidity = 2_00000n

      const params = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: false } }
      const result = await clamm.methods.getDeltaY(params)

      expect(result.returns).toEqual(2n)
    })

    test('big numbers', async () => {
      const sqrtPriceA = 234_878324943782000000000000n
      const sqrtPriceB = 87_854456421658000000000000n
      const liquidity = 9839832_49092n

      const paramsUp = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: true } }
      const paramsDown = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: false } }
      const resultUp = await clamm.methods.getDeltaY(paramsUp)
      const resultDown = await clamm.methods.getDeltaY(paramsDown)

      expect(resultUp.returns).toEqual(1446690239n)
      expect(resultDown.returns).toEqual(1446690238n)
    })

    test('big', async () => {
      const sqrtPriceA = 1_000000000000000000000000n
      const sqrtPriceB = 2_000000000000000000000000n
      const liquidity = (2n ** 64n - 1n) * 1_00000n

      const paramsUp = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: true } }
      const paramsDown = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: false } }
      const resultUp = await clamm.methods.getDeltaY(paramsUp)
      const resultDown = await clamm.methods.getDeltaY(paramsDown)

      expect(resultUp.returns).toEqual(liquidity / 1_00000n)
      expect(resultDown.returns).toEqual(liquidity / 1_00000n)
    })

    test('overflow', async () => {
      const sqrtPriceA = 1_000000000000000000000000n
      const sqrtPriceB = 2n ** 256n - 1n
      const liquidity = 2n ** 256n - 1n

      const paramsUp = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: true } }
      const paramsDown = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: false } }
      await expectError(clamm.methods.getDeltaY(paramsUp))
      await expectError(clamm.methods.getDeltaY(paramsDown))
    })

    test('huge liquidity', async () => {
      const sqrtPriceA = 1_000000000000000000000000n
      const sqrtPriceB = 1_000000000000000001000000n
      const liquidity = 2n ** 256n - 1n

      const paramsUp = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: true } }
      const paramsDown = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: false } }
      const resultUp = await clamm.methods.getDeltaY(paramsUp)
      const resultDown = await clamm.methods.getDeltaY(paramsDown)

      expect(resultUp.returns).toStrictEqual(1157920892373161954235709850086879078532699846656405641n)
      expect(resultDown.returns).toStrictEqual(1157920892373161954235709850086879078532699846656405640n)
    })
  })

  describe('get delta y - domain', () => {
    let clamm: CLAMMInstance
    const minSqrtPrice = 15258932000000000000n
    const maxSqrtPrice = 65535_383934512647000000000000n
    const minLiquidity = 1n
    const maxLiquidity = 2n ** 256n - 1n

    beforeEach(async () => {
      const uints = await deployUints(sender)
      clamm = (await deployCLAMM(sender, uints.contractInstance.contractId)).contractInstance
    })

    it('maximize delta sqrt price and liquidity', async () => {
      const paramsUp = {
        args: { sqrtPriceA: maxSqrtPrice, sqrtPriceB: minSqrtPrice, liquidity: maxLiquidity, roundingUp: true }
      }
      const paramsDown = {
        args: { sqrtPriceA: maxSqrtPrice, sqrtPriceB: minSqrtPrice, liquidity: maxLiquidity, roundingUp: false }
      }
      const resultUp = await clamm.methods.getDeltaY(paramsUp)
      const resultDown = await clamm.methods.getDeltaY(paramsDown)

      expect(resultUp.returns).toStrictEqual(
        75884790229800029582010010030152469040784228171629896065450012281800526658806n
      )
      expect(resultDown.returns).toStrictEqual(
        75884790229800029582010010030152469040784228171629896065450012281800526658805n
      )
    })

    it('can be zero', async () => {
      const params = {
        args: { sqrtPriceA: maxSqrtPrice, sqrtPriceB: maxSqrtPrice - 1n, liquidity: minLiquidity, roundingUp: false }
      }
      const result = await clamm.methods.getDeltaY(params)

      expect(result.returns).toStrictEqual(0n)
    })

    it('liquidity is zero', async () => {
      const params = {
        args: { sqrtPriceA: maxSqrtPrice, sqrtPriceB: minSqrtPrice, liquidity: 0n, roundingUp: true }
      }
      const result = await clamm.methods.getDeltaY(params)

      expect(result.returns).toStrictEqual(0n)
    })

    it('all max', async () => {
      const params = {
        args: { sqrtPriceA: maxSqrtPrice, sqrtPriceB: maxSqrtPrice, liquidity: maxLiquidity, roundingUp: true }
      }
      const result = await clamm.methods.getDeltaY(params)

      expect(result.returns).toStrictEqual(0n)
    })
  })

  test('get next sqrt price y down - base samples', async () => {
    const uints = await deployUints(sender)
    const clamm = await deployCLAMM(sender, uints.contractInstance.contractId)

    const sqrtPriceDenominator = 10n ** 24n
    const liquidityDenominator = 10n ** 5n
    {
      const startingSqrtPrice = 1n * sqrtPriceDenominator
      const liquidity = 1n * liquidityDenominator
      const y = 1n
      const params = { args: { startingSqrtPrice, liquidity, y, addY: true } }
      const nextSqrtPrice = (await clamm.contractInstance.methods.getNextSqrtPriceYDown(params)).returns
      expect(nextSqrtPrice).toEqual(2n * sqrtPriceDenominator)
    }
    {
      const startingSqrtPrice = 1n * sqrtPriceDenominator
      const liquidity = 2n * liquidityDenominator
      const y = 3n
      const params = { args: { startingSqrtPrice, liquidity, y, addY: true } }
      const nextSqrtPrice = (await clamm.contractInstance.methods.getNextSqrtPriceYDown(params)).returns
      expect(nextSqrtPrice).toEqual(25n * 10n ** 23n)
    }
    {
      const startingSqrtPrice = 2n * sqrtPriceDenominator
      const liquidity = 3n * liquidityDenominator
      const y = 5n
      const params = { args: { startingSqrtPrice, liquidity, y, addY: true } }
      const nextSqrtPrice = (await clamm.contractInstance.methods.getNextSqrtPriceYDown(params)).returns
      expect(nextSqrtPrice).toEqual((11n * sqrtPriceDenominator) / 3n)
    }
    {
      const startingSqrtPrice = 24234n * sqrtPriceDenominator
      const liquidity = 3000n * liquidityDenominator
      const y = 5000n
      const params = { args: { startingSqrtPrice, liquidity, y, addY: true } }
      const nextSqrtPrice = (await clamm.contractInstance.methods.getNextSqrtPriceYDown(params)).returns
      expect(nextSqrtPrice).toEqual((72707n * sqrtPriceDenominator) / 3n)
    }
    {
      const startingSqrtPrice = 1n * sqrtPriceDenominator
      const liquidity = 2n * liquidityDenominator
      const y = 1n
      const params = { args: { startingSqrtPrice, liquidity, y, addY: false } }
      const nextSqrtPrice = (await clamm.contractInstance.methods.getNextSqrtPriceYDown(params)).returns
      expect(nextSqrtPrice).toEqual(5n * 10n ** 23n)
    }
    {
      const startingSqrtPrice = 100000n * sqrtPriceDenominator
      const liquidity = 500000000n * liquidityDenominator
      const y = 4000n
      const params = { args: { startingSqrtPrice, liquidity, y, addY: false } }
      const nextSqrtPrice = (await clamm.contractInstance.methods.getNextSqrtPriceYDown(params)).returns
      expect(nextSqrtPrice).toEqual(99999999992000000000000000000n)
    }
    {
      const startingSqrtPrice = 3n * sqrtPriceDenominator
      const liquidity = 222n * liquidityDenominator
      const y = 37n
      const params = { args: { startingSqrtPrice, liquidity, y, addY: false } }
      const nextSqrtPrice = (await clamm.contractInstance.methods.getNextSqrtPriceYDown(params)).returns
      expect(nextSqrtPrice).toEqual(2833333333333333333333333n)
    }
  })
  test('get next sqrt price y down - domain', async () => {
    const uints = await deployUints(sender)
    const clamm = await deployCLAMM(sender, uints.contractInstance.contractId)

    const minY = 1n
    const maxY = (1n << 256n) - 1n
    const maxSqrtPrice = 65535383934512647000000000000n
    const minSqrtPrice = 15258932000000000000n
    const almostMinSqrtPrice = minSqrtPrice + 1n
    const almostMaxSqrtPrice = maxSqrtPrice - 1n
    const minSqrtPriceOutsideDomain = 1n
    const minLiquidity = 1n
    const maxLiquidity = (1n << 256n) - 1n
    const minOverflowTokenY = 115792089237316195423570985008687907853269984665575031n
    const oneLiquidity = 1n * 10n ** 5n

    // Min value inside domain
    {
      // increases minSqrtPrice
      {
        const params = {
          args: {
            startingSqrtPrice: minSqrtPrice,
            liquidity: maxLiquidity,
            y: minY + (1n << 128n) * (1n << 32n),
            addY: true
          }
        }
        const nextSqrtPrice = (await clamm.contractInstance.methods.getNextSqrtPriceYDown(params)).returns
        expect(nextSqrtPrice).toEqual(15258932000000000001n)
      }
      // decreases almostMinSqrtPrice
      {
        const params = {
          args: {
            startingSqrtPrice: almostMinSqrtPrice,
            liquidity: maxLiquidity,
            y: minY,
            addY: false
          }
        }
        const nextSqrtPrice = (await clamm.contractInstance.methods.getNextSqrtPriceYDown(params)).returns
        expect(nextSqrtPrice).toEqual(15258932000000000000n)
      }
    }
    // Max value inside domain
    {
      // decreases maxSqrtPrice
      {
        const params = {
          args: {
            startingSqrtPrice: maxSqrtPrice,
            liquidity: maxLiquidity,
            y: minY + (1n << 128n) * (1n << 32n),
            addY: false
          }
        }
        const nextSqrtPrice = (await clamm.contractInstance.methods.getNextSqrtPriceYDown(params)).returns
        expect(nextSqrtPrice).toEqual(65535383934512646999999999998n)
      }
      // increases almostMaxSqrtPrice
      {
        const params = {
          args: {
            startingSqrtPrice: almostMaxSqrtPrice,
            liquidity: maxLiquidity,
            y: minY + 600000000n,
            addY: true
          }
        }
        const nextSqrtPrice = (await clamm.contractInstance.methods.getNextSqrtPriceYDown(params)).returns
        expect(nextSqrtPrice).toEqual(65535383934512646999999999999n)
      }
    }
    // Extension TokenAmount to SqrtPrice decimal overflow
    {
      {
        const params = {
          args: {
            startingSqrtPrice: maxSqrtPrice,
            liquidity: minLiquidity,
            y: maxY,
            addY: true
          }
        }
        await expectError(clamm.contractInstance.methods.getNextSqrtPriceYDown(params))
      }
      {
        const params = {
          args: {
            startingSqrtPrice: minSqrtPriceOutsideDomain,
            liquidity: minLiquidity,
            y: maxY,
            addY: false
          }
        }
        await expectError(clamm.contractInstance.methods.getNextSqrtPriceYDown(params))
      }
    }
    // Overflow in SqrtPrice Diffrence
    {
      {
        const params = {
          args: {
            startingSqrtPrice: maxSqrtPrice,
            liquidity: oneLiquidity,
            y: minOverflowTokenY - 2n,
            addY: true
          }
        }

        await expectError(clamm.contractInstance.methods.getNextSqrtPriceYDown(params))
      }
      {
        const params = {
          args: {
            startingSqrtPrice: minSqrtPriceOutsideDomain,
            liquidity: oneLiquidity,
            y: minOverflowTokenY - 2n,
            addY: false
          }
        }
        await expectError(clamm.contractInstance.methods.getNextSqrtPriceYDown(params))
      }
    }
    // Quotient overflow
    {
      const minYOverflowDecimalExtension = 1n << 225n
      const irrelevantSqrtPrice = 1n
      const irrelevantLiquidity = oneLiquidity
      {
        const params = {
          args: {
            startingSqrtPrice: irrelevantSqrtPrice,
            liquidity: irrelevantLiquidity,
            y: minYOverflowDecimalExtension,
            addY: true
          }
        }
        await expectError(clamm.contractInstance.methods.getNextSqrtPriceYDown(params))
      }
      {
        const params = {
          args: {
            startingSqrtPrice: irrelevantSqrtPrice,
            liquidity: irrelevantLiquidity,
            y: minYOverflowDecimalExtension,
            addY: false
          }
        }
        await expectError(clamm.contractInstance.methods.getNextSqrtPriceYDown(params))
      }
    }
    // Y max
    {
      const params = {
        args: {
          startingSqrtPrice: minSqrtPrice,
          liquidity: maxLiquidity,
          y: maxY,
          addY: true
        }
      }
      const nextSqrtPrice = (await clamm.contractInstance.methods.getNextSqrtPriceYDown(params)).returns
      expect(nextSqrtPrice).toEqual(100000000015258932000000000000n)
    }
    // L = 0
    {
      const params = {
        args: {
          startingSqrtPrice: minSqrtPrice,
          liquidity: 0n,
          y: minY,
          addY: true
        }
      }
      await expectError(clamm.contractInstance.methods.getNextSqrtPriceYDown(params))
    }
    // TokenAmount is zero
    {
      const params = {
        args: {
          startingSqrtPrice: minSqrtPrice,
          liquidity: maxLiquidity,
          y: 0n,
          addY: true
        }
      }
      const nextSqrtPrice = (await clamm.contractInstance.methods.getNextSqrtPriceYDown(params)).returns
      expect(nextSqrtPrice).toEqual(minSqrtPrice)
    }
  })

  test('calculate max liquidity per tick', async () => {
    const uints = await deployUints(sender)
    const clamm = await deployCLAMM(sender, uints.contractInstance.contractId)
    const params = { args: { tickSpacing: 1n } }
    const maxLiquidity = (await clamm.contractInstance.methods.calculateMaxLiquidityPerTick(params)).returns
    expect(maxLiquidity).toEqual(261006384132333857238172165551313140818439365214444611336425014162283870n)
  })
  test('calculate min amount out', async () => {
    const uints = await deployUints(sender)
    const clamm = await deployCLAMM(sender, uints.contractInstance.contractId)
    // 0% fee
    {
      const expectedAmountOut = 100n
      const slippage = 0n
      const params = { args: { expectedAmountOut, slippage } }
      const result = (await clamm.contractInstance.methods.calculateMinAmountOut(params)).returns
      expect(result).toEqual(100n)
    }
    // 0.1% fee
    {
      const expectedAmountOut = 100n
      const slippage = 10n ** 9n
      const params = { args: { expectedAmountOut, slippage } }
      const result = (await clamm.contractInstance.methods.calculateMinAmountOut(params)).returns
      expect(result).toEqual(100n)
    }
    // 0.9% fee
    {
      const expectedAmountOut = 123n
      const slippage = 9n * 10n ** 9n
      const params = { args: { expectedAmountOut, slippage } }
      const result = (await clamm.contractInstance.methods.calculateMinAmountOut(params)).returns
      expect(result).toEqual(122n)
    }
    // 1% fee
    {
      const expectedAmountOut = 100n
      const slippage = 10n ** 10n
      const params = { args: { expectedAmountOut, slippage } }
      const result = (await clamm.contractInstance.methods.calculateMinAmountOut(params)).returns
      expect(result).toEqual(99n)
    }
    // 3% fee
    {
      const expectedAmountOut = 100n
      const slippage = 3n * 10n ** 10n
      const params = { args: { expectedAmountOut, slippage } }
      const result = (await clamm.contractInstance.methods.calculateMinAmountOut(params)).returns
      expect(result).toEqual(97n)
    }
    // 5% fee
    {
      const expectedAmountOut = 100n
      const slippage = 5n * 10n ** 10n
      const params = { args: { expectedAmountOut, slippage } }
      const result = (await clamm.contractInstance.methods.calculateMinAmountOut(params)).returns
      expect(result).toEqual(95n)
    }
    // 10% fee
    {
      const expectedAmountOut = 100n
      const slippage = 10n ** 11n
      const params = { args: { expectedAmountOut, slippage } }
      const result = (await clamm.contractInstance.methods.calculateMinAmountOut(params)).returns
      expect(result).toEqual(90n)
    }
    // 20% fee
    {
      const expectedAmountOut = 100n
      const slippage = 2n * 10n ** 11n
      const params = { args: { expectedAmountOut, slippage } }
      const result = (await clamm.contractInstance.methods.calculateMinAmountOut(params)).returns
      expect(result).toEqual(80n)
    }
    // 50% fee
    {
      const expectedAmountOut = 100n
      const slippage = 5n * 10n ** 11n
      const params = { args: { expectedAmountOut, slippage } }
      const result = (await clamm.contractInstance.methods.calculateMinAmountOut(params)).returns
      expect(result).toEqual(50n)
    }
    // 100% fee
    {
      const expectedAmountOut = 100n
      const slippage = 10n ** 12n
      const params = { args: { expectedAmountOut, slippage } }
      const result = (await clamm.contractInstance.methods.calculateMinAmountOut(params)).returns
      expect(result).toEqual(0n)
    }
  })

  test('calculate min amount out - domain', async () => {
    const uints = await deployUints(sender)
    const clamm = await deployCLAMM(sender, uints.contractInstance.contractId)
    const minAmount = 0n
    const maxAmount = (1n << 256n) - 1n
    const minFee = 0n
    const maxFee = 10n ** 12n
    // min amount min fee
    {
      const params = { args: { expectedAmountOut: minAmount, slippage: minFee } }
      const result = (await clamm.contractInstance.methods.calculateMinAmountOut(params)).returns
      expect(result).toEqual(0n)
    }
    // min amount max fee
    {
      const params = { args: { expectedAmountOut: minAmount, slippage: maxFee } }
      const result = (await clamm.contractInstance.methods.calculateMinAmountOut(params)).returns
      expect(result).toEqual(0n)
    }
    // max amount max fee
    {
      const params = { args: { expectedAmountOut: maxAmount, slippage: maxFee } }
      const result = (await clamm.contractInstance.methods.calculateMinAmountOut(params)).returns
      expect(result).toEqual(0n)
    }
    // max amount min fee
    {
      const params = { args: { expectedAmountOut: maxAmount, slippage: minFee } }
      const result = (await clamm.contractInstance.methods.calculateMinAmountOut(params)).returns
      expect(result).toEqual(maxAmount)
    }
  })

  test('is enough amount to change price - domain', async () => {
    const uints = await deployUints(sender)
    const clamm = await deployCLAMM(sender, uints.contractInstance.contractId)
    const zeroLiquidity = 0n
    const maxFee = 10n ** 12n
    const maxAmount = (1n << 256n) - 1n
    const minAmount = 1n
    const minLiquidity = 1n
    const maxSqrtPrice = 65535383934512647000000000000n
    const minFee = 0n
    // max fee
    {
      const params = {
        args: {
          amount: minAmount,
          startingSqrtPrice: maxSqrtPrice,
          liquidity: minLiquidity,
          fee: maxFee,
          byAmountIn: false,
          xToY: false
        }
      }
      await expectError(clamm.contractInstance.methods.isEnoughAmountToChangePrice(params))
    }
    // L = 0
    {
      const params = {
        args: {
          amount: maxAmount,
          startingSqrtPrice: maxSqrtPrice,
          liquidity: zeroLiquidity,
          fee: maxFee,
          byAmountIn: false,
          xToY: false
        }
      }
      const isEnough = (await clamm.contractInstance.methods.isEnoughAmountToChangePrice(params)).returns
      expect(isEnough).toBe(true)
    }
    // Min amount
    {
      const params = {
        args: {
          amount: minAmount,
          startingSqrtPrice: maxSqrtPrice,
          liquidity: minLiquidity,
          fee: minFee,
          byAmountIn: false,
          xToY: false
        }
      }
      await expectError(clamm.contractInstance.methods.isEnoughAmountToChangePrice(params))
    }
    // Max amount
    const params = {
      args: {
        amount: maxAmount,
        startingSqrtPrice: maxSqrtPrice,
        liquidity: minLiquidity,
        fee: minFee,
        byAmountIn: false,
        xToY: false
      }
    }
    await expectError(clamm.contractInstance.methods.isEnoughAmountToChangePrice(params))
  })

  describe('calculate fee growth inside', () => {
    let clamm: CLAMMInstance
    const globalFeeGrowthX = 15_0000000000000000000000000000n
    const globalFeeGrowthY = 15_0000000000000000000000000000n

    const tickLowerIndex = -2n
    const tickLowerFeeGrowthOutsideX = 0n
    const tickLowerFeeGrowthOutsideY = 0n

    const tickUpperIndex = 2n
    const tickUpperFeeGrowthOutsideX = 0n
    const tickUpperFeeGrowthOutsideY = 0n

    beforeEach(async () => {
      const uints = await deployUints(sender)
      clamm = (await deployCLAMM(sender, uints.contractInstance.contractId)).contractInstance
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

      const result = await clamm.methods.calculateFeeGrowthInside({
        args: {
          tickLowerIndex,
          tickLowerFeeGrowthOutsideX,
          tickLowerFeeGrowthOutsideY,
          tickUpperIndex,
          tickUpperFeeGrowthOutsideX,
          tickUpperFeeGrowthOutsideY,
          tickCurrent,
          globalFeeGrowthX,
          globalFeeGrowthY
        }
      })

      expect(result.returns[0]).toBe(15_0000000000000000000000000000n)
      expect(result.returns[1]).toBe(15_0000000000000000000000000000n)
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

      const result = await clamm.methods.calculateFeeGrowthInside({
        args: {
          tickLowerIndex,
          tickLowerFeeGrowthOutsideX,
          tickLowerFeeGrowthOutsideY,
          tickUpperIndex,
          tickUpperFeeGrowthOutsideX,
          tickUpperFeeGrowthOutsideY,
          tickCurrent,
          globalFeeGrowthX,
          globalFeeGrowthY
        }
      })

      expect(result.returns[0]).toBe(0n)
      expect(result.returns[1]).toBe(0n)
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

      const result = await clamm.methods.calculateFeeGrowthInside({
        args: {
          tickLowerIndex,
          tickLowerFeeGrowthOutsideX,
          tickLowerFeeGrowthOutsideY,
          tickUpperIndex,
          tickUpperFeeGrowthOutsideX,
          tickUpperFeeGrowthOutsideY,
          tickCurrent,
          globalFeeGrowthX,
          globalFeeGrowthY
        }
      })

      expect(result.returns[0]).toBe(0n)
      expect(result.returns[1]).toBe(0n)
    })

    test('sqrt price above ticks, liquidity outside upper tick', async () => {
      const tickCurrent = 3n

      const tickUpperFeeGrowthOutsideX = 1n
      const tickUpperFeeGrowthOutsideY = 2n

      const globalFeeGrowthX = 5_0000000000000000000000000000n
      const globalFeeGrowthY = 5_0000000000000000000000000000n

      // current tick upper range
      // lower    upper       current
      // |        |           |
      // -2       2           3

      const result = await clamm.methods.calculateFeeGrowthInside({
        args: {
          tickLowerIndex,
          tickLowerFeeGrowthOutsideX,
          tickLowerFeeGrowthOutsideY,
          tickUpperIndex,
          tickUpperFeeGrowthOutsideX,
          tickUpperFeeGrowthOutsideY,
          tickCurrent,
          globalFeeGrowthX,
          globalFeeGrowthY
        }
      })

      expect(result.returns[0]).toBe(1n)
      expect(result.returns[1]).toBe(2n)
    })

    test('sqrt price in between ticks, liquidity outside upper tick', async () => {
      const tickCurrent = 0n

      const tickUpperFeeGrowthOutsideX = 2_0000000000000000000000000000n
      const tickUpperFeeGrowthOutsideY = 3_0000000000000000000000000000n

      // current tick inside range
      // lower    current     upper
      // |        |           |
      // -2       0           2

      const result = await clamm.methods.calculateFeeGrowthInside({
        args: {
          tickLowerIndex,
          tickLowerFeeGrowthOutsideX,
          tickLowerFeeGrowthOutsideY,
          tickUpperIndex,
          tickUpperFeeGrowthOutsideX,
          tickUpperFeeGrowthOutsideY,
          tickCurrent,
          globalFeeGrowthX,
          globalFeeGrowthY
        }
      })

      expect(result.returns[0]).toBe(13_0000000000000000000000000000n)
      expect(result.returns[1]).toBe(12_0000000000000000000000000000n)
    })

    test('sqrt price in between ticks, liquidity outside lower tick', async () => {
      const tickCurrent = 0n

      const tickLowerFeeGrowthOutsideX = 2_0000000000000000000000000000n
      const tickLowerFeeGrowthOutsideY = 3_0000000000000000000000000000n

      // current tick inside range
      // lower    current     upper
      // |        |           |
      // -2       0           2

      const result = await clamm.methods.calculateFeeGrowthInside({
        args: {
          tickLowerIndex,
          tickLowerFeeGrowthOutsideX,
          tickLowerFeeGrowthOutsideY,
          tickUpperIndex,
          tickUpperFeeGrowthOutsideX,
          tickUpperFeeGrowthOutsideY,
          tickCurrent,
          globalFeeGrowthX,
          globalFeeGrowthY
        }
      })

      expect(result.returns[0]).toBe(13_0000000000000000000000000000n)
      expect(result.returns[1]).toBe(12_0000000000000000000000000000n)
    })
  })

  describe('calculate fee growth inside - domain', () => {
    let clamm: CLAMMInstance

    const tickCurrent = 0n
    const globalFeeGrowthX = 20_0000000000000000000000000000n
    const globalFeeGrowthY = 20_0000000000000000000000000000n

    const tickLowerIndex = -20n
    const tickLowerFeeGrowthOutsideX = 20_0000000000000000000000000000n
    const tickLowerFeeGrowthOutsideY = 20_0000000000000000000000000000n

    const tickUpperIndex = -10n
    const tickUpperFeeGrowthOutsideX = 15_0000000000000000000000000000n
    const tickUpperFeeGrowthOutsideY = 15_0000000000000000000000000000n

    beforeEach(async () => {
      const uints = await deployUints(sender)
      clamm = (await deployCLAMM(sender, uints.contractInstance.contractId)).contractInstance
    })

    test('max fee growth', async () => {
      const result = await clamm.methods.calculateFeeGrowthInside({
        args: {
          tickLowerIndex,
          tickLowerFeeGrowthOutsideX,
          tickLowerFeeGrowthOutsideY,
          tickUpperIndex,
          tickUpperFeeGrowthOutsideX,
          tickUpperFeeGrowthOutsideY,
          tickCurrent,
          globalFeeGrowthX,
          globalFeeGrowthY
        }
      })

      expect(result.returns[0]).toBe(2n ** 256n - 1n - 5_0000000000000000000000000000n + 1n)
      expect(result.returns[1]).toBe(2n ** 256n - 1n - 5_0000000000000000000000000000n + 1n)
    })
  })

  test('calculate sqrt price', async () => {
    const uints = await deployUints(sender)
    const clamm = (await deployCLAMM(sender, uints.contractInstance.contractId)).contractInstance
    {
      const params = { args: { tickIndex: 30n } }
      const sqrtPrice = (await clamm.methods.calculateSqrtPrice(params)).returns
      expect(sqrtPrice).toEqual(1001501050455000000000000n)
    }
    {
      const params = { args: { tickIndex: 20n } }
      const sqrtPrice = (await clamm.methods.calculateSqrtPrice(params)).returns
      expect(sqrtPrice).toEqual(1001000450120000000000000n)
    }
    {
      const params = { args: { tickIndex: 10n } }
      const sqrtPrice = (await clamm.methods.calculateSqrtPrice(params)).returns
      expect(sqrtPrice).toEqual(1000500100010000000000000n)
    }
    {
      const params = { args: { tickIndex: 0n } }
      const sqrtPrice = (await clamm.methods.calculateSqrtPrice(params)).returns
      expect(sqrtPrice).toEqual(1000000000000000000000000n)
    }
    {
      const params = { args: { tickIndex: -10n } }
      const sqrtPrice = (await clamm.methods.calculateSqrtPrice(params)).returns
      expect(sqrtPrice).toEqual(999500149965000000000000n)
    }
    {
      const params = { args: { tickIndex: -20n } }
      const sqrtPrice = (await clamm.methods.calculateSqrtPrice(params)).returns
      expect(sqrtPrice).toEqual(999000549780000000000000n)
    }
    {
      const params = { args: { tickIndex: -30n } }
      const sqrtPrice = (await clamm.methods.calculateSqrtPrice(params)).returns
      expect(sqrtPrice).toEqual(998501199320000000000000n)
    }
    {
      const result = await clamm.methods.calculateSqrtPrice({ args: { tickIndex: 20_000n } })
      expect(result.returns).toBe(2_718145925979000000000000n)
    }
    {
      const result = await clamm.methods.calculateSqrtPrice({ args: { tickIndex: 200_000n } })
      expect(result.returns).toBe(22015_455979766288000000000000n)
    }
    {
      const result = await clamm.methods.calculateSqrtPrice({ args: { tickIndex: -20_000n } })
      expect(result.returns).toBe(367897834491000000000000n)
    }
    {
      const result = await clamm.methods.calculateSqrtPrice({ args: { tickIndex: -200_000n } })
      expect(result.returns).toBe(45422634000000000000n)
    }
    {
      const result = await clamm.methods.calculateSqrtPrice({ args: { tickIndex: 0n } })
      expect(result.returns).toBe(1_000000000000000000000000n)
    }
    {
      const result = await clamm.methods.calculateSqrtPrice({ args: { tickIndex: 221_818n } })
      expect(result.returns).toBe(65535_383934512647000000000000n)
    }
    {
      const result = await clamm.methods.calculateSqrtPrice({ args: { tickIndex: -221_818n } })
      expect(result.returns).toBe(15258932000000000000n)
    }
  })

  describe('calculate amount delta', () => {
    let clamm: CLAMMInstance

    beforeEach(async () => {
      const uints = await deployUints(sender)
      clamm = (await deployCLAMM(sender, uints.contractInstance.contractId)).contractInstance
    })

    test('current tick between lower tick and upper tick', async () => {
      const currentTickIndex = 2n
      const currentSqrtPrice = 1_000140000000000000000000n
      const liquidityDelta = 5000000_00000n
      const liquiditySign = true
      const upperTick = 3n
      const lowerTick = 0n

      const params = {
        args: { currentTickIndex, currentSqrtPrice, liquidityDelta, liquiditySign, upperTick, lowerTick }
      }
      const result = (await clamm.methods.calculateAmountDelta(params)).returns
      expect(result).toEqual([51n, 700n, true])
    })

    test('current tick in the middle between lower tick and upper tick', async () => {
      const currentTickIndex = 2n
      const currentSqrtPrice = 1_000140000000000000000000n
      const liquidityDelta = 5000000_00000n
      const liquiditySign = true
      const upperTick = 4n
      const lowerTick = 0n

      const params = {
        args: { currentTickIndex, currentSqrtPrice, liquidityDelta, liquiditySign, upperTick, lowerTick }
      }
      const result = (await clamm.methods.calculateAmountDelta(params)).returns
      expect(result).toEqual([300n, 700n, true])
    })

    test('current tick smaller than lower tick', async () => {
      const currentTickIndex = 0n
      const currentSqrtPrice = 1_000000000000000000000000n
      const liquidityDelta = 10_00000n
      const liquiditySign = true
      const upperTick = 4n
      const lowerTick = 2n

      const params = {
        args: { currentTickIndex, currentSqrtPrice, liquidityDelta, liquiditySign, upperTick, lowerTick }
      }
      const result = (await clamm.methods.calculateAmountDelta(params)).returns
      expect(result).toEqual([1n, 0n, false])
    })

    test('current tick greater than upper tick', async () => {
      const currentTickIndex = 6n
      const currentSqrtPrice = 1_000000000000000000000000n
      const liquidityDelta = 10_00000n
      const liquiditySign = true
      const upperTick = 4n
      const lowerTick = 2n

      const params = {
        args: { currentTickIndex, currentSqrtPrice, liquidityDelta, liquiditySign, upperTick, lowerTick }
      }
      const result = (await clamm.methods.calculateAmountDelta(params)).returns
      expect(result).toEqual([0n, 1n, false])
    })
  })

  describe('calculate amount delta - domain', () => {
    let clamm: CLAMMInstance
    let maxLiquidity = MaxU256

    beforeEach(async () => {
      const uints = await deployUints(sender)
      clamm = (await deployCLAMM(sender, uints.contractInstance.contractId)).contractInstance
    })

    test('max x', async () => {
      const currentTickIndex = -MaxTick
      const currentSqrtPrice = 1_000000000000000000000000n
      const liquiditySign = true
      const upperTick = MaxTick
      const lowerTick = -MaxTick + 1n

      const params = {
        args: { currentTickIndex, currentSqrtPrice, liquidityDelta: maxLiquidity, liquiditySign, upperTick, lowerTick }
      }
      const result = (await clamm.methods.calculateAmountDelta(params)).returns
      expect(result).toEqual([
        75880998414682858767056931020720040283888865803509762441587530402105305752645n,
        0n,
        false
      ])
    })

    test('max y', async () => {
      const currentTickIndex = MaxTick
      const currentSqrtPrice = 1_000000000000000000000000n
      const liquiditySign = true
      const upperTick = MaxTick - 1n
      const lowerTick = -MaxTick

      const params = {
        args: { currentTickIndex, currentSqrtPrice, liquidityDelta: maxLiquidity, liquiditySign, upperTick, lowerTick }
      }
      const result = (await clamm.methods.calculateAmountDelta(params)).returns
      expect(result).toEqual([
        0n,
        75880996274614937472454279923345931777432945506580976077368827511053494714377n,
        false
      ])
    })

    test('delta liquidity = 0', async () => {
      const currentTickIndex = 2n
      const currentSqrtPrice = 1_000140000000000000000000n
      const liquidityDelta = 0n
      const liquiditySign = true
      const upperTick = 4n
      const lowerTick = 0n

      const params = {
        args: { currentTickIndex, currentSqrtPrice, liquidityDelta, liquiditySign, upperTick, lowerTick }
      }
      const result = (await clamm.methods.calculateAmountDelta(params)).returns
      expect(result).toEqual([0n, 0n, true])
    })

    test('error handling', async () => {
      const currentTickIndex = 0n
      const currentSqrtPrice = 1_000140000000000000000000n
      const liquidityDelta = 0n
      const liquiditySign = true
      const upperTick = 4n
      const lowerTick = 10n

      const params = {
        args: { currentTickIndex, currentSqrtPrice, liquidityDelta, liquiditySign, upperTick, lowerTick }
      }
      await expectError(clamm.methods.calculateAmountDelta(params))
    })
  })

  describe('get next sqrt price x up', () => {
    let clamm: CLAMMInstance

    beforeEach(async () => {
      const uints = await deployUints(sender)
      clamm = (await deployCLAMM(sender, uints.contractInstance.contractId)).contractInstance
    })

    test('add 1', async () => {
      const startingSqrtPrice = 1_000000000000000000000000n
      const liquidity = 1_00000n
      const x = 1n

      const params = {
        args: { startingSqrtPrice, liquidity, x, addX: true }
      }
      const result = (await clamm.methods.getNextSqrtPriceXUp(params)).returns
      expect(result).toEqual(500000000000000000000000n)
    })

    test('add 2', async () => {
      const startingSqrtPrice = 1_000000000000000000000000n
      const liquidity = 2_00000n
      const x = 3n

      const params = {
        args: { startingSqrtPrice, liquidity, x, addX: true }
      }
      const result = (await clamm.methods.getNextSqrtPriceXUp(params)).returns
      expect(result).toEqual(400000000000000000000000n)
    })

    test('add 3', async () => {
      const startingSqrtPrice = 2_000000000000000000000000n
      const liquidity = 3_00000n
      const x = 5n

      const params = {
        args: { startingSqrtPrice, liquidity, x, addX: true }
      }
      const result = (await clamm.methods.getNextSqrtPriceXUp(params)).returns
      expect(result).toEqual(461538461538461538461539n)
    })

    test('add 4', async () => {
      const startingSqrtPrice = 24234_000000000000000000000000n
      const liquidity = 3000_00000n
      const x = 5000n

      const params = {
        args: { startingSqrtPrice, liquidity, x, addX: true }
      }
      const result = (await clamm.methods.getNextSqrtPriceXUp(params)).returns
      expect(result).toEqual(599985145205615112277488n)
    })

    test('sub 1', async () => {
      const startingSqrtPrice = 1_000000000000000000000000n
      const liquidity = 2_00000n
      const x = 1n

      const params = {
        args: { startingSqrtPrice, liquidity, x, addX: false }
      }
      const result = (await clamm.methods.getNextSqrtPriceXUp(params)).returns
      expect(result).toEqual(2_000000000000000000000000n)
    })

    test('sub 2', async () => {
      const startingSqrtPrice = 100000_000000000000000000000000n
      const liquidity = 500000000_00000n
      const x = 4000n

      const params = {
        args: { startingSqrtPrice, liquidity, x, addX: false }
      }
      const result = (await clamm.methods.getNextSqrtPriceXUp(params)).returns
      expect(result).toEqual(500000_000000000000000000000000n)
    })

    test('sub 3', async () => {
      const startingSqrtPrice = 3_333333333333333333333333n
      const liquidity = 222_22222n
      const x = 37n
      const params = {
        args: { startingSqrtPrice, liquidity, x, addX: false }
      }
      const result = (await clamm.methods.getNextSqrtPriceXUp(params)).returns
      expect(result).toEqual(7490636797542399944773031n)
    })

    test('other', async () => {
      const uints = await deployUints(sender)
      const clamm = await deployCLAMM(sender, uints.contractInstance.contractId)
      {
        const startingSqrtPrice = 2n * 10n ** 24n
        const liquidity = 3n * 10n ** 5n
        const x = 5n
        const params = { args: { startingSqrtPrice, liquidity, x, addX: true } }
        const nextSqrtPrice = (await clamm.contractInstance.methods.getNextSqrtPriceXUp(params)).returns
        expect(nextSqrtPrice).toEqual(461538461538461538461539n)
      }
      {
        const startingSqrtPrice = 100000n * 10n ** 24n
        const liquidity = 500000000n * 10n ** 5n
        const x = 4000n
        const params = { args: { startingSqrtPrice, liquidity, x, addX: false } }
        const nextSqrtPrice = (await clamm.contractInstance.methods.getNextSqrtPriceXUp(params)).returns
        expect(nextSqrtPrice).toEqual(500000n * 10n ** 24n)
      }
    })
  })

  describe('get next sqrt price x up - domain', () => {
    let clamm: CLAMMInstance
    const maxLiquidity = MaxU256
    const minLiquidity = 1n
    const maxX = MaxU256
    const minX = 1n
    const maxSqrtPrice = 65535383934512647000000000000n
    const minSqrtPrice = 15258932000000000000n
    const almostMinSqrtPrice = 15258932000000000001n
    const almostMaxSqrtPrice = 65535383934512646999999999999n

    beforeEach(async () => {
      const uints = await deployUints(sender)
      clamm = (await deployCLAMM(sender, uints.contractInstance.contractId)).contractInstance
    })

    test('min value inside domain / increases min sqrt price', async () => {
      const params = {
        args: { startingSqrtPrice: minSqrtPrice, liquidity: maxLiquidity, x: 600000000n, addX: false }
      }
      const result = (await clamm.methods.getNextSqrtPriceXUp(params)).returns
      expect(result).toEqual(15258932000000000001n)
    })

    test('min value inside domain / decreases almost min sqrt price', async () => {
      const params = {
        args: {
          startingSqrtPrice: almostMinSqrtPrice,
          liquidity: maxLiquidity,
          x: (2n ** 128n - 1n) * 2n ** 64n,
          addX: true
        }
      }
      const result = (await clamm.methods.getNextSqrtPriceXUp(params)).returns
      expect(result).toEqual(15258932000000000000n)
    })

    test('max value inside domain / decreases max sqrt price', async () => {
      const params = {
        args: { startingSqrtPrice: maxSqrtPrice, liquidity: maxLiquidity, x: 2n ** 128n - 1n, addX: true }
      }
      const result = (await clamm.methods.getNextSqrtPriceXUp(params)).returns
      expect(result).toEqual(65535383934512646999999999999n)
    })

    test('max value inside domain / increases almost max sqrt price', async () => {
      const params = {
        args: { startingSqrtPrice: almostMaxSqrtPrice, liquidity: maxLiquidity, x: 2n ** 128n - 1n, addX: false }
      }
      const result = (await clamm.methods.getNextSqrtPriceXUp(params)).returns
      expect(result).toEqual(65535383934512647000000000001n)
    })

    test('all max', async () => {
      const params = {
        args: {
          startingSqrtPrice: maxSqrtPrice,
          liquidity: maxLiquidity,
          x: maxX,
          addX: true
        }
      }
      const result = (await clamm.methods.getNextSqrtPriceXUp(params)).returns
      expect(result).toEqual(9999999998474106750n)
    })

    test('subtraction underflow', async () => {
      const params = {
        args: { startingSqrtPrice: maxSqrtPrice, liquidity: minLiquidity, x: maxX, addX: false }
      }
      await expectError(clamm.methods.getNextSqrtPriceXUp(params))
    })

    test('max possible result test', async () => {
      const params = {
        args: { startingSqrtPrice: maxSqrtPrice, liquidity: maxLiquidity, x: minX, addX: true }
      }
      const result = (await clamm.methods.getNextSqrtPriceXUp(params)).returns
      expect(result).toEqual(65535383934512647000000000000n)
    })

    test('liquidity is zero', async () => {
      const params = {
        args: { startingSqrtPrice: maxSqrtPrice, liquidity: 0n, x: minX, addX: true }
      }
      const result = (await clamm.methods.getNextSqrtPriceXUp(params)).returns
      expect(result).toEqual(0n)
    })

    test('amount is zero', async () => {
      const params = {
        args: { startingSqrtPrice: maxSqrtPrice, liquidity: maxLiquidity, x: 0n, addX: true }
      }
      const result = (await clamm.methods.getNextSqrtPriceXUp(params)).returns
      expect(result).toEqual(65535383934512647000000000000n)
    })
  })

  describe('next sqrt price from input - domain', () => {
    let clamm: CLAMMInstance
    const maxLiquidity = MaxU256
    const minLiquidity = 1n
    const maxAmount = MaxU256
    const maxSqrtPrice = 65535383934512647000000000000n
    const minSqrtPrice = 15258932000000000000n

    beforeEach(async () => {
      const uints = await deployUints(sender)
      clamm = (await deployCLAMM(sender, uints.contractInstance.contractId)).contractInstance
    })

    test('max result, increase sqrt_price case', async () => {
      // const params = {
      //   args: {
      //     startingSqrtPrice: almostMaxSqrtPrice,
      //     liquidity: maxLiquidity,
      //     amount: 2n ** 128n + 10n ** 10n,
      //     xToY: false
      //   }
      // }
      // const result = (await clamm.methods.getNextSqrtPriceFromInput(params)).returns
      // expect(result).toEqual(65535383934512647000000000001n)
    })

    test('min result, decrease sqrt_price case', async () => {
      // const params = {
      //   args: {
      //     startingSqrtPrice: almostMinSqrtPrice,
      //     liquidity: maxLiquidity,
      //     amount: 2n ** 128n + 10n ** 20n,
      //     xToY: true
      //   }
      // }
      // const result = (await clamm.methods.getNextSqrtPriceFromInput(params)).returns
      // expect(result).toEqual(65535383934512647000000000001n)
    })

    test('max result, increase sqrt_price case', async () => {
      // const params = {
      //   args: { startingSqrtPrice: almostMaxSqrtPrice, liquidity: maxLiquidity, amount: maxAmount, xToY: true }
      // }
      // const result = (await clamm.methods.getNextSqrtPriceFromInput(params)).returns
      // expect(result).toEqual(15258931999999999995n)
    })

    test('amount = 0', async () => {
      const params = {
        args: { startingSqrtPrice: minSqrtPrice, liquidity: maxLiquidity, amount: 0n, xToY: true }
      }
      const result = (await clamm.methods.getNextSqrtPriceFromInput(params)).returns
      expect(result).toEqual(minSqrtPrice)
    })

    test('liquidity = 0', async () => {
      // const params = {
      //   args: { startingSqrtPrice: minSqrtPrice, liquidity: 0n, amount: 20n, xToY: true }
      // }
      // const result = (await clamm.methods.getNextSqrtPriceFromInput(params)).returns
      // expect(result).toEqual(0n)
    })

    test('error handling', async () => {
      const params = {
        args: { startingSqrtPrice: maxSqrtPrice, liquidity: minLiquidity, amount: maxAmount, xToY: false }
      }
      await expectError(clamm.methods.getNextSqrtPriceFromInput(params))
    })
  })

  describe('next sqrt price from output - domain', () => {
    let clamm: CLAMMInstance
    const minLiquidity = 1n
    const maxAmount = MaxU256
    const maxSqrtPrice = 65535383934512647000000000000n

    beforeEach(async () => {
      const uints = await deployUints(sender)
      clamm = (await deployCLAMM(sender, uints.contractInstance.contractId)).contractInstance
    })

    test('max result, increase sqrt_price case', async () => {
      // const params = {
      //   args: {
      //     startingSqrtPrice: almostMaxSqrtPrice,
      //     liquidity: maxLiquidity,
      //     amount: 1n,
      //     xToY: false
      //   }
      // }
      // const result = (await clamm.methods.getNextSqrtPriceFromOutput(params)).returns
      // expect(result).toEqual(65535383934512647000000000000n)
    })

    test('min result, decrease sqrt_price case', async () => {
      // const params = {
      //   args: {
      //     startingSqrtPrice: almostMinSqrtPrice,
      //     liquidity: maxLiquidity,
      //     amount: 1n,
      //     xToY: true
      //   }
      // }
      // const result = (await clamm.methods.getNextSqrtPriceFromOutput(params)).returns
      // expect(result).toEqual(15258932000000000000n)
    })

    test('max result, increase sqrt_price case', async () => {
      // const params = {
      //   args: { startingSqrtPrice: almostMaxSqrtPrice, liquidity: maxLiquidity, amount: maxAmount, xToY: true }
      // }
      // const result = (await clamm.methods.getNextSqrtPriceFromOutput(params)).returns
      // expect(result).toEqual(15258931999999999995n)
    })

    test('amount = 0', async () => {
      // const params = {
      //   args: { startingSqrtPrice: minSqrtPrice, liquidity: maxLiquidity, amount: 0n, xToY: true }
      // }
      // const result = (await clamm.methods.getNextSqrtPriceFromOutput(params)).returns
      // expect(result).toEqual(minSqrtPrice)
    })

    test('liquidity = 0', async () => {
      // const params = {
      //   args: { startingSqrtPrice: minSqrtPrice, liquidity: 0n, amount: 20n, xToY: true }
      // }
      // const result = (await clamm.methods.getNextSqrtPriceFromOutput(params)).returns
      // expect(result).toEqual(0n)
    })

    test('error handling', async () => {
      const params = {
        args: { startingSqrtPrice: maxSqrtPrice, liquidity: minLiquidity, amount: maxAmount, xToY: false }
      }
      await expectError(clamm.methods.getNextSqrtPriceFromOutput(params))
    })
  })

  describe('compute swap step', () => {
    let clamm: CLAMMInstance

    beforeEach(async () => {
      const uints = await deployUints(sender)
      clamm = (await deployCLAMM(sender, uints.contractInstance.contractId)).contractInstance
    })

    test('one token by amount in', async () => {
      const currentSqrtPrice = 1_000000000000000000000000n
      const targetSqrtPrice = 1_004987562112089027021926n
      const liquidity = 2000_00000n
      const amount = 1n
      const fee = 600000000n

      const params = {
        args: { currentSqrtPrice, targetSqrtPrice, liquidity, amount, byAmountIn: true, fee }
      }
      const result = (await clamm.methods.computeSwapStep(params)).returns
      expect(result).toEqual({ nextSqrtPrice: currentSqrtPrice, amountIn: 0n, amountOut: 0n, feeAmount: 1n })
    })

    test('amount out capped at target sqrt price', async () => {
      const currentSqrtPrice = 1_000000000000000000000000n
      const targetSqrtPrice = 1_004987562112089027021926n
      const liquidity = 2000_00000n
      const amount = 20n
      const fee = 600000000n

      const paramsResultIn = {
        args: { currentSqrtPrice, targetSqrtPrice, liquidity, amount, byAmountIn: true, fee }
      }
      const paramsResultOut = {
        args: { currentSqrtPrice, targetSqrtPrice, liquidity, amount, byAmountIn: false, fee }
      }
      const resultIn = (await clamm.methods.computeSwapStep(paramsResultIn)).returns
      const resultOut = (await clamm.methods.computeSwapStep(paramsResultOut)).returns
      expect(resultIn).toEqual({ nextSqrtPrice: targetSqrtPrice, amountIn: 10n, amountOut: 9n, feeAmount: 1n })
      expect(resultOut).toEqual({ nextSqrtPrice: targetSqrtPrice, amountIn: 10n, amountOut: 9n, feeAmount: 1n })
    })

    test('amount in not capped', async () => {
      const currentSqrtPrice = 1_010000000000000000000000n
      const targetSqrtPrice = 10_000000000000000000000000n
      const liquidity = 300000000_00000n
      const amount = 1000000n
      const fee = 600000000n

      const params = {
        args: { currentSqrtPrice, targetSqrtPrice, liquidity, amount, byAmountIn: true, fee }
      }
      const result = (await clamm.methods.computeSwapStep(params)).returns
      expect(result).toEqual({
        nextSqrtPrice: 1_013331333333333333333333n,
        amountIn: 999400n,
        amountOut: 976487n,
        feeAmount: 600n
      })
    })

    test('amount out not capped', async () => {
      // const currentSqrtPrice = 101_000000000000000000000000n
      // const targetSqrtPrice = 100_000000000000000000000000n
      // const liquidity = 5000000000000_00000n
      // const amount = 2000000n
      // const fee = 600000000n
      // const params = {
      //   args: { currentSqrtPrice, targetSqrtPrice, liquidity, amount, byAmountIn: false, fee }
      // }
      // const result = (await clamm.methods.computeSwapStep(params)).returns
      // expect(result).toEqual({
      //   nextSqrtPrice: 100_999999600000000000000000n,
      //   amountIn: 197n,
      //   amountOut: amount,
      //   feeAmount: 1n
      // })
    })

    test('empty swap step when sqrt price is at tick', async () => {
      const currentSqrtPrice = 999500149965000000000000n
      const targetSqrtPrice = 999500149965000000000000n
      const liquidity = 200060000_00000n
      const amount = 1000000n
      const fee = 600000000n

      const params = {
        args: { currentSqrtPrice, targetSqrtPrice, liquidity, amount, byAmountIn: true, fee }
      }
      const result = (await clamm.methods.computeSwapStep(params)).returns
      expect(result).toEqual({
        nextSqrtPrice: currentSqrtPrice,
        amountIn: 0n,
        amountOut: 0n,
        feeAmount: 0n
      })
    })

    test('if liquidity is high, small amount in should not push sqrt price', async () => {
      const currentSqrtPrice = 999500149965000000000000n
      const targetSqrtPrice = 1_999500149965000000000000n
      const liquidity = 100000000000000000000000000_00000n
      const amount = 10n
      const fee = 600000000n

      const params = {
        args: { currentSqrtPrice, targetSqrtPrice, liquidity, amount, byAmountIn: true, fee }
      }
      const result = (await clamm.methods.computeSwapStep(params)).returns
      expect(result).toEqual({
        nextSqrtPrice: currentSqrtPrice,
        amountIn: 0n,
        amountOut: 0n,
        feeAmount: 10n
      })
    })

    test('amount in > u64 for swap to target sqrt price and when liquidity > 2^64', async () => {
      const currentSqrtPrice = 1_000000000000000000000000n
      const targetSqrtPrice = 1_000050000000000000000000n
      const liquidity = 368944000000000000000000_00000n
      const amount = 1n
      const fee = 600000000n

      const params = {
        args: { currentSqrtPrice, targetSqrtPrice, liquidity, amount, byAmountIn: true, fee }
      }
      const result = (await clamm.methods.computeSwapStep(params)).returns
      expect(result).toEqual({
        nextSqrtPrice: currentSqrtPrice,
        amountIn: 0n,
        amountOut: 0n,
        feeAmount: 1n
      })
    })

    test('amount out > u64 for swap to target sqrt price and when liquidity > 2^64', async () => {
      const currentSqrtPrice = 1_000000000000000000000000n
      const targetSqrtPrice = 1_000050000000000000000000n
      const liquidity = 368944000000000000000000_00000n
      const amount = 1n
      const fee = 600000000n

      const params = {
        args: { currentSqrtPrice, targetSqrtPrice, liquidity, amount, byAmountIn: false, fee }
      }
      const result = (await clamm.methods.computeSwapStep(params)).returns
      expect(result).toEqual({
        nextSqrtPrice: 1_000000000000000000000003n,
        amountIn: 2n,
        amountOut: 1n,
        feeAmount: 1n
      })
    })

    test('liquidity is zero and by amount in should skip to target sqrt price', async () => {
      const currentSqrtPrice = 1_000000000000000000000000n
      const targetSqrtPrice = 1_000050000000000000000000n
      const liquidity = 0n
      const amount = 100000n
      const fee = 600000000n

      const paramsIn = {
        args: { currentSqrtPrice, targetSqrtPrice, liquidity, amount, byAmountIn: true, fee }
      }
      const paramsOut = {
        args: { currentSqrtPrice, targetSqrtPrice, liquidity, amount, byAmountIn: true, fee }
      }
      const resultIn = (await clamm.methods.computeSwapStep(paramsIn)).returns
      const resultOut = (await clamm.methods.computeSwapStep(paramsOut)).returns
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
      const currentSqrtPrice = 999950000000000000000000n
      const targetSqrtPrice = 1_000000000000000000000000n
      const liquidity = 50000000_00000n
      const amount = 1000n
      const fee = 0n

      const params = {
        args: { currentSqrtPrice, targetSqrtPrice, liquidity, amount, byAmountIn: true, fee }
      }
      const result = (await clamm.methods.computeSwapStep(params)).returns
      expect(result).toEqual({
        nextSqrtPrice: 999970000000000000000000n,
        amountIn: 1000n,
        amountOut: 1000n,
        feeAmount: 0n
      })
    })

    test('by amount out and x to y edge cases', async () => {
      // const tickIndex = -10n
      // const targetSqrtPrice = (await clamm.methods.calculateSqrtPrice({ args: { tickIndex } })).returns
      // const currentSqrtPrice = targetSqrtPrice + 1_000000000000000000000000n
      // const liquidity = 340282366920938463463374607_00000n
      // const oneToken = 1n
      // const tokensWithSameOutput = 85n
      // const zeroToken = 0n
      // const maxFee = 900000000000n
      // const minFee = 0n
      // const oneTokenParams = {
      //   args: {
      //     currentSqrtPrice,
      //     targetSqrtPrice,
      //     liquidity,
      //     amount: oneToken,
      //     byAmountIn: false,
      //     fee: maxFee
      //   }
      // }
      // const tokensWithSameOutputParams = {
      //   args: {
      //     currentSqrtPrice,
      //     targetSqrtPrice,
      //     liquidity,
      //     amount: tokensWithSameOutput,
      //     byAmountIn: false,
      //     fee: maxFee
      //   }
      // }
      // const zeroTokenParams = {
      //   args: {
      //     currentSqrtPrice,
      //     targetSqrtPrice,
      //     liquidity,
      //     amount: zeroToken,
      //     byAmountIn: false,
      //     fee: minFee
      //   }
      // }
      // const oneTokenResult = (await clamm.methods.computeSwapStep(oneTokenParams)).returns
      // const tokensWithSameOutputResult = (await clamm.methods.computeSwapStep(tokensWithSameOutputParams)).returns
      // const zeroTokenResult = (await clamm.methods.computeSwapStep(zeroTokenParams)).returns
      // expect(oneTokenResult).toEqual({
      //   nextSqrtPrice: currentSqrtPrice - 1n,
      //   amountIn: 86n,
      //   amountOut: 1n,
      //   feeAmount: 78n
      // })
      // expect(tokensWithSameOutputResult).toEqual({
      //   nextSqrtPrice: currentSqrtPrice - 1n,
      //   amountIn: 86n,
      //   amountOut: 85n,
      //   feeAmount: 78n
      // })
      // expect(zeroTokenResult).toEqual({
      //   nextSqrtPrice: currentSqrtPrice,
      //   amountIn: 0n,
      //   amountOut: 0n,
      //   feeAmount: 0n
      // })
    })
  })

  describe('compute swap step - domain', () => {
    let clamm: CLAMMInstance

    const oneSqrtPrice = 1_000000000000000000000000n
    const twoSqrtPrice = 2_000000000000000000000000n
    const maxSqrtPrice = 65535383934512647000000000000n
    const minSqrtPrice = 15258932000000000000n
    const oneLiquidity = 1_0000n
    const maxLiquidity = MaxU256
    const maxAmount = MaxU256
    const maxAmountNotReachedTargetSqrtPrice = MaxU256 - 1n
    const maxFee = 1_000000000000n
    const minFee = 0n

    beforeEach(async () => {
      const uints = await deployUints(sender)
      clamm = (await deployCLAMM(sender, uints.contractInstance.contractId)).contractInstance
    })

    test('100% fee | max amount', async () => {
      const params = {
        args: {
          currentSqrtPrice: oneSqrtPrice,
          targetSqrtPrice: twoSqrtPrice,
          liquidity: oneLiquidity,
          amount: maxAmount,
          byAmountIn: true,
          fee: maxFee
        }
      }
      const result = (await clamm.methods.computeSwapStep(params)).returns
      expect(result).toEqual({
        nextSqrtPrice: 1_000000000000000000000000n,
        amountIn: 0n,
        amountOut: 0n,
        feeAmount: maxAmount
      })
    })

    test('0% fee | max amount | max liquidity | sqrt price slice', async () => {
      // const params = {
      //   args: {
      //     currentSqrtPrice: oneSqrtPrice,
      //     targetSqrtPrice: twoSqrtPrice,
      //     liquidity: maxLiquidity,
      //     amount: maxAmount,
      //     byAmountIn: true,
      //     fee: minFee
      //   }
      // }
      // const result = (await clamm.methods.computeSwapStep(params)).returns
      // expect(result).toEqual({
      //   nextSqrtPrice: 2_000000000000000000000000n,
      //   amountIn: 1157920892373161954235709850086879078532699846656405640394575840079131297n,
      //   amountOut: 578960446186580977117854925043439539266349923328202820197287920039565648n,
      //   feeAmount: 0n
      // })
    })

    test('by amount in == true || close to target sqrt price but not reached', async () => {
      const bigLiquidity = 100000000000000_00000n
      const amountPushingSqrtPriceToTarget = 100000000000000n

      const params = {
        args: {
          currentSqrtPrice: oneSqrtPrice,
          targetSqrtPrice: twoSqrtPrice,
          liquidity: bigLiquidity,
          amount: amountPushingSqrtPriceToTarget - 1n,
          byAmountIn: true,
          fee: minFee
        }
      }
      const result = (await clamm.methods.computeSwapStep(params)).returns
      expect(result).toEqual({
        nextSqrtPrice: 1_999999999999990000000000n,
        amountIn: 99999999999999n,
        amountOut: 49999999999999n,
        feeAmount: 0n
      })
    })

    test('maximize fee amount || close to target sqrt price but not reached', async () => {
      // const params = {
      //   args: {
      //     currentSqrtPrice: oneSqrtPrice,
      //     targetSqrtPrice: twoSqrtPrice,
      //     liquidity: maxLiquidity,
      //     amount: MaxU256,
      //     byAmountIn: true,
      //     fee: maxFee - 19n
      //   }
      // }
      // const result = (await clamm.methods.computeSwapStep(params)).returns
      // expect(result).toEqual({
      //   nextSqrtPrice: 10_00001899999999999999999n,
      //   amountIn: 2200049695509007711889927822791908294976419858560291638216994249494n,
      //   amountOut: 2200045515422528409085952759527180615861658807361317178894970210709n,
      //   feeAmount: 115792089235116145728061977296797980030478076370664144180897292369696135390441n
      // })
    })

    test('get next sqrt price from input -> get next sqrt price x up', async () => {
      // const params = {
      //   args: {
      //     currentSqrtPrice: maxSqrtPrice,
      //     targetSqrtPrice: minSqrtPrice,
      //     liquidity: maxLiquidity,
      //     amount: maxAmountNotReachedTargetSqrtPrice,
      //     byAmountIn: true,
      //     fee: minFee
      //   }
      // }
      // const result = (await clamm.methods.computeSwapStep(params)).returns
      // expect(result).toEqual({
      //   nextSqrtPrice: 15258932000000000000n,
      //   amountIn: 75884792730156830614567103553061795263351065677581979504561495713443442818879n,
      //   amountOut: 75884790229800029582010010030152469040784228171629896065450012281800526658805n,
      //   feeAmount: 0n
      // })
    })

    test('get next sqrt price from input -> get next sqrt price y down / scale', async () => {
      // const params = {
      //   args: {
      //     currentSqrtPrice: minSqrtPrice,
      //     targetSqrtPrice: maxSqrtPrice,
      //     liquidity: maxLiquidity,
      //     amount: maxAmountNotReachedTargetSqrtPrice,
      //     byAmountIn: true,
      //     fee: minFee
      //   }
      // }
      // const result = (await clamm.methods.computeSwapStep(params)).returns
      // expect(result).toEqual({
      //   nextSqrtPrice: 65535_383934512647000000000000n,
      //   amountIn: 75884790229800029582010010030152469040784228171629896065450012281800526658806n,
      //   amountOut: 75884792730156830614567103553061795263351065677581979504561495713443442818878n,
      //   feeAmount: 0n
      // })
    })

    test('get next sqrt price from input -> get next sqrt price y down / big div - no possible to trigger from compute swap step', async () => {
      // const minOverflowTokenAmount = 340282366920939n
      // const params = {
      //   args: {
      //     currentSqrtPrice: minSqrtPrice,
      //     targetSqrtPrice: maxSqrtPrice,
      //     liquidity: oneLiquidity - 1n,
      //     amount: minOverflowTokenAmount - 1n,
      //     byAmountIn: true,
      //     fee: minFee
      //   }
      // }
      // const result = (await clamm.methods.computeSwapStep(params)).returns
      // expect(result).toEqual({
      //   nextSqrtPrice: maxSqrtPrice,
      //   amountIn: 65535n,
      //   amountOut: 65534n,
      //   feeAmount: 0n
      // })
    })

    test('get next sqrt price from output -> get next sqrt price x up / min sqrt price different at maximum amount', async () => {
      // const minDiff = 232826265438719159684n
      // const params = {
      //   args: {
      //     currentSqrtPrice: maxSqrtPrice - minDiff,
      //     targetSqrtPrice: maxSqrtPrice,
      //     liquidity: maxLiquidity,
      //     amount: MaxU256 - 1n,
      //     byAmountIn: false,
      //     fee: minFee
      //   }
      // }
      // const result = (await clamm.methods.computeSwapStep(params)).returns
      // expect(result).toEqual({
      //   nextSqrtPrice: 65535383934512647000000000000n,
      //   amountIn: 269594397044712364927302271135767871256767389391069984018896158734608n,
      //   amountOut: 62771017353866807635074993554120737773068233085134433767742n,
      //   feeAmount: 0n
      // })
    })

    test('get next sqrt price from output -> get next sqrt price x up / min sqrt price different at maximum amount', async () => {
      const params = {
        args: {
          currentSqrtPrice: minSqrtPrice,
          targetSqrtPrice: maxSqrtPrice,
          liquidity: 281477613507675_00000n,
          amount: MaxU256 - 1n,
          byAmountIn: false,
          fee: minFee
        }
      }
      const result = (await clamm.methods.computeSwapStep(params)).returns
      expect(result).toEqual({
        nextSqrtPrice: 65535383934512647000000000000n,
        amountIn: 18446743465900796471n,
        amountOut: 18446744073709559494n,
        feeAmount: 0n
      })
    })

    test('get next sqrt price from output -> get next sqrt price x up / min token change', async () => {
      // const params = {
      //   args: {
      //     currentSqrtPrice: maxSqrtPrice - 1_000000000000000000000000n,
      //     targetSqrtPrice: maxSqrtPrice,
      //     liquidity: 10000000000_00000n,
      //     amount: 1n,
      //     byAmountIn: false,
      //     fee: minFee
      //   }
      // }
      // const result = (await clamm.methods.computeSwapStep(params)).returns
      // expect(result).toEqual({
      //   nextSqrtPrice: 65534813412874974599766965330n,
      //   amountIn: 4294783624n,
      //   amountOut: 1n,
      //   feeAmount: 0n
      // })
    })

    test('get next sqrt price from output -> get next sqrt price x up / max amount out, by amount in == false', async () => {
      // const params = {
      //   args: {
      //     currentSqrtPrice: maxSqrtPrice,
      //     targetSqrtPrice: minSqrtPrice,
      //     liquidity: maxLiquidity,
      //     amount: maxAmount,
      //     byAmountIn: false,
      //     fee: minFee
      //   }
      // }
      // const result = (await clamm.methods.computeSwapStep(params)).returns
      // expect(result).toEqual({
      //   nextSqrtPrice: 15258932000000000000n,
      //   amountIn: 75884792730156830614567103553061795263351065677581979504561495713443442818879n,
      //   amountOut: 75884790229800029582010010030152469040784228171629896065450012281800526658805n,
      //   feeAmount: 0n
      // })
    })
  })
})
