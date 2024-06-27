import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { getPool } from '../src/testUtils'
import { AddFeeTier, ChangeFeeReceiver, CreatePool } from '../artifacts/ts'
import { deployInvariant, deployTokenFaucet, MAP_ENTRY_DEPOSIT, expectError } from '../src/utils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let sender: PrivateKeyWallet

describe('change fee receiver tests', () => {
  beforeAll(async () => {
    sender = await getSigner(ONE_ALPH * 1000n, 0)
  })

  test('should change the fee receiver', async () => {
    const protocolFee = 10n ** 10n
    const fee = 6n * 10n ** 9n
    const tickSpacing = 10n

    const invariant = await deployInvariant(sender, protocolFee)

    const amount = 1000000n + 1000n

    const token0 = await deployTokenFaucet(sender, '', '', amount, amount)
    const token1 = await deployTokenFaucet(sender, '', '', amount, amount)

    await AddFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: fee,
        tickSpacing: tickSpacing
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT
    })

    await CreatePool.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        fee: fee,
        tickSpacing: tickSpacing,
        initSqrtPrice: 1000000000000000000000000n,
        initTick: 0n
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT * 2n
    })

    const newFeeReceiver = await getSigner(ONE_ALPH * 10n, 0)

    await ChangeFeeReceiver.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        fee: fee,
        tickSpacing: tickSpacing,
        newFeeReceiver: newFeeReceiver.address
      }
    })

    const pool = await getPool(
      invariant,
      token0.contractInstance,
      token1.contractInstance,
      fee,
      tickSpacing
    )

    expect(pool.feeReceiver).toBe(newFeeReceiver.address)

    const wrongReceiver = '0xInvalidAddress'
    await expectError(
      ChangeFeeReceiver.execute(sender, {
        initialFields: {
          invariant: invariant.contractId,
          token0: token0.contractInstance.contractId,
          token1: token1.contractInstance.contractId,
          fee: fee,
          tickSpacing: tickSpacing,
          newFeeReceiver: wrongReceiver
        }
      })
    )
  })

  test('should not allow non-admin to change fee receiver', async () => {
    const protocolFee = 10n ** 10n
    const fee = 6n * 10n ** 9n
    const tickSpacing = 10n

    const invariant = await deployInvariant(sender, protocolFee)

    const amount = 1000000n + 1000n

    const token0 = await deployTokenFaucet(sender, '', '', amount, amount)
    const token1 = await deployTokenFaucet(sender, '', '', amount, amount)

    await AddFeeTier.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        fee: fee,
        tickSpacing: tickSpacing
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT
    })

    await CreatePool.execute(sender, {
      initialFields: {
        invariant: invariant.contractId,
        token0: token0.contractInstance.contractId,
        token1: token1.contractInstance.contractId,
        fee: fee,
        tickSpacing: tickSpacing,
        initSqrtPrice: 1000000000000000000000000n,
        initTick: 0n
      },
      attoAlphAmount: MAP_ENTRY_DEPOSIT * 2n
    })

    const newFeeReceiver = await getSigner(ONE_ALPH * 10n, 1)

    await expectError(
      ChangeFeeReceiver.execute(newFeeReceiver, {
        initialFields: {
          invariant: invariant.contractId,
          token0: token0.contractInstance.contractId,
          token1: token1.contractInstance.contractId,
          fee: fee,
          tickSpacing: tickSpacing,
          newFeeReceiver: newFeeReceiver.address
        }
      })
    )
  })
})
