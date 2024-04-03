import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { deployUints } from '../src/utils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let sender: PrivateKeyWallet

describe('uints tests', () => {
  beforeAll(async () => {
    sender = await getSigner(ONE_ALPH * 100000n, 0)
  })

  test('test casting between u512 and u256', async () => {
    const uints = await deployUints(sender)
    const v = 100n
    const result = (await uints.contractInstance.methods.toU512({ args: { v } })).returns
    expect(result).toStrictEqual({ higher: 0n, lower: 100n })
    const castBack = (await uints.contractInstance.methods.toU256({ args: { v: result } })).returns
    expect(castBack).toStrictEqual(v)
  })

  test('big add', async () => {
    const uints = await deployUints(sender)
    {
      const a = 115792089237316195423570985008687907853269984665640564039457584007913129639935n
      const b = 999n
      const result = (await uints.contractInstance.methods.bigAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: b - 1n })
    }
    {
      const a = 777n
      const b = 115792089237316195423570985008687907853269984665640564039457584007913129639935n
      const result = (await uints.contractInstance.methods.bigAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: a - 1n })
    }
    {
      const a = 115792089237316195423570985008687907853269984665640564039457584007913129639935n
      const b = 115792089237316195423570985008687907853269984665640564039457584007913129639935n
      const result = (await uints.contractInstance.methods.bigAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: a - 1n })
    }
  })

  test('big div', async () => {
    const uints = await deployUints(sender)
    {
      const a = {
        higher: 21n,
        lower: 37n
      }
      const b = 50n
      const bDenominator = 10n
      {
        const result = (await uints.contractInstance.methods.bigDiv({ args: { a, b, bDenominator } })).returns
        // expected: 486326774796728020778998137036489212983733935595690368965721000000000000000000
        // received: 486326774796728020778998137036489212983733935595690368965721852833235144487731
        expect(result).toStrictEqual({
          higher: 4n,
          lower: 23158417847463239084714197001737581570653996933128112807891516801582625927987n
        })
      }
      {
        const result = (await uints.contractInstance.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
        expect(result).toStrictEqual({
          higher: 4n,
          lower: 23158417847463239084714197001737581570653996933128112807891516801582625927988n
        })
      }
    }
    {
      const a = {
        higher: 50216813883093446110686315385661331328818843555712276103168n,
        lower: 0n
      }
      const b = 2n
      const bDenominator = 1n
      {
        const result = (await uints.contractInstance.methods.bigDiv({ args: { a, b, bDenominator } })).returns
        // expected: 2907354897182427562197295231552018137414565442749272241125960796722557152453591693304764202855054262243050086425064711734138406514458624n
        // received: 2907354897182427562197295231552018137414565442749272241125960796722557152453591693304764202855054262243050086425064711734138406514458624n
        expect(result).toStrictEqual({
          higher: 25108406941546723055343157692830665664409421777856138051584n,
          lower: 0n
        })
      }
      {
        const result = (await uints.contractInstance.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
        expect(result).toStrictEqual({
          higher: 25108406941546723055343157692830665664409421777856138051584n,
          lower: 0n
        })
      }
    }
    {
      const a = {
        higher: 0n,
        lower: 1n
      }
      const b = 2n
      const bDenominator = 1n
      {
        const result = (await uints.contractInstance.methods.bigDiv({ args: { a, b, bDenominator } })).returns
        expect(result).toStrictEqual({
          higher: 0n,
          lower: 0n
        })
      }
      {
        const result = (await uints.contractInstance.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
        expect(result).toStrictEqual({
          higher: 0n,
          lower: 1n
        })
      }
    }
    {
      const a = {
        higher: 0n,
        lower: 10n
      }
      const b = 1n
      const bDenominator = 1000n
      {
        const result = (await uints.contractInstance.methods.bigDiv({ args: { a, b, bDenominator } })).returns
        expect(result).toStrictEqual({
          higher: 0n,
          lower: 10n
        })
      }
      {
        const result = (await uints.contractInstance.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
        expect(result).toStrictEqual({
          higher: 0n,
          lower: 10n
        })
      }
    }
    {
      const a = {
        higher: 0n,
        lower: 6n * 10n ** 1n
      }

      const b = 3n * 10n ** 3n
      const bDenominator = 1000n
      {
        const result = (await uints.contractInstance.methods.bigDiv({ args: { a, b, bDenominator } })).returns
        expect(result).toStrictEqual({
          higher: 0n,
          lower: 20n
        })
      }
      {
        const result = (await uints.contractInstance.methods.bigDivUp({ args: { a, b, bDenominator } })).returns
        expect(result).toStrictEqual({
          higher: 0n,
          lower: 20n
        })
      }
    }
  })

  test('big add 512', async () => {
    const uints = await deployUints(sender)
    {
      const a = { higher: 0n, lower: 10n }
      const b = 20n
      const result = (await uints.contractInstance.methods.bigAdd512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 30n })
    }
    {
      const a = { higher: 0n, lower: 115792089237316195423570985008687907853269984665640564039457584007913129639935n }
      const b = 20n
      const result = (await uints.contractInstance.methods.bigAdd512({ args: { a, b } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: 19n })
    }
  })

  test('big mul', async () => {
    const uints = await deployUints(sender)
    {
      const a = 123n
      const b = 2n
      const result = (await uints.contractInstance.methods.bigMul({ args: { a, b, bDenominator: 1n } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 246n })
      // expected: 246
      // real: 246
    }
    {
      const a = 340282366920938463463374607431768211457n
      const b = 340282366920938463463374607431768211457n
      const result = (await uints.contractInstance.methods.bigMul({ args: { a, b, bDenominator: 1n } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: 680564733841876926926749214863536422913n })
      // expected: 115792089237316195423570985008687907853950549399482440966384333222776666062849
      //     real: 115792089237316195423570985008687907853950549399482440966384333222776666062849
    }
    {
      const a = 115792089237316195423570985008687907853269984665640564039457584007913129639935n
      const b = 115792089237316195423570985008687907853269984665640564039457584007913129639935n
      const result = (await uints.contractInstance.methods.bigMul({ args: { a, b, bDenominator: 1n } })).returns
      expect(result).toStrictEqual({
        higher: 115792089237316195423570985008687907853269984665640564039457584007913129639934n,
        lower: 1n
      })
      // expected: 13407807929942597099574024998205846127479365820592393377723561443721764030073315392623399665776056285720014482370779510884422601683867654778417822746804225
      //     real: 13407807929942597099574024998205846127479365820592393377723561443721764030073315392623399665776056285720014482370779510884422601683867654778417822746804225
    }
    {
      const a = 500n
      const b = 0n
      const result = (await uints.contractInstance.methods.bigMul({ args: { a, b, bDenominator: 1n } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = 100n
      const b = 100n
      const result = (await uints.contractInstance.methods.bigMul({ args: { a, b, bDenominator: 100n } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 100n })
    }
    {
      const a = 30n
      const b = 1n
      const result = (await uints.contractInstance.methods.bigMul({ args: { a, b, bDenominator: 10n } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 3n })
    }
    {
      const a = 500n
      const b = 4000n
      const result = (await uints.contractInstance.methods.bigMul({ args: { a, b, bDenominator: 1000n } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2000n })
    }
    {
      const a = 10n
      const b = 37n
      const result = (await uints.contractInstance.methods.bigMul({ args: { a, b, bDenominator: 100n } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 3n })
    }
  })

  test('big mul up', async () => {
    const uints = await deployUints(sender)
    {
      const a = 123n
      const b = 2n
      const result = (await uints.contractInstance.methods.bigMulUp({ args: { a, b, bDenominator: 1n } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 246n })
      // expected: 246
      // real: 246
    }
    {
      const a = 340282366920938463463374607431768211457n
      const b = 340282366920938463463374607431768211457n
      const result = (await uints.contractInstance.methods.bigMulUp({ args: { a, b, bDenominator: 1n } })).returns
      expect(result).toStrictEqual({ higher: 1n, lower: 680564733841876926926749214863536422913n })
      // expected: 115792089237316195423570985008687907853950549399482440966384333222776666062849
      //     real: 115792089237316195423570985008687907853950549399482440966384333222776666062849
    }
    {
      const a = 115792089237316195423570985008687907853269984665640564039457584007913129639935n
      const b = 115792089237316195423570985008687907853269984665640564039457584007913129639935n
      const result = (await uints.contractInstance.methods.bigMulUp({ args: { a, b, bDenominator: 1n } })).returns
      expect(result).toStrictEqual({
        higher: 115792089237316195423570985008687907853269984665640564039457584007913129639934n,
        lower: 1n
      })
      // expected: 13407807929942597099574024998205846127479365820592393377723561443721764030073315392623399665776056285720014482370779510884422601683867654778417822746804225
      //     real: 13407807929942597099574024998205846127479365820592393377723561443721764030073315392623399665776056285720014482370779510884422601683867654778417822746804225
    }
    {
      const a = 500n
      const b = 0n
      const result = (await uints.contractInstance.methods.bigMulUp({ args: { a, b, bDenominator: 1n } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 0n })
    }
    {
      const a = 100n
      const b = 100n
      const result = (await uints.contractInstance.methods.bigMulUp({ args: { a, b, bDenominator: 100n } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 100n })
    }
    {
      const a = 30n
      const b = 1n
      const result = (await uints.contractInstance.methods.bigMulUp({ args: { a, b, bDenominator: 10n } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 3n })
    }
    {
      const a = 500n
      const b = 4000n
      const result = (await uints.contractInstance.methods.bigMulUp({ args: { a, b, bDenominator: 1000n } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 2000n })
    }
    {
      const a = 10n
      const b = 37n
      const result = (await uints.contractInstance.methods.bigMulUp({ args: { a, b, bDenominator: 100n } })).returns
      expect(result).toStrictEqual({ higher: 0n, lower: 4n })
    }
  })

  test('overflowing add', async () => {
    const uints = await deployUints(sender)
    {
      const a = 10n
      const b = 20n
      const result = (await uints.contractInstance.methods.overflowingAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual([30n, 0n])
    }
    {
      const a = 115792089237316195423570985008687907853269984665640564039457584007913129639935n
      const b = 20n
      const result = (await uints.contractInstance.methods.overflowingAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual([19n, 1n])
    }
  })

  test('wrapping add', async () => {
    const uints = await deployUints(sender)
    {
      const a = 10n
      const b = 20n
      const result = (await uints.contractInstance.methods.wrappingAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual(30n)
    }
    {
      const a = 115792089237316195423570985008687907853269984665640564039457584007913129639935n
      const b = 20n
      const result = (await uints.contractInstance.methods.wrappingAdd({ args: { a, b } })).returns
      expect(result).toStrictEqual(19n)
    }
  })
})
