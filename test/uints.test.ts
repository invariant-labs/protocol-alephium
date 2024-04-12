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

  test('big div return error when dividing by zero or b denominator is zero', async () => {
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
