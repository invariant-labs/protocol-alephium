import { ONE_ALPH, SignerProvider, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { UintsInstance } from '../artifacts/ts'
import { MaxU256, deployUints, expectError } from '../src/utils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

describe('uints tests', () => {
  let sender: SignerProvider
  let uints: UintsInstance

  beforeAll(async () => {
    sender = await getSigner(ONE_ALPH * 100000n, 0)
    uints = (await deployUints(sender)).contractInstance
  })

  test('to u256 works', async () => {
    const value = { higher: 0n, lower: 1n }
    const result = (await uints.methods.toU256({ args: { value } })).returns
    expect(result).toEqual(value.lower)
  })

  test('to u256 returns an error if number is higher than u256', async () => {
    const value = { higher: 2n, lower: 1n }
    await expectError(uints.methods.toU256({ args: { value } }))
  })

  test('to u512 works', async () => {
    const value = 1n
    const result = (await uints.methods.toU512({ args: { value } })).returns
    expect(result).toEqual({ higher: 0n, lower: value })
  })

  test('Big number division', async () => {
    {
      const a = {
        higher: 65535383919253714999999999999n,
        lower: 115792089237316195423570985008687907853269984665575028655538330292913129639936n
      }
      const b = { higher: 0n, lower: 10n ** 5n }
      const result = (await uints.methods.bigDiv512({ args: { dividend: a, divisor: b, divisorDenominator: 1n } }))
        .returns
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
      const result = (await uints.methods.bigDiv512({ args: { dividend: a, divisor: b, divisorDenominator: 1n } }))
        .returns
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
      const result = (await uints.methods.bigDiv512({ args: { dividend: a, divisor: b, divisorDenominator: 1n } }))
        .returns
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
      const result = (await uints.methods.bigShl({ args: { v, n } })).returns
      expect(result).toEqual({ higher: 0n, lower: 2n })
    }
    {
      const v = { higher: 0n, lower: 1n }
      const n = 257n
      const result = (await uints.methods.bigShl({ args: { v, n } })).returns
      expect(result).toEqual({ higher: 2n, lower: 0n })
    }
    {
      const v = { higher: 1n, lower: 4n }
      const n = 1n
      const result = (await uints.methods.bigShl({ args: { v, n } })).returns
      expect(result).toEqual({ higher: 2n, lower: 8n })
    }
    {
      const v = { higher: MaxU256, lower: MaxU256 }
      const n = 1n
      const result = (await uints.methods.bigShl({ args: { v, n } })).returns
      expect(result).toEqual({ higher: MaxU256, lower: MaxU256 - 1n })
    }
  })

  test('isGreaterEqual', async () => {
    {
      const v = { higher: 0n, lower: 1n }
      const compareTo = { higher: 0n, lower: 1n }
      const result = (await uints.methods.isGreaterEqual({ args: { v, compareTo } })).returns
      expect(result).toEqual(true)
    }
    {
      const v = { higher: 1n, lower: 1n }
      const compareTo = { higher: 1n, lower: 1n }
      const result = (await uints.methods.isGreaterEqual({ args: { v, compareTo } })).returns
      expect(result).toEqual(true)
    }
    {
      const v = { higher: 0n, lower: 1n }
      const compareTo = { higher: 1n, lower: 0n }
      const result = (await uints.methods.isGreaterEqual({ args: { v, compareTo } })).returns
      expect(result).toEqual(false)
    }
    {
      const v = { higher: 2n, lower: 3n }
      const compareTo = { higher: 2n, lower: 2n }
      const result = (await uints.methods.isGreaterEqual({ args: { v, compareTo } })).returns
      expect(result).toEqual(true)
    }
    {
      const v = { higher: 3n, lower: 1n }
      const compareTo = { higher: 0n, lower: 1n }
      const result = (await uints.methods.isGreaterEqual({ args: { v, compareTo } })).returns
      expect(result).toEqual(true)
    }
    {
      const v = { higher: 3n, lower: 0n }
      const compareTo = { higher: 3n, lower: 0n }
      const result = (await uints.methods.isGreaterEqual({ args: { v, compareTo } })).returns
      expect(result).toEqual(true)
    }
    {
      const v = { higher: 3n, lower: 0n }
      const compareTo = { higher: 3n, lower: 1n }
      const result = (await uints.methods.isGreaterEqual({ args: { v, compareTo } })).returns
      expect(result).toEqual(false)
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

  test('new big add 256', async () => {
    {
      const a = 1n
      const b = 2n
      const result = (await uints.methods.newBigAdd256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 3n })
    }
    {
      const a = MaxU256
      const b = 2n
      const result = (await uints.methods.newBigAdd256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: 1n })
    }
    {
      const a = MaxU256
      const b = MaxU256
      const result = (await uints.methods.newBigAdd256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: a - 1n })
    }
  })

  test('big add 256 vs new big add 256 comparison', async () => {
    {
      const a = MaxU256
      const b = MaxU256
      const oldResult = await uints.methods.bigAdd256({ args: { a, b } })
      const newResult = await uints.methods.newBigAdd256({ args: { a, b } })
      console.log('big add 256', oldResult.gasUsed, newResult.gasUsed)
    }
  })

  test('big add', async () => {
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const result = (await uints.methods.bigAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 3n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = 2n
      const result = (await uints.methods.bigAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: 1n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = MaxU256
      const result = (await uints.methods.bigAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: a.lower - 1n })
    }
    {
      const a = { higher: MaxU256, lower: 0n }
      const b = MaxU256
      const result = (await uints.methods.bigAdd({ args: { a, b } })).returns
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
      const result = (await uints.methods.newBigAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 3n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = 2n
      const result = (await uints.methods.newBigAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: 1n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = MaxU256
      const result = (await uints.methods.newBigAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: a.lower - 1n })
    }
    {
      const a = { higher: MaxU256, lower: 0n }
      const b = MaxU256
      const result = (await uints.methods.newBigAdd({ args: { a, b } })).returns
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
      const oldResult = await uints.methods.bigAdd({ args: { a, b } })
      const newResult = await uints.methods.newBigAdd({ args: { a, b } })
      console.log('big add', oldResult.gasUsed, newResult.gasUsed)
    }
  })

  test('big sub 512', async () => {
    {
      const a = { higher: 1n, lower: 0n }
      const b = { higher: 0n, lower: 1n }
      const result = (await uints.methods.bigSub512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: MaxU256 })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = { higher: 0n, lower: 1n }
      const result = (await uints.methods.bigSub512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = { higher: 1n, lower: 0n }
      await expectError(uints.methods.bigSub512({ args: { a, b } }))
    }
    {
      const a = { higher: 1n, lower: 0n }
      const b = { higher: 1n, lower: 0n }
      const result = (await uints.methods.bigSub512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = { higher: MaxU256, lower: 0n }
      const b = { higher: 1n, lower: 0n }
      const result = (await uints.methods.bigSub512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: MaxU256 - 1n, lower: 0n })
    }
    {
      const a = { higher: MaxU256, lower: 0n }
      const b = { higher: 0n, lower: MaxU256 }
      const result = (await uints.methods.bigSub512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: MaxU256 - 1n, lower: 1n })
    }
    {
      const a = { higher: MaxU256, lower: 0n }
      const b = { higher: MaxU256, lower: 0n }
      const result = (await uints.methods.bigSub512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = { higher: 1n, lower: 0n }
      const b = { higher: 1n, lower: 1n }
      await expectError(uints.methods.bigSub512({ args: { a, b } }))
    }
  })

  test('new big sub 512', async () => {
    {
      const a = { higher: 1n, lower: 0n }
      const b = { higher: 0n, lower: 1n }
      const result = (await uints.methods.newBigSub512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: MaxU256 })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = { higher: 0n, lower: 1n }
      const result = (await uints.methods.newBigSub512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = { higher: 1n, lower: 0n }
      await expectError(uints.methods.newBigSub512({ args: { a, b } }))
    }
    {
      const a = { higher: 1n, lower: 0n }
      const b = { higher: 1n, lower: 0n }
      const result = (await uints.methods.newBigSub512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = { higher: MaxU256, lower: 0n }
      const b = { higher: 1n, lower: 0n }
      const result = (await uints.methods.newBigSub512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: MaxU256 - 1n, lower: 0n })
    }
    {
      const a = { higher: MaxU256, lower: 0n }
      const b = { higher: 0n, lower: MaxU256 }
      const result = (await uints.methods.newBigSub512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: MaxU256 - 1n, lower: 1n })
    }
    {
      const a = { higher: MaxU256, lower: 0n }
      const b = { higher: MaxU256, lower: 0n }
      const result = (await uints.methods.newBigSub512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = { higher: 1n, lower: 0n }
      const b = { higher: 1n, lower: 1n }
      await expectError(uints.methods.newBigSub512({ args: { a, b } }))
    }
  })

  test('big sub 512 vs new big sub 512 comparison', async () => {
    {
      const a = { higher: MaxU256, lower: MaxU256 }
      const b = { higher: MaxU256, lower: MaxU256 }
      const oldResult = await uints.methods.bigSub512({ args: { a, b } })
      const newResult = await uints.methods.newBigSub512({ args: { a, b } })
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
      await expectError(uints.methods.bigAdd({ args: { a, b } }))
    }
    {
      const a = {
        higher: MaxU256,
        lower: 1n
      }
      const b = MaxU256
      await expectError(uints.methods.bigAdd({ args: { a, b } }))
    }
  })

  test('big add 512', async () => {
    {
      const a = { higher: 0n, lower: 1n }
      const b = { higher: 0n, lower: 2n }
      const result = (await uints.methods.bigAdd512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 3n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = { higher: 0n, lower: 2n }
      const result = (await uints.methods.bigAdd512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: 1n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = { higher: 0n, lower: MaxU256 }
      const result = (await uints.methods.bigAdd512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: a.lower - 1n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = {
        higher: MaxU256,
        lower: 0n
      }
      const result = (await uints.methods.bigAdd512({ args: { a, b } })).returns
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
      const result = (await uints.methods.newBigAdd512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 3n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = { higher: 0n, lower: 2n }
      const result = (await uints.methods.newBigAdd512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: 1n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = { higher: 0n, lower: MaxU256 }
      const result = (await uints.methods.newBigAdd512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: a.lower - 1n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = {
        higher: MaxU256,
        lower: 0n
      }
      const result = (await uints.methods.newBigAdd512({ args: { a, b } })).returns
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
      await expectError(uints.methods.bigAdd512({ args: { a, b } }))
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
      await expectError(uints.methods.bigAdd512({ args: { a, b } }))
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
      await expectError(uints.methods.bigAdd512({ args: { a, b } }))
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
      await expectError(uints.methods.newBigAdd512({ args: { a, b } }))
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
      await expectError(uints.methods.newBigAdd512({ args: { a, b } }))
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
      await expectError(uints.methods.newBigAdd512({ args: { a, b } }))
    }
  })

  test('big add 512 vs new big add 512 comparison', async () => {
    {
      const a = { higher: MaxU256, lower: 0n }
      const b = { higher: 0n, lower: MaxU256 }
      const oldResult = await uints.methods.bigAdd512({ args: { a, b } })
      const newResult = await uints.methods.newBigAdd512({ args: { a, b } })
      console.log('big add 512', oldResult.gasUsed, newResult.gasUsed)
    }
  })

  test('big div', async () => {
    {
      const a = { higher: 0n, lower: 2n }
      const b = 1n
      const bDenominator = 1n
      const result = (await uints.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = { higher: 0n, lower: 2n }
      const b = 2n
      const bDenominator = 1n
      const result = (await uints.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 1n })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const bDenominator = 1n
      const result = (await uints.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = { higher: 1n, lower: 0n }
      const b = 1n
      const bDenominator = 1n
      const result = (await uints.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: 0n })
    }
    {
      const a = { higher: 20n, lower: 20n }
      const b = 10n
      const bDenominator = 1n
      const result = (await uints.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 2n, lower: 2n })
    }
    {
      const a = { higher: MaxU256, lower: MaxU256 }
      const b = MaxU256
      const bDenominator = 1n
      const result = (await uints.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({
        higher: 0n,
        lower: 115792089237316195423570985008687907853269984665640564039457584007913129639935n
      })
    }
    {
      const a = { higher: MaxU256, lower: 0n }
      const b = MaxU256
      const bDenominator = 1n
      const result = (await uints.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({
        higher: 0n,
        lower: 115792089237316195423570985008687907853269984665640564039457584007913129639935n
      })
    }
    {
      const a = { higher: 0n, lower: 2n }
      const b = 10n
      const bDenominator = 10n
      const result = (await uints.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const bDenominator = 10n
      const result = (await uints.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 5n })
    }
    {
      const a = { higher: 0n, lower: 0n }
      const b = MaxU256
      const bDenominator = 1n
      const result = (await uints.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = { higher: MaxU256, lower: MaxU256 }
      const b = 1n
      const bDenominator = 100n
      await expectError(uints.methods.bigDiv({ args: { a, b, bDenominator } }))
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const bDenominator = 1n
      const result = (await uints.methods.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
  })

  test('new big div', async () => {
    {
      const a = { higher: 0n, lower: 2n }
      const b = 1n
      const bDenominator = 1n
      const result = (await uints.methods.newBigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = { higher: 0n, lower: 2n }
      const b = 2n
      const bDenominator = 1n
      const result = (await uints.methods.newBigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 1n })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const bDenominator = 1n
      const result = (await uints.methods.newBigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = { higher: 1n, lower: 0n }
      const b = 1n
      const bDenominator = 1n
      const result = (await uints.methods.newBigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: 0n })
    }
    {
      const a = { higher: 20n, lower: 20n }
      const b = 10n
      const bDenominator = 1n
      const result = (await uints.methods.newBigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 2n, lower: 2n })
    }
    {
      const a = { higher: MaxU256, lower: MaxU256 }
      const b = MaxU256
      const bDenominator = 1n
      const result = (await uints.methods.newBigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({
        higher: 1n,
        lower: 1n
      })
    }
    {
      const a = { higher: MaxU256, lower: 0n }
      const b = MaxU256
      const bDenominator = 1n
      const result = (await uints.methods.newBigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({
        higher: 1n,
        lower: 0n
      })
    }
    {
      const a = { higher: 0n, lower: 2n }
      const b = 10n
      const bDenominator = 10n
      const result = (await uints.methods.newBigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const bDenominator = 10n
      const result = (await uints.methods.newBigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 5n })
    }
    {
      const a = { higher: 0n, lower: 0n }
      const b = MaxU256
      const bDenominator = 1n
      const result = (await uints.methods.newBigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = { higher: MaxU256, lower: MaxU256 }
      const b = 1n
      const bDenominator = 100n
      await expectError(uints.methods.newBigDiv({ args: { a, b, bDenominator } }))
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const bDenominator = 1n
      const result = (await uints.methods.newBigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
  })

  test('big div vs new big div comparison', async () => {
    {
      const a = { higher: MaxU256, lower: MaxU256 }
      const b = MaxU256 - 1n
      const bDenominator = 1n
      const oldResult = await uints.methods.bigDiv({ args: { a, b, bDenominator } })
      const newResult = await uints.methods.newBigDiv({ args: { a, b, bDenominator } })
      console.log('big div', oldResult.gasUsed, newResult.gasUsed)
    }
  })

  test('big div return error when dividing by zero or b denominator is zero', async () => {
    {
      const a = { higher: 0n, lower: 2n }
      const b = 0n
      const bDenominator = 1n
      await expectError(uints.methods.newBigDiv({ args: { a, b, bDenominator } }))
    }
    {
      const a = { higher: 0n, lower: 2n }
      const b = 1n
      const bDenominator = 0n
      await expectError(uints.methods.newBigDiv({ args: { a, b, bDenominator } }))
    }
  })

  test('new big div return error when dividing by zero or b denominator is zero', async () => {
    {
      const a = { higher: 0n, lower: 2n }
      const b = 0n
      const bDenominator = 1n
      await expectError(uints.methods.bigDiv({ args: { a, b, bDenominator } }))
    }
    {
      const a = { higher: 0n, lower: 2n }
      const b = 1n
      const bDenominator = 0n
      await expectError(uints.methods.bigDiv({ args: { a, b, bDenominator } }))
    }
  })

  test('big div up', async () => {
    {
      const a = { higher: 0n, lower: 2n }
      const b = 1n
      const bDenominator = 1n
      const result = (await uints.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = { higher: 0n, lower: 2n }
      const b = 2n
      const bDenominator = 1n
      const result = (await uints.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 1n })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const bDenominator = 1n
      const result = (await uints.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 1n })
    }
    {
      const a = { higher: 1n, lower: 0n }
      const b = 1n
      const bDenominator = 1n
      const result = (await uints.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: 0n })
    }
    {
      const a = { higher: 20n, lower: 20n }
      const b = 10n
      const bDenominator = 1n
      const result = (await uints.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 2n, lower: 2n })
    }
    {
      const a = { higher: MaxU256, lower: MaxU256 }
      const b = MaxU256
      const bDenominator = 1n
      await expectError(uints.methods.bigDivUp({ args: { a, b, bDenominator } }))
    }
    {
      const a = { higher: MaxU256, lower: 0n }
      const b = MaxU256
      const bDenominator = 1n
      const result = (await uints.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({
        higher: 0n,
        lower: 115792089237316195423570985008687907853269984665640564039457584007913129639935n
      })
    }
    {
      const a = { higher: 0n, lower: 2n }
      const b = 10n
      const bDenominator = 10n
      const result = (await uints.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const bDenominator = 10n
      const result = (await uints.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 5n })
    }
    {
      const a = { higher: 0n, lower: 0n }
      const b = MaxU256
      const bDenominator = 1n
      const result = (await uints.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const bDenominator = 1n
      const result = (await uints.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 1n })
    }
  })

  test('big div up return error when dividing by zero or b denominator is zero', async () => {
    {
      const a = { higher: 0n, lower: 2n }
      const b = 0n
      const bDenominator = 1n
      await expectError(uints.methods.bigDivUp({ args: { a, b, bDenominator } }))
    }
    {
      const a = { higher: 0n, lower: 2n }
      const b = 1n
      const bDenominator = 0n
      await expectError(uints.methods.bigDivUp({ args: { a, b, bDenominator } }))
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

  test('new big mul 256', async () => {
    {
      const a = 1n
      const b = 2n
      const result = (await uints.methods.newBigMul256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = MaxU256
      const b = 2n
      const result = (await uints.methods.newBigMul256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: MaxU256 - 1n })
    }
    {
      const a = MaxU256
      const b = MaxU256
      const result = (await uints.methods.newBigMul256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: MaxU256 - 1n, lower: 1n })
    }
    {
      const a = MaxU256
      const b = 0n
      const result = (await uints.methods.newBigMul256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = 0n
      const b = 0n
      const result = (await uints.methods.newBigMul256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
  })

  test('big mul 256 vs new big mul 256 comparison', async () => {
    {
      const a = MaxU256
      const b = MaxU256
      const oldResult = await uints.methods.bigMul256({ args: { a, b } })
      const newResult = await uints.methods.newBigMul256({ args: { a, b } })
      console.log('big mul 256', oldResult.gasUsed, newResult.gasUsed)
    }
  })

  test('big mul', async () => {
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const result = (await uints.methods.bigMul({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = 2n
      const result = (await uints.methods.bigMul({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: MaxU256 - 1n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = MaxU256
      const result = (await uints.methods.bigMul({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: MaxU256 - 1n, lower: 1n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = 0n
      const result = (await uints.methods.bigMul({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = { higher: 0n, lower: 0n }
      const b = 0n
      const result = (await uints.methods.bigMul({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
  })

  test('new big mul', async () => {
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const result = (await uints.methods.newBigMul({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = 2n
      const result = (await uints.methods.newBigMul({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: MaxU256 - 1n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = MaxU256
      const result = (await uints.methods.newBigMul({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: MaxU256 - 1n, lower: 1n })
    }
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = 0n
      const result = (await uints.methods.newBigMul({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = { higher: 0n, lower: 0n }
      const b = 0n
      const result = (await uints.methods.newBigMul({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
  })

  test('big mul vs new big mul comparison', async () => {
    {
      const a = { higher: 0n, lower: MaxU256 }
      const b = MaxU256
      const oldResult = await uints.methods.bigMul({ args: { a, b } })
      const newResult = await uints.methods.newBigMul({ args: { a, b } })
      console.log('big mul', oldResult.gasUsed, newResult.gasUsed)
    }
  })

  test('big mul returns an error if number is higher than u512', async () => {
    {
      const a = { higher: MaxU256, lower: MaxU256 }
      const b = 2n
      await expectError(uints.methods.bigMul({ args: { a, b } }))
    }
    {
      const a = { higher: MaxU256, lower: 1n }
      const b = MaxU256
      await expectError(uints.methods.bigMul({ args: { a, b } }))
    }
    {
      const a = { higher: MaxU256 - 1n, lower: MaxU256 }
      const b = MaxU256
      await expectError(uints.methods.bigMul({ args: { a, b } }))
    }
    {
      const a = { higher: MaxU256, lower: MaxU256 }
      const b = MaxU256
      await expectError(uints.methods.bigMul({ args: { a, b } }))
    }
  })

  test('new big mul returns an error if number is higher than u512', async () => {
    {
      const a = { higher: MaxU256, lower: MaxU256 }
      const b = 2n
      await expectError(uints.methods.newBigMul({ args: { a, b } }))
    }
    {
      const a = { higher: MaxU256, lower: 1n }
      const b = MaxU256
      await expectError(uints.methods.newBigMul({ args: { a, b } }))
    }
    {
      const a = { higher: MaxU256 - 1n, lower: MaxU256 }
      const b = MaxU256
      await expectError(uints.methods.newBigMul({ args: { a, b } }))
    }
    {
      const a = { higher: MaxU256, lower: MaxU256 }
      const b = MaxU256
      await expectError(uints.methods.newBigMul({ args: { a, b } }))
    }
  })

  test('big mul div 256', async () => {
    {
      const a = 1n
      const b = 2n
      const bDenominator = 1n
      const result = (await uints.methods.bigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = MaxU256
      const b = 2n
      const bDenominator = 1n
      const result = (await uints.methods.bigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: MaxU256 - 1n })
    }
    {
      const a = MaxU256
      const b = MaxU256
      const bDenominator = 1n
      const result = (await uints.methods.bigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({
        higher: MaxU256 - 1n,
        lower: 1n
      })
    }
    {
      const a = MaxU256
      const b = 0n
      const bDenominator = 1n
      const result = (await uints.methods.bigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = 0n
      const b = 0n
      const bDenominator = 1n
      const result = (await uints.methods.bigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = 100n
      const b = 200n
      const bDenominator = 100n
      const result = (await uints.methods.bigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 200n })
    }
    {
      const a = 1n
      const b = 150n
      const bDenominator = 100n
      const result = (await uints.methods.bigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 1n })
    }
    {
      const a = MaxU256
      const b = MaxU256
      const bDenominator = MaxU256
      const result = (await uints.methods.bigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: MaxU256 - 1n })
    }
  })

  test('big mul div 256 returns an error if b denominator is zero', async () => {
    {
      const a = 1n
      const b = 1n
      const bDenominator = 0n
      await expectError(uints.methods.bigMulDiv256({ args: { a, b, bDenominator } }))
    }
  })

  test('big mul div up 256', async () => {
    {
      const a = 1n
      const b = 2n
      const bDenominator = 1n
      const result = (await uints.methods.bigMulDivUp256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = MaxU256
      const b = 2n
      const bDenominator = 1n
      const result = (await uints.methods.bigMulDivUp256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: MaxU256 - 1n })
    }
    {
      const a = MaxU256
      const b = MaxU256
      const bDenominator = 1n
      const result = (await uints.methods.bigMulDivUp256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({
        higher: MaxU256 - 1n,
        lower: 1n
      })
    }
    {
      const a = MaxU256
      const b = 0n
      const bDenominator = 1n
      const result = (await uints.methods.bigMulDivUp256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = 0n
      const b = 0n
      const bDenominator = 1n
      const result = (await uints.methods.bigMulDivUp256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = 100n
      const b = 200n
      const bDenominator = 100n
      const result = (await uints.methods.bigMulDivUp256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 200n })
    }
    {
      const a = 1n
      const b = 150n
      const bDenominator = 100n
      const result = (await uints.methods.bigMulDivUp256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = MaxU256
      const b = MaxU256
      const bDenominator = MaxU256
      const result = (await uints.methods.bigMulDivUp256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({
        higher: 0n,
        lower: 115792089237316195423570985008687907853269984665640564039457584007913129639934n
      })
    }
  })

  test('big mul div up 256 returns an error if b denominator is zero', async () => {
    {
      const a = 1n
      const b = 1n
      const bDenominator = 0n
      await expectError(uints.methods.bigMulDivUp256({ args: { a, b, bDenominator } }))
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
