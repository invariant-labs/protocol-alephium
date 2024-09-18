import { ONE_ALPH, SignerProvider, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { expectError, expectVMError } from '../../../src/testUtils'
import { ArithmeticError, MAX_U256, VMError } from '../../../src/consts'
import { CLAMMInstance, UintsOld, UintsOldInstance } from '../../../artifacts/ts'
import { deployCLAMM } from '../../../src/testUtils'
import { waitTxConfirmed } from '../../../src/utils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

export async function deployUintsOld(signer: SignerProvider): Promise<UintsOldInstance> {
  const { address } = await signer.getSelectedAccount()
  const deployResult = await waitTxConfirmed(
    UintsOld.deploy(signer, {
      initialFields: { admin: address },
      exposePrivateFunctions: true
    })
  )
  return UintsOld.at(deployResult.contractInstance.address)
}

describe('uints tests', () => {
  let sender: SignerProvider
  let uints: CLAMMInstance
  let uintsOld: UintsOldInstance

  beforeAll(async () => {
    sender = await getSigner(ONE_ALPH * 100000n, 0)
    uints = await deployCLAMM(sender)
    uintsOld = await deployUintsOld(sender)
  })

  test('to u256', async () => {
    const value = { higher: 0n, lower: 1n }
    const result = (await uints.view.toU256({ args: { value } })).returns

    expect(result).toEqual(value.lower)
  })

  test('to u256 returns an error if number is higher than u256', async () => {
    const value = { higher: 2n, lower: 1n }
    await expectError(ArithmeticError.CastOverflow, uints.view.toU256({ args: { value } }), uints)
  })

  test('to u512', async () => {
    const value = 1n
    const result = (await uints.view.toU512({ args: { value } })).returns
    expect(result).toEqual({ higher: 0n, lower: value })
  })

  test('big number division', async () => {
    {
      const a = {
        higher: 65535383919253714999999999999n,
        lower: 115792089237316195423570985008687907853269984665575028655538330292913129639936n
      }
      const b = { higher: 0n, lower: 10n ** 5n }
      const result = (
        await uints.view.bigDiv512({ args: { dividend: a, divisor: b, divisorDenominator: 1n } })
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
        await uints.view.bigDiv512({ args: { dividend: a, divisor: b, divisorDenominator: 1n } })
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
      const b = { higher: MAX_U256, lower: MAX_U256 }
      const result = (
        await uints.view.bigDiv512({ args: { dividend: a, divisor: b, divisorDenominator: 1n } })
      ).returns
      expect(result).toStrictEqual({
        higher: 0n,
        lower: 0n
      })
    }
  })

  test('big add 256', async () => {
    {
      const a = 1n
      const b = 2n
      const result = (await uints.view.bigAdd256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 3n })
    }
    {
      const a = MAX_U256
      const b = 2n
      const result = (await uints.view.bigAdd256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: 1n })
    }
    {
      const a = MAX_U256
      const b = MAX_U256
      const result = (await uints.view.bigAdd256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: a - 1n })
    }
  })

  test('old big add 256 vs big add 256 comparison', async () => {
    {
      const a = MAX_U256
      const b = MAX_U256
      const oldResult = await uintsOld.view.bigAdd256({ args: { a, b } })
      const newResult = await uints.view.bigAdd256({ args: { a, b } })
      console.log('big add 256:', oldResult.gasUsed, newResult.gasUsed)
    }
  })

  test('big add', async () => {
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const result = (await uints.view.bigAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 3n })
    }
    {
      const a = { higher: 0n, lower: MAX_U256 }
      const b = 2n
      const result = (await uints.view.bigAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: 1n })
    }
    {
      const a = { higher: 0n, lower: MAX_U256 }
      const b = MAX_U256
      const result = (await uints.view.bigAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: a.lower - 1n })
    }
    {
      const a = { higher: MAX_U256, lower: 0n }
      const b = MAX_U256
      const result = (await uints.view.bigAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual({
        higher: MAX_U256,
        lower: MAX_U256
      })
    }
  })

  test('old big add vs big add comparison', async () => {
    {
      const a = { higher: MAX_U256, lower: 0n }
      const b = MAX_U256
      const oldResult = await uintsOld.view.bigAdd({ args: { a, b } })
      const newResult = await uints.view.bigAdd({ args: { a, b } })
      console.log('big add:', oldResult.gasUsed, newResult.gasUsed)
    }
  })

  test('big sub 512', async () => {
    {
      const a = { higher: 1n, lower: 0n }
      const b = { higher: 0n, lower: 1n }
      const result = (await uints.view.bigSub512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: MAX_U256 })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = { higher: 0n, lower: 1n }
      const result = (await uints.view.bigSub512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = { higher: 1n, lower: 0n }
      await expectVMError(VMError.ArithmeticError, uints.view.bigSub512({ args: { a, b } }))
    }
    {
      const a = { higher: 1n, lower: 0n }
      const b = { higher: 1n, lower: 0n }
      const result = (await uints.view.bigSub512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = { higher: MAX_U256, lower: 0n }
      const b = { higher: 1n, lower: 0n }
      const result = (await uints.view.bigSub512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: MAX_U256 - 1n, lower: 0n })
    }
    {
      const a = { higher: MAX_U256, lower: 0n }
      const b = { higher: 0n, lower: MAX_U256 }
      const result = (await uints.view.bigSub512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: MAX_U256 - 1n, lower: 1n })
    }
    {
      const a = { higher: MAX_U256, lower: 0n }
      const b = { higher: MAX_U256, lower: 0n }
      const result = (await uints.view.bigSub512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = { higher: 1n, lower: 0n }
      const b = { higher: 1n, lower: 1n }
      await expectVMError(VMError.ArithmeticError, uints.view.bigSub512({ args: { a, b } }))
    }
  })

  test('old big sub 512 vs big sub 512 comparison', async () => {
    {
      const a = { higher: MAX_U256, lower: MAX_U256 }
      const b = { higher: MAX_U256, lower: MAX_U256 }
      const oldResult = await uintsOld.view.bigSub512({ args: { a, b } })
      const newResult = await uints.view.bigSub512({ args: { a, b } })
      console.log('big sub 512:', oldResult.gasUsed, newResult.gasUsed)
    }
  })

  test('big add returns an error if number if higher than u512', async () => {
    {
      const a = {
        higher: MAX_U256,
        lower: MAX_U256
      }
      const b = 1n
      await expectVMError(VMError.ArithmeticError, uints.view.bigAdd({ args: { a, b } }))
    }
    {
      const a = {
        higher: MAX_U256,
        lower: 1n
      }
      const b = MAX_U256
      await expectVMError(VMError.ArithmeticError, uints.view.bigAdd({ args: { a, b } }))
    }
  })

  test('big add 512', async () => {
    {
      const a = { higher: 0n, lower: 1n }
      const b = { higher: 0n, lower: 2n }
      const result = (await uints.view.bigAdd512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 3n })
    }
    {
      const a = { higher: 0n, lower: MAX_U256 }
      const b = { higher: 0n, lower: 2n }
      const result = (await uints.view.bigAdd512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: 1n })
    }
    {
      const a = { higher: 0n, lower: MAX_U256 }
      const b = { higher: 0n, lower: MAX_U256 }
      const result = (await uints.view.bigAdd512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: a.lower - 1n })
    }
    {
      const a = { higher: 0n, lower: MAX_U256 }
      const b = {
        higher: MAX_U256,
        lower: 0n
      }
      const result = (await uints.view.bigAdd512({ args: { a, b } })).returns
      expect(result).toStrictEqual({
        higher: MAX_U256,
        lower: MAX_U256
      })
    }
  })

  test('big add 512 returns an error if number if higher than u512', async () => {
    {
      const a = {
        higher: MAX_U256,
        lower: MAX_U256
      }
      const b = {
        higher: 0n,
        lower: 1n
      }
      await expectVMError(VMError.ArithmeticError, uints.view.bigAdd512({ args: { a, b } }))
    }
    {
      const a = {
        higher: 1n,
        lower: MAX_U256
      }
      const b = {
        higher: MAX_U256,
        lower: 0n
      }
      await expectVMError(VMError.ArithmeticError, uints.view.bigAdd512({ args: { a, b } }))
    }
    {
      const a = {
        higher: 1n,
        lower: 0n
      }
      const b = {
        higher: MAX_U256,
        lower: 0n
      }
      await expectVMError(VMError.ArithmeticError, uints.view.bigAdd512({ args: { a, b } }))
    }
  })

  test('old big add 512 vs big add 512 comparison', async () => {
    {
      const a = { higher: MAX_U256, lower: 0n }
      const b = { higher: 0n, lower: MAX_U256 }
      const oldResult = await uintsOld.view.bigAdd512({ args: { a, b } })
      const newResult = await uints.view.bigAdd512({ args: { a, b } })
      console.log('big add 512:', oldResult.gasUsed, newResult.gasUsed)
    }
  })

  test('big div', async () => {
    {
      const a = { higher: 0n, lower: 2n }
      const b = 1n
      const bDenominator = 1n
      const result = (await uints.view.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = { higher: 0n, lower: 2n }
      const b = 2n
      const bDenominator = 1n
      const result = (await uints.view.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 1n })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const bDenominator = 1n
      const result = (await uints.view.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = { higher: 1n, lower: 0n }
      const b = 1n
      const bDenominator = 1n
      const result = (await uints.view.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: 0n })
    }
    {
      const a = { higher: 20n, lower: 20n }
      const b = 10n
      const bDenominator = 1n
      const result = (await uints.view.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 2n, lower: 2n })
    }
    {
      const a = { higher: MAX_U256, lower: MAX_U256 }
      const b = MAX_U256
      const bDenominator = 1n
      const result = (await uints.view.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({
        higher: 1n,
        lower: 1n
      })
    }
    {
      const a = { higher: MAX_U256, lower: 0n }
      const b = MAX_U256
      const bDenominator = 1n
      const result = (await uints.view.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({
        higher: 1n,
        lower: 0n
      })
    }
    {
      const a = { higher: 0n, lower: 2n }
      const b = 10n
      const bDenominator = 10n
      const result = (await uints.view.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const bDenominator = 10n
      const result = (await uints.view.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 5n })
    }
    {
      const a = { higher: 0n, lower: 0n }
      const b = MAX_U256
      const bDenominator = 1n
      const result = (await uints.view.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = { higher: MAX_U256, lower: MAX_U256 }
      const b = 1n
      const bDenominator = 100n
      await expectError(
        ArithmeticError.CastOverflow,
        uints.view.bigDiv({ args: { a, b, bDenominator } }),
        uints
      )
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const bDenominator = 1n
      const result = (await uints.view.bigDiv({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
  })

  test('old big div vs big div comparison', async () => {
    {
      const a = { higher: MAX_U256, lower: MAX_U256 }
      const b = MAX_U256 - 1n
      const bDenominator = 1n
      const oldResult = await uintsOld.view.bigDiv({ args: { a, b, bDenominator } })
      const newResult = await uints.view.bigDiv({ args: { a, b, bDenominator } })
      console.log('big div:', oldResult.gasUsed, newResult.gasUsed)
    }
  })

  test('big div return error when dividing by zero or b denominator is zero', async () => {
    {
      const a = { higher: 0n, lower: 2n }
      const b = 0n
      const bDenominator = 1n
      await expectError(
        ArithmeticError.DivNotPositiveDivisor,
        uints.view.bigDiv({ args: { a, b, bDenominator } }),
        uints
      )
    }
    {
      const a = { higher: 0n, lower: 2n }
      const b = 1n
      const bDenominator = 0n
      await expectError(
        ArithmeticError.DivNotPositiveDenominator,
        uints.view.bigDiv({ args: { a, b, bDenominator } }),
        uints
      )
    }
  })

  test('big div up', async () => {
    {
      const a = { higher: 0n, lower: 2n }
      const b = 1n
      const bDenominator = 1n
      const result = (await uints.view.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = { higher: 0n, lower: 2n }
      const b = 2n
      const bDenominator = 1n
      const result = (await uints.view.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 1n })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const bDenominator = 1n
      const result = (await uints.view.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 1n })
    }
    {
      const a = { higher: 1n, lower: 0n }
      const b = 1n
      const bDenominator = 1n
      const result = (await uints.view.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: 0n })
    }
    {
      const a = { higher: 20n, lower: 20n }
      const b = 10n
      const bDenominator = 1n
      const result = (await uints.view.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 2n, lower: 2n })
    }
    {
      const a = { higher: MAX_U256, lower: MAX_U256 }
      const b = MAX_U256
      const bDenominator = 1n
      await expectVMError(
        VMError.ArithmeticError,
        uints.view.bigDivUp({ args: { a, b, bDenominator } })
      )
    }
    {
      const a = { higher: MAX_U256, lower: 0n }
      const b = MAX_U256
      const bDenominator = 1n
      const result = (await uints.view.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({
        higher: 1n,
        lower: 0n
      })
    }
    {
      const a = { higher: 0n, lower: 2n }
      const b = 10n
      const bDenominator = 10n
      const result = (await uints.view.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const bDenominator = 10n
      const result = (await uints.view.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 5n })
    }
    {
      const a = { higher: 0n, lower: 0n }
      const b = MAX_U256
      const bDenominator = 1n
      const result = (await uints.view.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const bDenominator = 1n
      const result = (await uints.view.bigDivUp({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 1n })
    }
  })

  test('old big div up vs big div up comparison', async () => {
    {
      const a = { higher: 0n, lower: MAX_U256 }
      const b = MAX_U256
      const bDenominator = 1n
      const oldResult = await uintsOld.view.bigDivUp({ args: { a, b, bDenominator } })
      const newResult = await uints.view.bigDivUp({ args: { a, b, bDenominator } })
      console.log('big div up:', oldResult.gasUsed, newResult.gasUsed)
    }
  })

  test('big div up return error when dividing by zero or b denominator is zero', async () => {
    {
      const a = { higher: 0n, lower: 2n }
      const b = 0n
      const bDenominator = 1n
      await expectVMError(
        VMError.ArithmeticError,
        uints.view.bigDivUp({ args: { a, b, bDenominator } })
      )
    }
    {
      const a = { higher: 0n, lower: 2n }
      const b = 1n
      const bDenominator = 0n
      await expectError(
        ArithmeticError.DivNotPositiveDenominator,
        uints.view.bigDivUp({ args: { a, b, bDenominator } }),
        uints
      )
    }
  })

  test('old big div 512 vs big div 512 comparison', async () => {
    {
      const dividend = { higher: MAX_U256, lower: MAX_U256 }
      const divisor = { higher: 1n, lower: 0n }
      const divisorDenominator = 1n
      const oldResult = await uintsOld.view.bigDiv512({
        args: { dividend, divisor, divisorDenominator }
      })
      const newResult = await uints.view.bigDiv512({
        args: { dividend, divisor, divisorDenominator }
      })
      console.log('big div 512:', oldResult.gasUsed, newResult.gasUsed)
    }
  })

  test('old big div 512 up vs big div 512 up comparison', async () => {
    {
      const dividend = { higher: MAX_U256 - 1n, lower: MAX_U256 }
      const divisor = { higher: 1n, lower: 0n }
      const divisorDenominator = 1n
      const oldResult = await uintsOld.view.bigDivUp512({
        args: { dividend, divisor, divisorDenominator }
      })
      const newResult = await uints.view.bigDivUp512({
        args: { dividend, divisor, divisorDenominator }
      })
      console.log('big div up 512:', oldResult.gasUsed, newResult.gasUsed)
    }
  })

  test('big mul 256', async () => {
    {
      const a = 1n
      const b = 2n
      const result = (await uints.view.bigMul256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = MAX_U256
      const b = 2n
      const result = (await uints.view.bigMul256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: MAX_U256 - 1n })
    }
    {
      const a = MAX_U256
      const b = MAX_U256
      const result = (await uints.view.bigMul256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: MAX_U256 - 1n, lower: 1n })
    }
    {
      const a = MAX_U256
      const b = 0n
      const result = (await uints.view.bigMul256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = 0n
      const b = 0n
      const result = (await uints.view.bigMul256({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
  })

  test('old big mul 256 vs big mul 256 comparison', async () => {
    {
      const a = MAX_U256
      const b = MAX_U256
      const oldResult = await uintsOld.view.bigMul256({ args: { a, b } })
      const newResult = await uints.view.bigMul256({ args: { a, b } })
      console.log('big mul 256:', oldResult.gasUsed, newResult.gasUsed)
    }
  })

  test('big mul', async () => {
    {
      const a = { higher: 0n, lower: 1n }
      const b = 2n
      const result = (await uints.view.bigMul({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = { higher: 0n, lower: MAX_U256 }
      const b = 2n
      const result = (await uints.view.bigMul({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: MAX_U256 - 1n })
    }
    {
      const a = { higher: 0n, lower: MAX_U256 }
      const b = MAX_U256
      const result = (await uints.view.bigMul({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: MAX_U256 - 1n, lower: 1n })
    }
    {
      const a = { higher: 0n, lower: MAX_U256 }
      const b = 0n
      const result = (await uints.view.bigMul({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = { higher: 0n, lower: 0n }
      const b = 0n
      const result = (await uints.view.bigMul({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
  })

  test('old big mul vs big mul comparison', async () => {
    {
      const a = { higher: 0n, lower: MAX_U256 }
      const b = MAX_U256
      const oldResult = await uintsOld.view.bigMul({ args: { a, b } })
      const newResult = await uints.view.bigMul({ args: { a, b } })
      console.log('big mul:', oldResult.gasUsed, newResult.gasUsed)
    }
  })

  test('big mul returns an error if number is higher than u512', async () => {
    {
      const a = { higher: MAX_U256, lower: MAX_U256 }
      const b = 2n
      await expectError(ArithmeticError.CastOverflow, uints.view.bigMul({ args: { a, b } }), uints)
    }
    {
      const a = { higher: MAX_U256, lower: 1n }
      const b = MAX_U256
      await expectError(ArithmeticError.CastOverflow, uints.view.bigMul({ args: { a, b } }), uints)
    }
    {
      const a = { higher: MAX_U256 - 1n, lower: MAX_U256 }
      const b = MAX_U256
      await expectError(ArithmeticError.CastOverflow, uints.view.bigMul({ args: { a, b } }), uints)
    }
    {
      const a = { higher: MAX_U256, lower: MAX_U256 }
      const b = MAX_U256
      await expectError(ArithmeticError.CastOverflow, uints.view.bigMul({ args: { a, b } }), uints)
    }
  })

  test('big mul div 256', async () => {
    {
      const a = 1n
      const b = 2n
      const bDenominator = 1n
      const result = (await uints.view.bigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = MAX_U256
      const b = 2n
      const bDenominator = 1n
      const result = (await uints.view.bigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: MAX_U256 - 1n })
    }
    {
      const a = MAX_U256
      const b = MAX_U256
      const bDenominator = 1n
      const result = (await uints.view.bigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({
        higher: MAX_U256 - 1n,
        lower: 1n
      })
    }
    {
      const a = MAX_U256
      const b = 0n
      const bDenominator = 1n
      const result = (await uints.view.bigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = 0n
      const b = 0n
      const bDenominator = 1n
      const result = (await uints.view.bigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = 100n
      const b = 200n
      const bDenominator = 100n
      const result = (await uints.view.bigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 200n })
    }
    {
      const a = 1n
      const b = 150n
      const bDenominator = 100n
      const result = (await uints.view.bigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 1n })
    }
    {
      const a = MAX_U256
      const b = MAX_U256
      const bDenominator = MAX_U256
      const result = (await uints.view.bigMulDiv256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: MAX_U256 })
    }
  })

  test('old big mul div 256 vs big mul div 256 comparison', async () => {
    {
      const a = MAX_U256
      const b = MAX_U256
      const bDenominator = 1n
      const oldResult = await uintsOld.view.bigMulDiv256({ args: { a, b, bDenominator } })
      const newResult = await uints.view.bigMulDiv256({ args: { a, b, bDenominator } })
      console.log('big mul div 256:', oldResult.gasUsed, newResult.gasUsed)
    }
  })

  test('big mul div 256 returns an error if b denominator is zero', async () => {
    {
      const a = 1n
      const b = 1n
      const bDenominator = 0n
      await expectError(
        ArithmeticError.MulNotPositiveDenominator,
        uints.view.bigMulDiv256({ args: { a, b, bDenominator } }),
        uints
      )
    }
  })

  test('big mul div up 256', async () => {
    {
      const a = 1n
      const b = 2n
      const bDenominator = 1n
      const result = (await uints.view.bigMulDivUp256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = MAX_U256
      const b = 2n
      const bDenominator = 1n
      const result = (await uints.view.bigMulDivUp256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: MAX_U256 - 1n })
    }
    {
      const a = MAX_U256
      const b = MAX_U256
      const bDenominator = 1n
      const result = (await uints.view.bigMulDivUp256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({
        higher: MAX_U256 - 1n,
        lower: 1n
      })
    }
    {
      const a = MAX_U256
      const b = 0n
      const bDenominator = 1n
      const result = (await uints.view.bigMulDivUp256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = 0n
      const b = 0n
      const bDenominator = 1n
      const result = (await uints.view.bigMulDivUp256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = 100n
      const b = 200n
      const bDenominator = 100n
      const result = (await uints.view.bigMulDivUp256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 200n })
    }
    {
      const a = 1n
      const b = 150n
      const bDenominator = 100n
      const result = (await uints.view.bigMulDivUp256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2n })
    }
    {
      const a = MAX_U256
      const b = MAX_U256
      const bDenominator = MAX_U256
      const result = (await uints.view.bigMulDivUp256({ args: { a, b, bDenominator } })).returns
      expect(result).toStrictEqual({
        higher: 0n,
        lower: MAX_U256
      })
    }
  })

  test('old big mul div up 256 vs big mul div up 256 comparison', async () => {
    {
      const a = MAX_U256
      const b = MAX_U256
      const bDenominator = 1n
      const oldResult = await uintsOld.view.bigMulDivUp256({ args: { a, b, bDenominator } })
      const newResult = await uints.view.bigMulDivUp256({ args: { a, b, bDenominator } })
      console.log('big mul div up 256:', oldResult.gasUsed, newResult.gasUsed)
    }
  })

  test('big mul div up 256 returns an error if b denominator is zero', async () => {
    {
      const a = 1n
      const b = 1n
      const bDenominator = 0n
      await expectError(
        ArithmeticError.MulNotPositiveDenominator,
        uints.view.bigMulDivUp256({ args: { a, b, bDenominator } }),
        uints
      )
    }
  })

  test('wrapping add', async () => {
    {
      const a = 1n
      const b = 2n
      const result = (await uints.view.wrappingAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual(3n)
    }
    {
      const a = MAX_U256
      const b = 2n
      const result = (await uints.view.wrappingAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual(1n)
    }
    {
      const a = MAX_U256
      const b = MAX_U256
      const result = (await uints.view.wrappingAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual(MAX_U256 - 1n)
    }
    {
      const a = MAX_U256
      const b = 0n
      const result = (await uints.view.wrappingAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual(MAX_U256)
    }
    {
      const a = MAX_U256
      const b = 1n
      const result = (await uints.view.wrappingAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual(0n)
    }
  })
})
