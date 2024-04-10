import { ONE_ALPH, SignerProvider, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { UintsInstance } from '../artifacts/ts'
import { ArithmeticError, MaxU256, deployUints, expectError } from '../src/utils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

describe('uints tests', () => {
  let sender: SignerProvider
  let uints: UintsInstance

  beforeAll(async () => {
    sender = await getSigner(ONE_ALPH * 100000n, 0)
    uints = (await deployUints(sender)).contractInstance
  })

  test('unwrap result u256 works', async () => {
    const resultU256 = { value: 1n, error: 0n }
    const result = (await uints.methods.unwrapU256({ args: { result: resultU256 } })).returns
    expect(result).toEqual(resultU256.value)
  })

  test('unwrap result u256 throws error when error is not 0', async () => {
    const resultU256 = { value: 1n, error: ArithmeticError.CastOverflow }
    expectError(uints.methods.unwrapU256({ args: { result: resultU256 } }))
  })

  test('unwrap result u512 works', async () => {
    const resultU256 = { value: { higher: 2n, lower: 1n }, error: 0n }
    const result = (await uints.methods.unwrapU512({ args: { result: resultU256 } })).returns
    expect(result).toEqual(resultU256.value)
  })

  test('unwrap result u512 throws error when error is not 0', async () => {
    const resultU256 = { value: { higher: 2n, lower: 1n }, error: ArithmeticError.CastOverflow }
    expectError(uints.methods.unwrapU512({ args: { result: resultU256 } }))
  })

  test('to u256 works', async () => {
    const value = { higher: 0n, lower: 1n }
    const result = (await uints.methods.toU256({ args: { value } })).returns
    expect(result).toEqual({ value: value.lower, error: 0n })
  })

  test('to u256 returns an error if number is higher than u256', async () => {
    const value = { higher: 2n, lower: 1n }
    const result = (await uints.methods.toU256({ args: { value } })).returns
    expect(result).toEqual({ value: MaxU256, error: ArithmeticError.CastOverflow })
  })

  test('to u512 works', async () => {
    const value = 1n
    const result = (await uints.methods.toU512({ args: { value } })).returns
    expect(result).toEqual({ higher: 0n, lower: value })
  })

  test('Big numbers division', async () => {
    const uints = await deployUints(sender)
    {
      const a = {
        higher: 65535383919253714999999999999n,
        lower: 115792089237316195423570985008687907853269984665575028655538330292913129639936n
      }
      const b = 10n ** 5n
      const result = (await uints.contractInstance.methods.bigDiv({ args: { a, b, bDenominator: 1n } })).returns
      expect(result.value).toStrictEqual({
        higher: 655353839192537149999999n,
        lower: 115792089237316195423570985008687907853269984665640563384103744815375979600000n
      })
      // received - 75884790229800029582010010030152469040784228171629896065450012281800526658805261388918611085249960064
      // Expected - 75884790229800029582010010030152469040784228171629896065450012281800526658805261388918611085250000000
    }
    {
      const a = {
        higher: 65535383919253714999999999999n,
        lower: 115792089237316195423570985008687907853269984665575028655538330292913129639936n
      }
      const b = { higher: 0n, lower: 10n ** 5n }
      const result = (
        await uints.contractInstance.methods.bigDiv512({ args: { dividend: a, divisor: b, divisorDenominator: 1n } })
      ).returns
      // Received - 75884790229800029582010010030152469040784228171629896065450012281800526658805261388918611085250000000
      // Expected - 75884790229800029582010010030152469040784228171629896065450012281800526658805261388918611085250000000
      expect(result).toStrictEqual({
        higher: 655353839192537149999999n,
        lower: 115792089237316195423570985008687907853269984665640563384103744815375979639936n
      })
    }
  })

  test('big add 256', async () => {
    {
      const a = 1n
      const b = 2n
      const result = (await uints.methods.bigAdd256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 3n })
    }
    {
      const a = MaxU256
      const b = 2n
      const result = (await uints.methods.bigAdd256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: 1n })
    }
    {
      const a = MaxU256
      const b = MaxU256
      const result = (await uints.methods.bigAdd256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: a - 1n })
    }
  })

  test('big add', async () => {
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const result = (await uints.methods.bigAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual({ value: { higher: 0n, lower: 3n }, error: 0n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = 2n
      const result = (await uints.methods.bigAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual({ value: { higher: 1n, lower: 1n }, error: 0n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = MaxU256
      const result = (await uints.methods.bigAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual({ value: { higher: 1n, lower: a.lower - 1n }, error: 0n })
    }
    {
      const a = { higher: MaxU256, lower: 0n }
      const b = MaxU256
      const result = (await uints.methods.bigAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual({
        value: {
          higher: MaxU256,
          lower: MaxU256
        },
        error: 0n
      })
    }
  })

  test('big add returns an error if number if higher than u512', async () => {
    {
      const a = {
        higher: MaxU256,
        lower: MaxU256
      }
      const b = 1n
      const result = (await uints.methods.bigAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual({
        value: {
          higher: MaxU256,
          lower: MaxU256
        },
        error: ArithmeticError.AddOverflow
      })
    }
    {
      const a = {
        higher: MaxU256,
        lower: 1n
      }
      const b = MaxU256
      const result = (await uints.methods.bigAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual({
        value: {
          higher: MaxU256,
          lower: MaxU256
        },
        error: ArithmeticError.AddOverflow
      })
    }
  })

  test('big add 512', async () => {
    {
      const a = { higher: 0n, lower: 1n }
      const b = { higher: 0n, lower: 2n }
      const result = (await uints.methods.bigAdd512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ value: { higher: 0n, lower: 3n }, error: 0n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = { higher: 0n, lower: 2n }
      const result = (await uints.methods.bigAdd512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ value: { higher: 1n, lower: 1n }, error: 0n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = { higher: 0n, lower: MaxU256 }
      const result = (await uints.methods.bigAdd512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ value: { higher: 1n, lower: a.lower - 1n }, error: 0n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = {
        higher: MaxU256,
        lower: 0n
      }
      const result = (await uints.methods.bigAdd512({ args: { a, b } })).returns
      expect(result).toStrictEqual({
        value: {
          higher: MaxU256,
          lower: MaxU256
        },
        error: 0n
      })
    }
  })

  test('big add 512 returns an error if number if higher than u512', async () => {
    {
      const a = {
        higher: MaxU256,
        lower: MaxU256
      }
      const b = {
        higher: 0n,
        lower: 1n
      }
      const result = (await uints.methods.bigAdd512({ args: { a, b } })).returns
      expect(result).toStrictEqual({
        value: {
          higher: MaxU256,
          lower: MaxU256
        },
        error: ArithmeticError.AddOverflow
      })
    }
    {
      const a = {
        higher: 1n,
        lower: MaxU256
      }
      const b = {
        higher: MaxU256,
        lower: 0n
      }
      const result = (await uints.methods.bigAdd512({ args: { a, b } })).returns
      expect(result).toStrictEqual({
        value: {
          higher: MaxU256,
          lower: MaxU256
        },
        error: ArithmeticError.AddOverflow
      })
    }
    {
      const a = {
        higher: 1n,
        lower: 0n
      }
      const b = {
        higher: MaxU256,
        lower: 0n
      }
      const result = (await uints.methods.bigAdd512({ args: { a, b } })).returns
      expect(result).toStrictEqual({
        value: {
          higher: MaxU256,
          lower: MaxU256
        },
        error: ArithmeticError.AddOverflow
      })
    }
  })

  test('big div', async () => {
    {
      const a = { higher: 0n, lower: 2n }
      const b = 1n
      const bDenominator = 1n
      const result = (await uints.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 0n, lower: 2n }, error: 0n })
    }
    {
      const a = { higher: 0n, lower: 2n }
      const b = 2n
      const bDenominator = 1n
      const result = (await uints.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 0n, lower: 1n }, error: 0n })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const bDenominator = 1n
      const result = (await uints.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 0n, lower: 0n }, error: 0n })
    }
    {
      const a = { higher: 1n, lower: 0n }
      const b = 1n
      const bDenominator = 1n
      const result = (await uints.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 1n, lower: 0n }, error: 0n })
    }
    {
      const a = { higher: 20n, lower: 20n }
      const b = 10n
      const bDenominator = 1n
      const result = (await uints.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 2n, lower: 2n }, error: 0n })
    }
    {
      const a = { higher: MaxU256, lower: MaxU256 }
      const b = MaxU256
      const bDenominator = 1n
      const result = (await uints.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 1n, lower: 1n }, error: 0n })
    }
    {
      const a = { higher: MaxU256, lower: 0n }
      const b = MaxU256
      const bDenominator = 1n
      const result = (await uints.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 1n, lower: 0n }, error: 0n })
    }
    {
      const a = { higher: 0n, lower: 2n }
      const b = 10n
      const bDenominator = 10n
      const result = (await uints.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 0n, lower: 2n }, error: 0n })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const bDenominator = 10n
      const result = (await uints.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 0n, lower: 5n }, error: 0n })
    }
    {
      const a = { higher: 0n, lower: 0n }
      const b = MaxU256
      const bDenominator = 1n
      const result = (await uints.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 0n, lower: 0n }, error: 0n })
    }
    {
      const a = { higher: MaxU256, lower: MaxU256 }
      const b = 1n
      const bDenominator = 100n
      const result = (await uints.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: MaxU256, lower: MaxU256 }, error: 0n })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const bDenominator = 1n
      const result = (await uints.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 0n, lower: 0n }, error: 0n })
    }
  })

  test('big div return error when dividing by zero or b denominator is zero', async () => {
    {
      const a = { higher: 0n, lower: 2n }
      const b = 0n
      const bDenominator = 1n
      const result = (await uints.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({
        value: { higher: MaxU256, lower: MaxU256 },
        error: ArithmeticError.DivNotPositiveDivisor
      })
    }
    {
      const a = { higher: 0n, lower: 2n }
      const b = 1n
      const bDenominator = 0n
      const result = (await uints.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({
        value: { higher: MaxU256, lower: MaxU256 },
        error: ArithmeticError.DivNotPositiveDenominator
      })
    }
  })

  test('big div up', async () => {
    {
      const a = { higher: 0n, lower: 2n }
      const b = 1n
      const bDenominator = 1n
      const result = (await uints.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 0n, lower: 2n }, error: 0n })
    }
    {
      const a = { higher: 0n, lower: 2n }
      const b = 2n
      const bDenominator = 1n
      const result = (await uints.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 0n, lower: 1n }, error: 0n })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const bDenominator = 1n
      const result = (await uints.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 0n, lower: 1n }, error: 0n })
    }
    {
      const a = { higher: 1n, lower: 0n }
      const b = 1n
      const bDenominator = 1n
      const result = (await uints.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 1n, lower: 0n }, error: 0n })
    }
    {
      const a = { higher: 20n, lower: 20n }
      const b = 10n
      const bDenominator = 1n
      const result = (await uints.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 2n, lower: 2n }, error: 0n })
    }
    {
      const a = { higher: MaxU256, lower: MaxU256 }
      const b = MaxU256
      const bDenominator = 1n
      const result = (await uints.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 1n, lower: 1n }, error: 0n })
    }
    {
      const a = { higher: MaxU256, lower: 0n }
      const b = MaxU256
      const bDenominator = 1n
      const result = (await uints.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 1n, lower: 0n }, error: 0n })
    }
    {
      const a = { higher: 0n, lower: 2n }
      const b = 10n
      const bDenominator = 10n
      const result = (await uints.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 0n, lower: 2n }, error: 0n })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const bDenominator = 10n
      const result = (await uints.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 0n, lower: 5n }, error: 0n })
    }
    {
      const a = { higher: 0n, lower: 0n }
      const b = MaxU256
      const bDenominator = 1n
      const result = (await uints.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 0n, lower: 0n }, error: 0n })
    }
    {
      const a = { higher: MaxU256, lower: MaxU256 }
      const b = 1n
      const bDenominator = 100n
      const result = (await uints.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: MaxU256, lower: MaxU256 }, error: 0n })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const bDenominator = 1n
      const result = (await uints.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 0n, lower: 1n }, error: 0n })
    }
  })

  test('big div up return error when dividing by zero or b denominator is zero', async () => {
    {
      const a = { higher: 0n, lower: 2n }
      const b = 0n
      const bDenominator = 1n
      const result = (await uints.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({
        value: { higher: MaxU256, lower: MaxU256 },
        error: ArithmeticError.DivNotPositiveDivisor
      })
    }
    {
      const a = { higher: 0n, lower: 2n }
      const b = 1n
      const bDenominator = 0n
      const result = (await uints.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({
        value: { higher: MaxU256, lower: MaxU256 },
        error: ArithmeticError.DivNotPositiveDenominator
      })
    }
  })

  test('big mul 256', async () => {
    {
      const a = 1n
      const b = 2n
      const result = (await uints.methods.bigMul256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = MaxU256
      const b = 2n
      const result = (await uints.methods.bigMul256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: MaxU256 - 1n })
    }
    {
      const a = MaxU256
      const b = MaxU256
      const result = (await uints.methods.bigMul256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: MaxU256 - 1n, lower: 1n })
    }
    {
      const a = MaxU256
      const b = 0n
      const result = (await uints.methods.bigMul256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = 0n
      const b = 0n
      const result = (await uints.methods.bigMul256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
  })

  test('big mul', async () => {
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const result = (await uints.methods.bigMul({ args: { a, b } })).returns
      expect(result).toStrictEqual({ value: { higher: 0n, lower: 2n }, error: 0n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = 2n
      const result = (await uints.methods.bigMul({ args: { a, b } })).returns
      expect(result).toStrictEqual({ value: { higher: 1n, lower: MaxU256 - 1n }, error: 0n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = MaxU256
      const result = (await uints.methods.bigMul({ args: { a, b } })).returns
      expect(result).toStrictEqual({ value: { higher: MaxU256 - 1n, lower: 1n }, error: 0n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = 0n
      const result = (await uints.methods.bigMul({ args: { a, b } })).returns
      expect(result).toStrictEqual({ value: { higher: 0n, lower: 0n }, error: 0n })
    }
    {
      const a = { higher: 0n, lower: 0n }
      const b = 0n
      const result = (await uints.methods.bigMul({ args: { a, b } })).returns
      expect(result).toStrictEqual({ value: { higher: 0n, lower: 0n }, error: 0n })
    }
  })

  test('big mul returns an error if number is higher than u512', async () => {
    {
      const a = { higher: MaxU256, lower: MaxU256 }
      const b = 2n
      const result = (await uints.methods.bigMul({ args: { a, b } })).returns
      expect(result).toStrictEqual({ value: { higher: MaxU256, lower: MaxU256 }, error: ArithmeticError.MulOverflow })
    }
    {
      const a = { higher: MaxU256, lower: 1n }
      const b = MaxU256
      const result = (await uints.methods.bigMul({ args: { a, b } })).returns
      expect(result).toStrictEqual({ value: { higher: MaxU256, lower: MaxU256 }, error: ArithmeticError.MulOverflow })
    }
    {
      const a = { higher: MaxU256 - 1n, lower: MaxU256 }
      const b = MaxU256
      const result = (await uints.methods.bigMul({ args: { a, b } })).returns
      expect(result).toStrictEqual({ value: { higher: MaxU256, lower: MaxU256 }, error: ArithmeticError.MulOverflow })
    }
    {
      const a = { higher: MaxU256, lower: MaxU256 }
      const b = MaxU256
      const result = (await uints.methods.bigMul({ args: { a, b } })).returns
      expect(result).toStrictEqual({ value: { higher: MaxU256, lower: MaxU256 }, error: ArithmeticError.MulOverflow })
    }
  })

  test('big mul div 256', async () => {
    {
      const a = 1n
      const b = 2n
      const bDenominator = 1n
      const result = (await uints.methods.bigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 0n, lower: 2n }, error: 0n })
    }
    {
      const a = MaxU256
      const b = 2n
      const bDenominator = 1n
      const result = (await uints.methods.bigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 1n, lower: MaxU256 - 1n }, error: 0n })
    }
    {
      const a = MaxU256
      const b = MaxU256
      const bDenominator = 1n
      const result = (await uints.methods.bigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({
        value: {
          higher: MaxU256 - 1n,
          lower: 1n
        },
        error: 0n
      })
    }
    {
      const a = MaxU256
      const b = 0n
      const bDenominator = 1n
      const result = (await uints.methods.bigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 0n, lower: 0n }, error: 0n })
    }
    {
      const a = 0n
      const b = 0n
      const bDenominator = 1n
      const result = (await uints.methods.bigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 0n, lower: 0n }, error: 0n })
    }
    {
      const a = 100n
      const b = 200n
      const bDenominator = 100n
      const result = (await uints.methods.bigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 0n, lower: 200n }, error: 0n })
    }
    {
      const a = 1n
      const b = 150n
      const bDenominator = 100n
      const result = (await uints.methods.bigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 0n, lower: 1n }, error: 0n })
    }
    {
      const a = MaxU256
      const b = MaxU256
      const bDenominator = MaxU256
      const result = (await uints.methods.bigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 0n, lower: MaxU256 - 1n }, error: 0n })
    }
  })

  test('big mul div 256 returns an error if b denominator is zero', async () => {
    {
      const a = 1n
      const b = 1n
      const bDenominator = 0n
      const result = (await uints.methods.bigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({
        value: { higher: MaxU256, lower: MaxU256 },
        error: ArithmeticError.MulNotPositiveDenominator
      })
    }
  })

  test('big mul div up 256', async () => {
    {
      const a = 1n
      const b = 2n
      const bDenominator = 1n
      const result = (await uints.methods.bigMulDivUp256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 0n, lower: 2n }, error: 0n })
    }
    {
      const a = MaxU256
      const b = 2n
      const bDenominator = 1n
      const result = (await uints.methods.bigMulDivUp256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 1n, lower: MaxU256 - 1n }, error: 0n })
    }
    {
      const a = MaxU256
      const b = MaxU256
      const bDenominator = 1n
      const result = (await uints.methods.bigMulDivUp256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({
        value: {
          higher: MaxU256 - 1n,
          lower: 1n
        },
        error: 0n
      })
    }
    {
      const a = MaxU256
      const b = 0n
      const bDenominator = 1n
      const result = (await uints.methods.bigMulDivUp256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 0n, lower: 0n }, error: 0n })
    }
    {
      const a = 0n
      const b = 0n
      const bDenominator = 1n
      const result = (await uints.methods.bigMulDivUp256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 0n, lower: 0n }, error: 0n })
    }
    {
      const a = 100n
      const b = 200n
      const bDenominator = 100n
      const result = (await uints.methods.bigMulDivUp256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 0n, lower: 200n }, error: 0n })
    }
    {
      const a = 1n
      const b = 150n
      const bDenominator = 100n
      const result = (await uints.methods.bigMulDivUp256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ value: { higher: 0n, lower: 2n }, error: 0n })
    }
    {
      const a = MaxU256
      const b = MaxU256
      const bDenominator = MaxU256
      const result = (await uints.methods.bigMulDivUp256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({
        value: {
          higher: 0n,
          lower: MaxU256
        },
        error: 0n
      })
    }
  })

  test('big mul div up 256 returns an error if b denominator is zero', async () => {
    {
      const a = 1n
      const b = 1n
      const bDenominator = 0n
      const result = (await uints.methods.bigMulDivUp256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({
        value: { higher: MaxU256, lower: MaxU256 },
        error: ArithmeticError.MulNotPositiveDenominator
      })
    }
  })

  test('overflowing add', async () => {
    {
      const a = 1n
      const b = 2n
      const result = (await uints.methods.overflowingAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual([3n, 0n])
    }
    {
      const a = MaxU256
      const b = 2n
      const result = (await uints.methods.overflowingAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual([1n, 1n])
    }
    {
      const a = MaxU256
      const b = MaxU256
      const result = (await uints.methods.overflowingAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual([MaxU256 - 1n, 1n])
    }
    {
      const a = MaxU256
      const b = 0n
      const result = (await uints.methods.overflowingAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual([MaxU256, 0n])
    }
    {
      const a = MaxU256
      const b = 1n
      const result = (await uints.methods.overflowingAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual([0n, 1n])
    }
  })

  test('wrapping add', async () => {
    {
      const a = 1n
      const b = 2n
      const result = (await uints.methods.wrappingAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual(3n)
    }
    {
      const a = MaxU256
      const b = 2n
      const result = (await uints.methods.wrappingAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual(1n)
    }
    {
      const a = MaxU256
      const b = MaxU256
      const result = (await uints.methods.wrappingAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual(MaxU256 - 1n)
    }
    {
      const a = MaxU256
      const b = 0n
      const result = (await uints.methods.wrappingAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual(MaxU256)
    }
    {
      const a = MaxU256
      const b = 1n
      const result = (await uints.methods.wrappingAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual(0n)
    }
  })
})
