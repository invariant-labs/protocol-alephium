import { ONE_ALPH, SignerProvider, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { expectError, expectVMError } from '../src/testUtils'
import { ArithmeticError, MaxU256, VMError } from '../src/consts'
import { CLAMMInstance } from '../artifacts/ts'
import { deployCLAMM } from '../src/utils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

describe('clamm tests', () => {
  let sender: SignerProvider
  let clamm: CLAMMInstance

  beforeAll(async () => {
    sender = await getSigner(ONE_ALPH * 100000n, 0)
    clamm = await deployCLAMM(sender)
  })

  test('to u256 works', async () => {
    const value = { higher: 0n, lower: 1n }
    const result = (await clamm.methods.toU256({ args: { value } })).returns

    expect(result).toEqual(value.lower)
  })

  test('to u256 returns an error if number is higher than u256', async () => {
    const value = { higher: 2n, lower: 1n }
    await expectError(
      ArithmeticError.CastOverflow,
      clamm.methods.toU256({ args: { value } }),
      clamm
    )
  })

  test('to u512 works', async () => {
    const value = 1n
    const result = (await clamm.methods.toU512({ args: { value } })).returns
    expect(result).toEqual({ higher: 0n, lower: value })
  })

  test('Big number division', async () => {
    {
      const a = {
        higher: 65535383919253714999999999999n,
        lower: 115792089237316195423570985008687907853269984665575028655538330292913129639936n
      }
      const b = { higher: 0n, lower: 10n ** 5n }
      const result = (
        await clamm.methods.bigDiv512({ args: { dividend: a, divisor: b, divisorDenominator: 1n } })
      ).returns
      expect(result).toStrictEqual({
        higher: 655353839192537149999999n,
        lower: 115792089237316195423570985008687907853269984665640563384103744815375979639936n
      })
    }
    {
      const a = {
        higher: 65535383919253714999999999999n,
        lower: 115792089237316195423570985008687907853269984665575028655538330292913129639936n
      }
      const b = { higher: 1n, lower: 0n }
      const result = (
        await clamm.methods.bigDiv512({ args: { dividend: a, divisor: b, divisorDenominator: 1n } })
      ).returns
      expect(result).toStrictEqual({
        higher: 0n,
        lower: 65535383919253714999999999999n
      })
    }
    {
      const a = {
        higher: 65535383919253714999999999999n,
        lower: 115792089237316195423570985008687907853269984665575028655538330292913129639936n
      }
      const b = { higher: MaxU256, lower: MaxU256 }
      const result = (
        await clamm.methods.bigDiv512({ args: { dividend: a, divisor: b, divisorDenominator: 1n } })
      ).returns
      expect(result).toStrictEqual({
        higher: 0n,
        lower: 0n
      })
    }
  })

  test('bigShl', async () => {
    {
      const v = { higher: 0n, lower: 1n }
      const n = 1n
      const result = (await clamm.methods.bigShl({ args: { v, n } })).returns
      expect(result).toEqual({ higher: 0n, lower: 2n })
    }
    {
      const v = { higher: 0n, lower: 1n }
      const n = 257n
      const result = (await clamm.methods.bigShl({ args: { v, n } })).returns
      expect(result).toEqual({ higher: 2n, lower: 0n })
    }
    {
      const v = { higher: 1n, lower: 4n }
      const n = 1n
      const result = (await clamm.methods.bigShl({ args: { v, n } })).returns
      expect(result).toEqual({ higher: 2n, lower: 8n })
    }
    {
      const v = { higher: MaxU256, lower: MaxU256 }
      const n = 1n
      const result = (await clamm.methods.bigShl({ args: { v, n } })).returns
      expect(result).toEqual({ higher: MaxU256, lower: MaxU256 - 1n })
    }
  })

  test('isGreaterEqual', async () => {
    {
      const v = { higher: 0n, lower: 1n }
      const compareTo = { higher: 0n, lower: 1n }
      const result = (await clamm.methods.isGreaterEqual({ args: { v, compareTo } })).returns
      expect(result).toEqual(true)
    }
    {
      const v = { higher: 1n, lower: 1n }
      const compareTo = { higher: 1n, lower: 1n }
      const result = (await clamm.methods.isGreaterEqual({ args: { v, compareTo } })).returns
      expect(result).toEqual(true)
    }
    {
      const v = { higher: 0n, lower: 1n }
      const compareTo = { higher: 1n, lower: 0n }
      const result = (await clamm.methods.isGreaterEqual({ args: { v, compareTo } })).returns
      expect(result).toEqual(false)
    }
    {
      const v = { higher: 2n, lower: 3n }
      const compareTo = { higher: 2n, lower: 2n }
      const result = (await clamm.methods.isGreaterEqual({ args: { v, compareTo } })).returns
      expect(result).toEqual(true)
    }
    {
      const v = { higher: 3n, lower: 1n }
      const compareTo = { higher: 0n, lower: 1n }
      const result = (await clamm.methods.isGreaterEqual({ args: { v, compareTo } })).returns
      expect(result).toEqual(true)
    }
    {
      const v = { higher: 3n, lower: 0n }
      const compareTo = { higher: 3n, lower: 0n }
      const result = (await clamm.methods.isGreaterEqual({ args: { v, compareTo } })).returns
      expect(result).toEqual(true)
    }
    {
      const v = { higher: 3n, lower: 0n }
      const compareTo = { higher: 3n, lower: 1n }
      const result = (await clamm.methods.isGreaterEqual({ args: { v, compareTo } })).returns
      expect(result).toEqual(false)
    }
  })

  test('big add 256', async () => {
    {
      const a = 1n
      const b = 2n
      const result = (await clamm.methods.bigAdd256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 3n })
    }
    {
      const a = MaxU256
      const b = 2n
      const result = (await clamm.methods.bigAdd256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: 1n })
    }
    {
      const a = MaxU256
      const b = MaxU256
      const result = (await clamm.methods.bigAdd256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: a - 1n })
    }
  })

  test('new big add 256', async () => {
    {
      const a = 1n
      const b = 2n
      const result = (await clamm.methods.newBigAdd256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 3n })
    }
    {
      const a = MaxU256
      const b = 2n
      const result = (await clamm.methods.newBigAdd256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: 1n })
    }
    {
      const a = MaxU256
      const b = MaxU256
      const result = (await clamm.methods.newBigAdd256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: a - 1n })
    }
  })

  test('big add 256 vs new big add 256 comparison', async () => {
    {
      const a = MaxU256
      const b = MaxU256
      const oldResult = await clamm.methods.bigAdd256({ args: { a, b } })
      const newResult = await clamm.methods.newBigAdd256({ args: { a, b } })
      console.log('big add 256', oldResult.gasUsed, newResult.gasUsed)
    }
  })

  test('big add', async () => {
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const result = (await clamm.methods.bigAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 3n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = 2n
      const result = (await clamm.methods.bigAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: 1n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = MaxU256
      const result = (await clamm.methods.bigAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: a.lower - 1n })
    }
    {
      const a = { higher: MaxU256, lower: 0n }
      const b = MaxU256
      const result = (await clamm.methods.bigAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual({
        higher: MaxU256,
        lower: MaxU256
      })
    }
  })

  test('new big add', async () => {
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const result = (await clamm.methods.newBigAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 3n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = 2n
      const result = (await clamm.methods.newBigAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: 1n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = MaxU256
      const result = (await clamm.methods.newBigAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: a.lower - 1n })
    }
    {
      const a = { higher: MaxU256, lower: 0n }
      const b = MaxU256
      const result = (await clamm.methods.newBigAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual({
        higher: MaxU256,
        lower: MaxU256
      })
    }
  })

  test('big add vs new big add comparison', async () => {
    {
      const a = { higher: MaxU256, lower: 0n }
      const b = MaxU256
      const oldResult = await clamm.methods.bigAdd({ args: { a, b } })
      const newResult = await clamm.methods.newBigAdd({ args: { a, b } })
      console.log('big add', oldResult.gasUsed, newResult.gasUsed)
    }
  })

  test('big sub 512', async () => {
    {
      const a = { higher: 1n, lower: 0n }
      const b = { higher: 0n, lower: 1n }
      const result = (await clamm.methods.bigSub512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: MaxU256 })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = { higher: 0n, lower: 1n }
      const result = (await clamm.methods.bigSub512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = { higher: 1n, lower: 0n }
      await expectError(
        ArithmeticError.SubUnderflow,
        clamm.methods.bigSub512({ args: { a, b } }),
        clamm
      )
    }
    {
      const a = { higher: 1n, lower: 0n }
      const b = { higher: 1n, lower: 0n }
      const result = (await clamm.methods.bigSub512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = { higher: MaxU256, lower: 0n }
      const b = { higher: 1n, lower: 0n }
      const result = (await clamm.methods.bigSub512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: MaxU256 - 1n, lower: 0n })
    }
    {
      const a = { higher: MaxU256, lower: 0n }
      const b = { higher: 0n, lower: MaxU256 }
      const result = (await clamm.methods.bigSub512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: MaxU256 - 1n, lower: 1n })
    }
    {
      const a = { higher: MaxU256, lower: 0n }
      const b = { higher: MaxU256, lower: 0n }
      const result = (await clamm.methods.bigSub512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = { higher: 1n, lower: 0n }
      const b = { higher: 1n, lower: 1n }
      await expectError(
        ArithmeticError.SubUnderflow,
        clamm.methods.bigSub512({ args: { a, b } }),
        clamm
      )
    }
  })

  test('new big sub 512', async () => {
    {
      const a = { higher: 1n, lower: 0n }
      const b = { higher: 0n, lower: 1n }
      const result = (await clamm.methods.newBigSub512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: MaxU256 })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = { higher: 0n, lower: 1n }
      const result = (await clamm.methods.newBigSub512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = { higher: 1n, lower: 0n }
      await expectVMError(VMError.ArithmeticError, clamm.methods.newBigSub512({ args: { a, b } }))
    }
    {
      const a = { higher: 1n, lower: 0n }
      const b = { higher: 1n, lower: 0n }
      const result = (await clamm.methods.newBigSub512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = { higher: MaxU256, lower: 0n }
      const b = { higher: 1n, lower: 0n }
      const result = (await clamm.methods.newBigSub512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: MaxU256 - 1n, lower: 0n })
    }
    {
      const a = { higher: MaxU256, lower: 0n }
      const b = { higher: 0n, lower: MaxU256 }
      const result = (await clamm.methods.newBigSub512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: MaxU256 - 1n, lower: 1n })
    }
    {
      const a = { higher: MaxU256, lower: 0n }
      const b = { higher: MaxU256, lower: 0n }
      const result = (await clamm.methods.newBigSub512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = { higher: 1n, lower: 0n }
      const b = { higher: 1n, lower: 1n }
      await expectVMError(VMError.ArithmeticError, clamm.methods.newBigSub512({ args: { a, b } }))
    }
  })

  test('big sub 512 vs new big sub 512 comparison', async () => {
    {
      const a = { higher: MaxU256, lower: MaxU256 }
      const b = { higher: MaxU256, lower: MaxU256 }
      const oldResult = await clamm.methods.bigSub512({ args: { a, b } })
      const newResult = await clamm.methods.newBigSub512({ args: { a, b } })
      console.log('big sub 512', oldResult.gasUsed, newResult.gasUsed)
    }
  })

  test('big add returns an error if number if higher than u512', async () => {
    {
      const a = {
        higher: MaxU256,
        lower: MaxU256
      }
      const b = 1n
      await expectError(
        ArithmeticError.AddOverflow,
        clamm.methods.bigAdd({ args: { a, b } }),
        clamm
      )
    }
    {
      const a = {
        higher: MaxU256,
        lower: 1n
      }
      const b = MaxU256
      await expectError(
        ArithmeticError.AddOverflow,
        clamm.methods.bigAdd({ args: { a, b } }),
        clamm
      )
    }
  })

  test('big add 512', async () => {
    {
      const a = { higher: 0n, lower: 1n }
      const b = { higher: 0n, lower: 2n }
      const result = (await clamm.methods.bigAdd512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 3n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = { higher: 0n, lower: 2n }
      const result = (await clamm.methods.bigAdd512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: 1n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = { higher: 0n, lower: MaxU256 }
      const result = (await clamm.methods.bigAdd512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: a.lower - 1n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = {
        higher: MaxU256,
        lower: 0n
      }
      const result = (await clamm.methods.bigAdd512({ args: { a, b } })).returns
      expect(result).toStrictEqual({
        higher: MaxU256,
        lower: MaxU256
      })
    }
  })

  test('new big add 512', async () => {
    {
      const a = { higher: 0n, lower: 1n }
      const b = { higher: 0n, lower: 2n }
      const result = (await clamm.methods.newBigAdd512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 3n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = { higher: 0n, lower: 2n }
      const result = (await clamm.methods.newBigAdd512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: 1n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = { higher: 0n, lower: MaxU256 }
      const result = (await clamm.methods.newBigAdd512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: a.lower - 1n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = {
        higher: MaxU256,
        lower: 0n
      }
      const result = (await clamm.methods.newBigAdd512({ args: { a, b } })).returns
      expect(result).toStrictEqual({
        higher: MaxU256,
        lower: MaxU256
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
      await expectError(
        ArithmeticError.AddOverflow,
        clamm.methods.bigAdd512({ args: { a, b } }),
        clamm
      )
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
      await expectError(
        ArithmeticError.AddOverflow,
        clamm.methods.bigAdd512({ args: { a, b } }),
        clamm
      )
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
      await expectError(
        ArithmeticError.AddOverflow,
        clamm.methods.bigAdd512({ args: { a, b } }),
        clamm
      )
    }
  })

  test('new big add 512 returns an error if number if higher than u512', async () => {
    {
      const a = {
        higher: MaxU256,
        lower: MaxU256
      }
      const b = {
        higher: 0n,
        lower: 1n
      }
      await expectVMError(VMError.ArithmeticError, clamm.methods.newBigAdd512({ args: { a, b } }))
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
      await expectVMError(VMError.ArithmeticError, clamm.methods.newBigAdd512({ args: { a, b } }))
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
      await expectVMError(VMError.ArithmeticError, clamm.methods.newBigAdd512({ args: { a, b } }))
    }
  })

  test('big add 512 vs new big add 512 comparison', async () => {
    {
      const a = { higher: MaxU256, lower: 0n }
      const b = { higher: 0n, lower: MaxU256 }
      const oldResult = await clamm.methods.bigAdd512({ args: { a, b } })
      const newResult = await clamm.methods.newBigAdd512({ args: { a, b } })
      console.log('big add 512', oldResult.gasUsed, newResult.gasUsed)
    }
  })

  test('big div', async () => {
    {
      const a = { higher: 0n, lower: 2n }
      const b = 1n
      const bDenominator = 1n
      const result = (await clamm.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = { higher: 0n, lower: 2n }
      const b = 2n
      const bDenominator = 1n
      const result = (await clamm.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 1n })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const bDenominator = 1n
      const result = (await clamm.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = { higher: 1n, lower: 0n }
      const b = 1n
      const bDenominator = 1n
      const result = (await clamm.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: 0n })
    }
    {
      const a = { higher: 20n, lower: 20n }
      const b = 10n
      const bDenominator = 1n
      const result = (await clamm.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 2n, lower: 2n })
    }
    {
      const a = { higher: MaxU256, lower: MaxU256 }
      const b = MaxU256
      const bDenominator = 1n
      const result = (await clamm.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({
        higher: 0n,
        lower: 115792089237316195423570985008687907853269984665640564039457584007913129639935n
      })
    }
    {
      const a = { higher: MaxU256, lower: 0n }
      const b = MaxU256
      const bDenominator = 1n
      const result = (await clamm.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({
        higher: 0n,
        lower: 115792089237316195423570985008687907853269984665640564039457584007913129639935n
      })
    }
    {
      const a = { higher: 0n, lower: 2n }
      const b = 10n
      const bDenominator = 10n
      const result = (await clamm.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const bDenominator = 10n
      const result = (await clamm.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 5n })
    }
    {
      const a = { higher: 0n, lower: 0n }
      const b = MaxU256
      const bDenominator = 1n
      const result = (await clamm.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = { higher: MaxU256, lower: MaxU256 }
      const b = 1n
      const bDenominator = 100n
      await expectError(
        ArithmeticError.CastOverflow,
        clamm.methods.bigDiv({ args: { a, b, bDenominator } }),
        clamm
      )
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const bDenominator = 1n
      const result = (await clamm.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
  })

  test('new big div', async () => {
    {
      const a = { higher: 0n, lower: 2n }
      const b = 1n
      const bDenominator = 1n
      const result = (await clamm.methods.newBigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = { higher: 0n, lower: 2n }
      const b = 2n
      const bDenominator = 1n
      const result = (await clamm.methods.newBigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 1n })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const bDenominator = 1n
      const result = (await clamm.methods.newBigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = { higher: 1n, lower: 0n }
      const b = 1n
      const bDenominator = 1n
      const result = (await clamm.methods.newBigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: 0n })
    }
    {
      const a = { higher: 20n, lower: 20n }
      const b = 10n
      const bDenominator = 1n
      const result = (await clamm.methods.newBigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 2n, lower: 2n })
    }
    {
      const a = { higher: MaxU256, lower: MaxU256 }
      const b = MaxU256
      const bDenominator = 1n
      const result = (await clamm.methods.newBigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({
        higher: 1n,
        lower: 1n
      })
    }
    {
      const a = { higher: MaxU256, lower: 0n }
      const b = MaxU256
      const bDenominator = 1n
      const result = (await clamm.methods.newBigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({
        higher: 1n,
        lower: 0n
      })
    }
    {
      const a = { higher: 0n, lower: 2n }
      const b = 10n
      const bDenominator = 10n
      const result = (await clamm.methods.newBigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const bDenominator = 10n
      const result = (await clamm.methods.newBigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 5n })
    }
    {
      const a = { higher: 0n, lower: 0n }
      const b = MaxU256
      const bDenominator = 1n
      const result = (await clamm.methods.newBigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = { higher: MaxU256, lower: MaxU256 }
      const b = 1n
      const bDenominator = 100n
      await expectError(
        ArithmeticError.CastOverflow,
        clamm.methods.newBigDiv({ args: { a, b, bDenominator } }),
        clamm
      )
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const bDenominator = 1n
      const result = (await clamm.methods.newBigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
  })

  test('big div vs new big div comparison', async () => {
    {
      const a = { higher: MaxU256, lower: MaxU256 }
      const b = MaxU256 - 1n
      const bDenominator = 1n
      const oldResult = await clamm.methods.bigDiv({ args: { a, b, bDenominator } })
      const newResult = await clamm.methods.newBigDiv({ args: { a, b, bDenominator } })
      console.log('big div', oldResult.gasUsed, newResult.gasUsed)
    }
  })

  test('big div return error when dividing by zero or b denominator is zero', async () => {
    {
      const a = { higher: 0n, lower: 2n }
      const b = 0n
      const bDenominator = 1n
      await expectError(
        ArithmeticError.DivNotPositiveDivisor,
        clamm.methods.newBigDiv({ args: { a, b, bDenominator } }),
        clamm
      )
    }
    {
      const a = { higher: 0n, lower: 2n }
      const b = 1n
      const bDenominator = 0n
      await expectError(
        ArithmeticError.DivNotPositiveDenominator,
        clamm.methods.newBigDiv({ args: { a, b, bDenominator } }),
        clamm
      )
    }
  })

  test('new big div return error when dividing by zero or b denominator is zero', async () => {
    {
      const a = { higher: 0n, lower: 2n }
      const b = 0n
      const bDenominator = 1n
      await expectError(
        ArithmeticError.DivNotPositiveDivisor,
        clamm.methods.bigDiv({ args: { a, b, bDenominator } }),
        clamm
      )
    }
    {
      const a = { higher: 0n, lower: 2n }
      const b = 1n
      const bDenominator = 0n
      await expectError(
        ArithmeticError.DivNotPositiveDenominator,
        clamm.methods.bigDiv({ args: { a, b, bDenominator } }),
        clamm
      )
    }
  })

  test('big div up', async () => {
    {
      const a = { higher: 0n, lower: 2n }
      const b = 1n
      const bDenominator = 1n
      const result = (await clamm.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = { higher: 0n, lower: 2n }
      const b = 2n
      const bDenominator = 1n
      const result = (await clamm.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 1n })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const bDenominator = 1n
      const result = (await clamm.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 1n })
    }
    {
      const a = { higher: 1n, lower: 0n }
      const b = 1n
      const bDenominator = 1n
      const result = (await clamm.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: 0n })
    }
    {
      const a = { higher: 20n, lower: 20n }
      const b = 10n
      const bDenominator = 1n
      const result = (await clamm.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 2n, lower: 2n })
    }
    {
      const a = { higher: MaxU256, lower: MaxU256 }
      const b = MaxU256
      const bDenominator = 1n
      await expectError(
        ArithmeticError.AddOverflow,
        clamm.methods.bigDivUp({ args: { a, b, bDenominator } }),
        clamm
      )
    }
    {
      const a = { higher: MaxU256, lower: 0n }
      const b = MaxU256
      const bDenominator = 1n
      const result = (await clamm.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({
        higher: 0n,
        lower: 115792089237316195423570985008687907853269984665640564039457584007913129639935n
      })
    }
    {
      const a = { higher: 0n, lower: 2n }
      const b = 10n
      const bDenominator = 10n
      const result = (await clamm.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const bDenominator = 10n
      const result = (await clamm.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 5n })
    }
    {
      const a = { higher: 0n, lower: 0n }
      const b = MaxU256
      const bDenominator = 1n
      const result = (await clamm.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const bDenominator = 1n
      const result = (await clamm.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 1n })
    }
  })

  test('new big div up', async () => {
    {
      const a = { higher: 0n, lower: 2n }
      const b = 1n
      const bDenominator = 1n
      const result = (await clamm.methods.newBigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = { higher: 0n, lower: 2n }
      const b = 2n
      const bDenominator = 1n
      const result = (await clamm.methods.newBigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 1n })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const bDenominator = 1n
      const result = (await clamm.methods.newBigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 1n })
    }
    {
      const a = { higher: 1n, lower: 0n }
      const b = 1n
      const bDenominator = 1n
      const result = (await clamm.methods.newBigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: 0n })
    }
    {
      const a = { higher: 20n, lower: 20n }
      const b = 10n
      const bDenominator = 1n
      const result = (await clamm.methods.newBigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 2n, lower: 2n })
    }
    {
      const a = { higher: MaxU256, lower: MaxU256 }
      const b = MaxU256
      const bDenominator = 1n
      await expectVMError(
        VMError.ArithmeticError,
        clamm.methods.newBigDivUp({ args: { a, b, bDenominator } })
      )
    }
    {
      const a = { higher: MaxU256, lower: 0n }
      const b = MaxU256
      const bDenominator = 1n
      const result = (await clamm.methods.newBigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({
        higher: 1n,
        lower: 0n
      })
    }
    {
      const a = { higher: 0n, lower: 2n }
      const b = 10n
      const bDenominator = 10n
      const result = (await clamm.methods.newBigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const bDenominator = 10n
      const result = (await clamm.methods.newBigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 5n })
    }
    {
      const a = { higher: 0n, lower: 0n }
      const b = MaxU256
      const bDenominator = 1n
      const result = (await clamm.methods.newBigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const bDenominator = 1n
      const result = (await clamm.methods.newBigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 1n })
    }
  })

  test('big div up vs new big div up comparison', async () => {
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = MaxU256
      const bDenominator = 1n
      const oldResult = await clamm.methods.bigDivUp({ args: { a, b, bDenominator } })
      const newResult = await clamm.methods.newBigDivUp({ args: { a, b, bDenominator } })
      console.log('big div', oldResult.gasUsed, newResult.gasUsed)
    }
  })

  test('big div up return error when dividing by zero or b denominator is zero', async () => {
    {
      const a = { higher: 0n, lower: 2n }
      const b = 0n
      const bDenominator = 1n
      await expectError(
        ArithmeticError.DivNotPositiveDivisor,
        clamm.methods.bigDivUp({ args: { a, b, bDenominator } }),
        clamm
      )
    }
    {
      const a = { higher: 0n, lower: 2n }
      const b = 1n
      const bDenominator = 0n
      await expectError(
        ArithmeticError.DivNotPositiveDenominator,
        clamm.methods.bigDivUp({ args: { a, b, bDenominator } }),
        clamm
      )
    }
  })

  test('new big div up return error when dividing by zero or b denominator is zero', async () => {
    {
      const a = { higher: 0n, lower: 2n }
      const b = 0n
      const bDenominator = 1n
      await expectVMError(
        VMError.ArithmeticError,
        clamm.methods.newBigDivUp({ args: { a, b, bDenominator } })
      )
    }
    {
      const a = { higher: 0n, lower: 2n }
      const b = 1n
      const bDenominator = 0n
      await expectError(
        ArithmeticError.DivNotPositiveDenominator,
        clamm.methods.newBigDivUp({ args: { a, b, bDenominator } }),
        clamm
      )
    }
  })

  test('big mul 256', async () => {
    {
      const a = 1n
      const b = 2n
      const result = (await clamm.methods.bigMul256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = MaxU256
      const b = 2n
      const result = (await clamm.methods.bigMul256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: MaxU256 - 1n })
    }
    {
      const a = MaxU256
      const b = MaxU256
      const result = (await clamm.methods.bigMul256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: MaxU256 - 1n, lower: 1n })
    }
    {
      const a = MaxU256
      const b = 0n
      const result = (await clamm.methods.bigMul256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = 0n
      const b = 0n
      const result = (await clamm.methods.bigMul256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
  })

  test('new big mul 256', async () => {
    {
      const a = 1n
      const b = 2n
      const result = (await clamm.methods.newBigMul256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = MaxU256
      const b = 2n
      const result = (await clamm.methods.newBigMul256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: MaxU256 - 1n })
    }
    {
      const a = MaxU256
      const b = MaxU256
      const result = (await clamm.methods.newBigMul256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: MaxU256 - 1n, lower: 1n })
    }
    {
      const a = MaxU256
      const b = 0n
      const result = (await clamm.methods.newBigMul256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = 0n
      const b = 0n
      const result = (await clamm.methods.newBigMul256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
  })

  test('big mul 256 vs new big mul 256 comparison', async () => {
    {
      const a = MaxU256
      const b = MaxU256
      const oldResult = await clamm.methods.bigMul256({ args: { a, b } })
      const newResult = await clamm.methods.newBigMul256({ args: { a, b } })
      console.log('big mul 256', oldResult.gasUsed, newResult.gasUsed)
    }
  })

  test('big mul', async () => {
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const result = (await clamm.methods.bigMul({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = 2n
      const result = (await clamm.methods.bigMul({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: MaxU256 - 1n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = MaxU256
      const result = (await clamm.methods.bigMul({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: MaxU256 - 1n, lower: 1n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = 0n
      const result = (await clamm.methods.bigMul({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = { higher: 0n, lower: 0n }
      const b = 0n
      const result = (await clamm.methods.bigMul({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
  })

  test('new big mul', async () => {
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const result = (await clamm.methods.newBigMul({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = 2n
      const result = (await clamm.methods.newBigMul({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: MaxU256 - 1n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = MaxU256
      const result = (await clamm.methods.newBigMul({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: MaxU256 - 1n, lower: 1n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = 0n
      const result = (await clamm.methods.newBigMul({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = { higher: 0n, lower: 0n }
      const b = 0n
      const result = (await clamm.methods.newBigMul({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
  })

  test('big mul vs new big mul comparison', async () => {
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = MaxU256
      const oldResult = await clamm.methods.bigMul({ args: { a, b } })
      const newResult = await clamm.methods.newBigMul({ args: { a, b } })
      console.log('big mul', oldResult.gasUsed, newResult.gasUsed)
    }
  })

  test('big mul returns an error if number is higher than u512', async () => {
    {
      const a = { higher: MaxU256, lower: MaxU256 }
      const b = 2n
      await expectError(
        ArithmeticError.CastOverflow,
        clamm.methods.bigMul({ args: { a, b } }),
        clamm
      )
    }
    {
      const a = { higher: MaxU256, lower: 1n }
      const b = MaxU256
      await expectError(
        ArithmeticError.CastOverflow,
        clamm.methods.bigMul({ args: { a, b } }),
        clamm
      )
    }
    {
      const a = { higher: MaxU256 - 1n, lower: MaxU256 }
      const b = MaxU256
      await expectError(
        ArithmeticError.CastOverflow,
        clamm.methods.bigMul({ args: { a, b } }),
        clamm
      )
    }
    {
      const a = { higher: MaxU256, lower: MaxU256 }
      const b = MaxU256
      await expectError(
        ArithmeticError.CastOverflow,
        clamm.methods.bigMul({ args: { a, b } }),
        clamm
      )
    }
  })

  test('new big mul returns an error if number is higher than u512', async () => {
    {
      const a = { higher: MaxU256, lower: MaxU256 }
      const b = 2n
      await expectError(
        ArithmeticError.CastOverflow,
        clamm.methods.newBigMul({ args: { a, b } }),
        clamm
      )
    }
    {
      const a = { higher: MaxU256, lower: 1n }
      const b = MaxU256
      await expectError(
        ArithmeticError.CastOverflow,
        clamm.methods.newBigMul({ args: { a, b } }),
        clamm
      )
    }
    {
      const a = { higher: MaxU256 - 1n, lower: MaxU256 }
      const b = MaxU256
      await expectError(
        ArithmeticError.CastOverflow,
        clamm.methods.newBigMul({ args: { a, b } }),
        clamm
      )
    }
    {
      const a = { higher: MaxU256, lower: MaxU256 }
      const b = MaxU256
      await expectError(
        ArithmeticError.CastOverflow,
        clamm.methods.newBigMul({ args: { a, b } }),
        clamm
      )
    }
  })

  test('big mul div 256', async () => {
    {
      const a = 1n
      const b = 2n
      const bDenominator = 1n
      const result = (await clamm.methods.bigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = MaxU256
      const b = 2n
      const bDenominator = 1n
      const result = (await clamm.methods.bigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: MaxU256 - 1n })
    }
    {
      const a = MaxU256
      const b = MaxU256
      const bDenominator = 1n
      const result = (await clamm.methods.bigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({
        higher: MaxU256 - 1n,
        lower: 1n
      })
    }
    {
      const a = MaxU256
      const b = 0n
      const bDenominator = 1n
      const result = (await clamm.methods.bigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = 0n
      const b = 0n
      const bDenominator = 1n
      const result = (await clamm.methods.bigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = 100n
      const b = 200n
      const bDenominator = 100n
      const result = (await clamm.methods.bigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 200n })
    }
    {
      const a = 1n
      const b = 150n
      const bDenominator = 100n
      const result = (await clamm.methods.bigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 1n })
    }
    {
      const a = MaxU256
      const b = MaxU256
      const bDenominator = MaxU256
      const result = (await clamm.methods.bigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: MaxU256 - 1n })
    }
  })

  test('new big mul div 256', async () => {
    {
      const a = 1n
      const b = 2n
      const bDenominator = 1n
      const result = (await clamm.methods.newBigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = MaxU256
      const b = 2n
      const bDenominator = 1n
      const result = (await clamm.methods.newBigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: MaxU256 - 1n })
    }
    {
      const a = MaxU256
      const b = MaxU256
      const bDenominator = 1n
      const result = (await clamm.methods.newBigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({
        higher: MaxU256 - 1n,
        lower: 1n
      })
    }
    {
      const a = MaxU256
      const b = 0n
      const bDenominator = 1n
      const result = (await clamm.methods.newBigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = 0n
      const b = 0n
      const bDenominator = 1n
      const result = (await clamm.methods.newBigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = 100n
      const b = 200n
      const bDenominator = 100n
      const result = (await clamm.methods.newBigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 200n })
    }
    {
      const a = 1n
      const b = 150n
      const bDenominator = 100n
      const result = (await clamm.methods.newBigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 1n })
    }
    {
      const a = MaxU256
      const b = MaxU256
      const bDenominator = MaxU256
      const result = (await clamm.methods.newBigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: MaxU256 })
    }
  })

  test('big mul div 256 vs new big mul div 256 comparison', async () => {
    {
      const a = MaxU256
      const b = MaxU256
      const bDenominator = 1n
      const oldResult = await clamm.methods.bigMulDiv256({ args: { a, b, bDenominator } })
      const newResult = await clamm.methods.newBigMulDiv256({ args: { a, b, bDenominator } })
      console.log('big mul div 256', oldResult.gasUsed, newResult.gasUsed)
    }
  })

  test('big mul div 256 returns an error if b denominator is zero', async () => {
    {
      const a = 1n
      const b = 1n
      const bDenominator = 0n
      await expectError(
        ArithmeticError.MulNotPositiveDenominator,
        clamm.methods.bigMulDiv256({ args: { a, b, bDenominator } }),
        clamm
      )
    }
  })

  test('new big mul div 256 returns an error if b denominator is zero', async () => {
    {
      const a = 1n
      const b = 1n
      const bDenominator = 0n
      await expectError(
        ArithmeticError.MulNotPositiveDenominator,
        clamm.methods.newBigMulDiv256({ args: { a, b, bDenominator } }),
        clamm
      )
    }
  })

  test('big mul div up 256', async () => {
    {
      const a = 1n
      const b = 2n
      const bDenominator = 1n
      const result = (await clamm.methods.bigMulDivUp256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = MaxU256
      const b = 2n
      const bDenominator = 1n
      const result = (await clamm.methods.bigMulDivUp256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: MaxU256 - 1n })
    }
    {
      const a = MaxU256
      const b = MaxU256
      const bDenominator = 1n
      const result = (await clamm.methods.bigMulDivUp256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({
        higher: MaxU256 - 1n,
        lower: 1n
      })
    }
    {
      const a = MaxU256
      const b = 0n
      const bDenominator = 1n
      const result = (await clamm.methods.bigMulDivUp256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = 0n
      const b = 0n
      const bDenominator = 1n
      const result = (await clamm.methods.bigMulDivUp256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = 100n
      const b = 200n
      const bDenominator = 100n
      const result = (await clamm.methods.bigMulDivUp256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 200n })
    }
    {
      const a = 1n
      const b = 150n
      const bDenominator = 100n
      const result = (await clamm.methods.bigMulDivUp256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = MaxU256
      const b = MaxU256
      const bDenominator = MaxU256
      const result = (await clamm.methods.bigMulDivUp256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({
        higher: 0n,
        lower: 115792089237316195423570985008687907853269984665640564039457584007913129639934n
      })
    }
  })

  test('new big mul div up 256', async () => {
    {
      const a = 1n
      const b = 2n
      const bDenominator = 1n
      const result = (await clamm.methods.newBigMulDivUp256({ args: { a, b, bDenominator } }))
        .returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = MaxU256
      const b = 2n
      const bDenominator = 1n
      const result = (await clamm.methods.newBigMulDivUp256({ args: { a, b, bDenominator } }))
        .returns
      expect(result).toStrictEqual({ higher: 1n, lower: MaxU256 - 1n })
    }
    {
      const a = MaxU256
      const b = MaxU256
      const bDenominator = 1n
      const result = (await clamm.methods.newBigMulDivUp256({ args: { a, b, bDenominator } }))
        .returns
      expect(result).toStrictEqual({
        higher: MaxU256 - 1n,
        lower: 1n
      })
    }
    {
      const a = MaxU256
      const b = 0n
      const bDenominator = 1n
      const result = (await clamm.methods.newBigMulDivUp256({ args: { a, b, bDenominator } }))
        .returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = 0n
      const b = 0n
      const bDenominator = 1n
      const result = (await clamm.methods.newBigMulDivUp256({ args: { a, b, bDenominator } }))
        .returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = 100n
      const b = 200n
      const bDenominator = 100n
      const result = (await clamm.methods.newBigMulDivUp256({ args: { a, b, bDenominator } }))
        .returns
      expect(result).toStrictEqual({ higher: 0n, lower: 200n })
    }
    {
      const a = 1n
      const b = 150n
      const bDenominator = 100n
      const result = (await clamm.methods.newBigMulDivUp256({ args: { a, b, bDenominator } }))
        .returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = MaxU256
      const b = MaxU256
      const bDenominator = MaxU256
      const result = (await clamm.methods.newBigMulDivUp256({ args: { a, b, bDenominator } }))
        .returns
      expect(result).toStrictEqual({
        higher: 0n,
        lower: MaxU256
      })
    }
  })

  test('big mul div up 256 vs new big mul div up 256 comparison', async () => {
    {
      const a = MaxU256
      const b = MaxU256
      const bDenominator = 1n
      const oldResult = await clamm.methods.bigMulDivUp256({ args: { a, b, bDenominator } })
      const newResult = await clamm.methods.newBigMulDivUp256({ args: { a, b, bDenominator } })
      console.log('big mul div up 256', oldResult.gasUsed, newResult.gasUsed)
    }
  })

  test('big mul div up 256 returns an error if b denominator is zero', async () => {
    {
      const a = 1n
      const b = 1n
      const bDenominator = 0n
      await expectError(
        ArithmeticError.MulNotPositiveDenominator,
        clamm.methods.bigMulDivUp256({ args: { a, b, bDenominator } }),
        clamm
      )
    }
  })

  test('new big mul div up 256 returns an error if b denominator is zero', async () => {
    {
      const a = 1n
      const b = 1n
      const bDenominator = 0n
      await expectError(
        ArithmeticError.MulNotPositiveDenominator,
        clamm.methods.bigMulDivUp256({ args: { a, b, bDenominator } }),
        clamm
      )
    }
  })

  test('overflowing add', async () => {
    {
      const a = 1n
      const b = 2n
      const result = (await clamm.methods.overflowingAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual([3n, 0n])
    }
    {
      const a = MaxU256
      const b = 2n
      const result = (await clamm.methods.overflowingAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual([1n, 1n])
    }
    {
      const a = MaxU256
      const b = MaxU256
      const result = (await clamm.methods.overflowingAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual([MaxU256 - 1n, 1n])
    }
    {
      const a = MaxU256
      const b = 0n
      const result = (await clamm.methods.overflowingAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual([MaxU256, 0n])
    }
    {
      const a = MaxU256
      const b = 1n
      const result = (await clamm.methods.overflowingAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual([0n, 1n])
    }
  })

  test('wrapping add', async () => {
    {
      const a = 1n
      const b = 2n
      const result = (await clamm.methods.wrappingAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual(3n)
    }
    {
      const a = MaxU256
      const b = 2n
      const result = (await clamm.methods.wrappingAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual(1n)
    }
    {
      const a = MaxU256
      const b = MaxU256
      const result = (await clamm.methods.wrappingAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual(MaxU256 - 1n)
    }
    {
      const a = MaxU256
      const b = 0n
      const result = (await clamm.methods.wrappingAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual(MaxU256)
    }
    {
      const a = MaxU256
      const b = 1n
      const result = (await clamm.methods.wrappingAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual(0n)
    }
  })
})
