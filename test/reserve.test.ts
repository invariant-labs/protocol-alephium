import { DUST_AMOUNT, ONE_ALPH, SignerProvider, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import {
  DepositSingleAsset,
  DepositTwoAssets,
  Reserve,
  ReserveInstance,
  SetStoredAssets,
  SwapAssets,
  TokenFaucetInstance,
  WithdrawSingleAsset,
  WithdrawTwoAssets
} from '../artifacts/ts'
import { expectError, expectVMError, initTokensXY, withdrawTokens } from '../src/testUtils'
import { balanceOf, waitTxConfirmed } from '../src/utils'
import { ReserveError, VMError } from '../src/consts'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

describe('reserve', () => {
  test('deposit single asset works correctly', async () => {
    const depositor = await getSigner(ONE_ALPH * 1000n, 0)
    const supply = 1000n
    const [tokenX] = await initTokensXY(depositor, supply)
    const reserve = await deployReserveWithAuthority(depositor)
    await withdrawTokens(depositor, [tokenX, supply])

    const deposit = 50n
    await depositSingleAsset(reserve, depositor, tokenX, deposit)

    const reserveBalance = await balanceOf(tokenX.contractId, reserve.address)
    expect(reserveBalance).toBe(50n)
  })

  test('deposit two assets works correctly', async () => {
    const depositor = await getSigner(ONE_ALPH * 1000n, 0)
    const supply = 1000n
    const [tokenX, tokenY] = await initTokensXY(depositor, supply)
    const reserve = await deployReserveWithAuthority(depositor)
    await withdrawTokens(depositor, [tokenX, supply], [tokenY, supply])

    const deposit = 75n
    await depositTwoAssets(reserve, depositor, tokenX, deposit, tokenY, deposit)

    const reserveBalance = {
      x: await balanceOf(tokenX.contractId, reserve.address),
      y: await balanceOf(tokenY.contractId, reserve.address)
    }
    expect(reserveBalance).toMatchObject({
      x: deposit,
      y: deposit
    })
  })

  test('withdraw single asset works correctly', async () => {
    const withdrawer = await getSigner(ONE_ALPH * 1000n, 0)
    const supply = 1000n
    const [tokenX] = await initTokensXY(withdrawer, supply)
    const reserve = await deployReserveWithAuthority(withdrawer)
    await withdrawTokens(withdrawer, [tokenX, supply])

    const deposit = 50n
    await depositSingleAsset(reserve, withdrawer, tokenX, deposit)

    const withdraw = 25n
    await withdrawSingleAsset(reserve, withdrawer, tokenX, withdraw)

    const deltaReserve = deposit - withdraw
    const reserveBalance = await balanceOf(tokenX.contractId, reserve.address)
    expect(reserveBalance).toBe(deltaReserve)
    const withdrawerBalance = await balanceOf(tokenX.contractId, withdrawer.address)
    expect(withdrawerBalance).toBe(supply - deltaReserve)
  })

  test('withdraw two assets works correctly', async () => {
    const withdrawer = await getSigner(ONE_ALPH * 1000n, 0)
    const supply = 1000n
    const [tokenX, tokenY] = await initTokensXY(withdrawer, supply)
    const reserve = await deployReserveWithAuthority(withdrawer)
    await withdrawTokens(withdrawer, [tokenX, supply], [tokenY, supply])

    const deposit = 75n
    await depositTwoAssets(reserve, withdrawer, tokenX, deposit, tokenY, deposit)

    const withdraw = 25n
    await withdrawTwoAssets(reserve, withdrawer, tokenX, withdraw, tokenY, withdraw)

    const deltaReserve = deposit - withdraw
    const reserveBalance = {
      x: await balanceOf(tokenX.contractId, reserve.address),
      y: await balanceOf(tokenY.contractId, reserve.address)
    }
    expect(reserveBalance).toMatchObject({
      x: deltaReserve,
      y: deltaReserve
    })
    const withdrawerBalance = {
      x: await balanceOf(tokenX.contractId, withdrawer.address),
      y: await balanceOf(tokenY.contractId, withdrawer.address)
    }
    expect(withdrawerBalance).toMatchObject({
      x: supply - deltaReserve,
      y: supply - deltaReserve
    })
  })

  test('swap assets works correctly', async () => {
    const swapper = await getSigner(ONE_ALPH * 1000n, 0)
    const supply = 1000n
    const deposit = 75n

    const [tokenX, tokenY] = await initTokensXY(swapper, supply)
    const reserve = await deployReserveWithAuthority(swapper)
    await withdrawTokens(swapper, [tokenX, deposit], [tokenY, deposit])

    await depositTwoAssets(reserve, swapper, tokenX, deposit, tokenY, deposit)

    const amountIn = 10n
    const outAmount = 20n
    await withdrawTokens(swapper, [tokenX, amountIn])

    const swapperBalanceBefore = {
      x: await balanceOf(tokenX.contractId, swapper.address),
      y: await balanceOf(tokenY.contractId, swapper.address)
    }

    await swapAssets(reserve, swapper, tokenX, tokenY, amountIn, outAmount)

    const reserveBalance = {
      x: await balanceOf(tokenX.contractId, reserve.address),
      y: await balanceOf(tokenY.contractId, reserve.address)
    }
    const swapperBalanceAfter = {
      x: await balanceOf(tokenX.contractId, swapper.address),
      y: await balanceOf(tokenY.contractId, swapper.address)
    }

    expect(reserveBalance).toMatchObject({
      x: deposit + amountIn,
      y: deposit - outAmount
    })
    expect(swapperBalanceAfter).toMatchObject({
      x: swapperBalanceBefore.x - amountIn,
      y: swapperBalanceBefore.y + outAmount
    })
  })

  test('reserve panics when storing above 8 assets', async () => {
    const depositor = await getSigner(ONE_ALPH * 1000n, 0)
    const reserve = await deployReserveWithAuthority(depositor)
    const supply = 1000n
    const deposit = 75n

    for (let i = 0; i < 4; i++) {
      const [tokenX, tokenY] = await initTokensXY(depositor, supply)

      await withdrawTokens(depositor, [tokenX, supply], [tokenY, supply])

      await depositTwoAssets(reserve, depositor, tokenX, deposit, tokenY, deposit)

      const reserveBalance = {
        x: await balanceOf(tokenX.contractId, reserve.address),
        y: await balanceOf(tokenY.contractId, reserve.address)
      }
      expect(reserveBalance).toMatchObject({
        x: deposit,
        y: deposit
      })
    }

    const [tokenX] = await initTokensXY(depositor, supply)

    await withdrawTokens(depositor, [tokenX, supply])
    await expectVMError(
      VMError.MaxStoredAssets,
      depositSingleAsset(reserve, depositor, tokenX, deposit)
    )
  })
  test('entrypoints prevent unauthorized user to perform transfers', async () => {
    const reserveOwner = await getSigner(ONE_ALPH * 1000n, 0)
    const unauthorizedUser = await getSigner(ONE_ALPH * 1000n, 0)
    const supply = 1000n
    const reserve = await deployReserveWithAuthority(reserveOwner)

    // deposits
    {
      const [tokenX, tokenY] = await initTokensXY(reserveOwner, supply)

      const deposit = 75n
      await withdrawTokens(unauthorizedUser, [tokenX, deposit], [tokenY, deposit])
      await expectError(
        ReserveError.NotInvariant,
        depositSingleAsset(reserve, unauthorizedUser, tokenX, deposit)
      )
      await expectError(
        ReserveError.NotInvariant,
        depositTwoAssets(reserve, unauthorizedUser, tokenX, deposit, tokenY, deposit)
      )
    }
    // withdrawals
    {
      const [tokenX, tokenY] = await initTokensXY(reserveOwner, supply)

      const deposit = 75n
      await withdrawTokens(reserveOwner, [tokenX, deposit], [tokenY, deposit])
      await depositTwoAssets(reserve, reserveOwner, tokenX, deposit, tokenY, deposit)

      await expectError(
        ReserveError.NotInvariant,
        withdrawSingleAsset(reserve, unauthorizedUser, tokenX, deposit)
      )
      await expectError(
        ReserveError.NotInvariant,
        withdrawTwoAssets(reserve, unauthorizedUser, tokenX, deposit, tokenY, deposit)
      )
    }
    // swap
    {
      const [tokenX, tokenY] = await initTokensXY(reserveOwner, supply)

      const deposit = 75n
      await withdrawTokens(reserveOwner, [tokenX, deposit], [tokenY, deposit])
      await depositTwoAssets(reserve, reserveOwner, tokenX, deposit, tokenY, deposit)

      const amountIn = 10n
      const amountOut = 20n
      await withdrawTokens(unauthorizedUser, [tokenX, amountIn], [tokenY, amountOut])

      await expectError(
        ReserveError.NotInvariant,
        swapAssets(reserve, unauthorizedUser, tokenX, tokenY, amountIn, amountOut)
      )
    }
  })
  test('Reserve assets counter cannot exceed 8', async () => {
    const reserveOwner = await getSigner(ONE_ALPH * 1000n, 0)
    const reserve = await deployReserveWithAuthority(reserveOwner)

    await setStoredAssets(reserve, reserveOwner, 8n)
    const storedAssets = await getStoredAssets(reserve)
    expect(storedAssets).toBe(8n)

    await expectError(ReserveError.OverCapacity, setStoredAssets(reserve, reserveOwner, 9n))
  })
})

const setStoredAssets = async (
  reserve: ReserveInstance,
  signer: PrivateKeyWallet,
  storedAssets: bigint
) => {
  return await SetStoredAssets.execute(signer, {
    initialFields: {
      reserve: reserve.contractId,
      v: storedAssets
    }
  })
}

const getStoredAssets = async (reserve: ReserveInstance) => {
  return (await reserve.view.getAssetsCount()).returns
}
const deployReserveWithAuthority = async (signer: PrivateKeyWallet) => {
  const deployResult = await waitTxConfirmed(
    Reserve.deploy(signer, {
      initialFields: {
        invariant: signer.address,
        assetsStored: 0n
      }
    })
  )
  return Reserve.at(deployResult.contractInstance.address)
}

const depositSingleAsset = async (
  reserve: ReserveInstance,
  depositor: PrivateKeyWallet,
  token: TokenFaucetInstance,
  amount: bigint
) => {
  return await DepositSingleAsset.execute(depositor, {
    initialFields: {
      reserve: reserve.contractId,
      id: token.contractId,
      amount: amount
    },
    tokens: [{ id: token.contractId, amount: amount }]
  })
}

const depositTwoAssets = async (
  reserve: ReserveInstance,
  depositor: PrivateKeyWallet,
  tokenX: TokenFaucetInstance,
  amountX: bigint,
  tokenY: TokenFaucetInstance,
  amountY: bigint
) => {
  return await DepositTwoAssets.execute(depositor, {
    initialFields: {
      reserve: reserve.contractId,
      xId: tokenX.contractId,
      yId: tokenY.contractId,
      x: amountX,
      y: amountY
    },
    tokens: [
      { id: tokenX.contractId, amount: amountX },
      { id: tokenY.contractId, amount: amountY }
    ]
  })
}

const withdrawSingleAsset = async (
  reserve: ReserveInstance,
  withdrawer: PrivateKeyWallet,
  token: TokenFaucetInstance,
  amount: bigint
) => {
  return await WithdrawSingleAsset.execute(withdrawer, {
    initialFields: {
      reserve: reserve.contractId,
      id: token.contractId,
      amount
    },
    attoAlphAmount: DUST_AMOUNT
  })
}

const withdrawTwoAssets = async (
  reserve: ReserveInstance,
  withdrawer: PrivateKeyWallet,
  tokenX: TokenFaucetInstance,
  amountX: bigint,
  tokenY: TokenFaucetInstance,
  amountY: bigint
) => {
  return await WithdrawTwoAssets.execute(withdrawer, {
    initialFields: {
      reserve: reserve.contractId,
      xId: tokenX.contractId,
      yId: tokenY.contractId,
      x: amountX,
      y: amountY
    },
    attoAlphAmount: DUST_AMOUNT * 2n
  })
}

const swapAssets = async (
  reserve: ReserveInstance,
  swapper: PrivateKeyWallet,
  tokenIn: TokenFaucetInstance,
  tokenOut: TokenFaucetInstance,
  inAmount: bigint,
  outAmount: bigint
) => {
  return await SwapAssets.execute(swapper, {
    initialFields: {
      reserve: reserve.contractId,
      inId: tokenIn.contractId,
      outId: tokenOut.contractId,
      in: inAmount,
      out: outAmount
    },
    tokens: [{ id: tokenIn.contractId, amount: inAmount }]
  })
}
