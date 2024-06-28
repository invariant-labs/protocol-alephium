import { Address, ContractInstance, DUST_AMOUNT, SignerProvider } from '@alephium/web3'
import {
  AddFeeTier,
  ChangeProtocolFee,
  CreatePool,
  IncreasePositionLiquidity,
  InitializeEmptyPosition,
  InvariantInstance,
  RemoveFeeTier,
  RemovePosition,
  Swap,
  Withdraw,
  TokenFaucet,
  TokenFaucetInstance,
  WithdrawProtocolFee
} from '../artifacts/ts'
import {
  MAP_ENTRY_DEPOSIT,
  decodePool,
  decodePools,
  decodeFeeTiers,
  decodePosition,
  deployTokenFaucet
} from './utils'
import { expectAssertionError } from '@alephium/web3-test'

type TokenInstance = TokenFaucetInstance

export const objectEquals = (
  object: { [key: string]: any },
  expectedObject: { [key: string]: any },
  keys: string[]
) => {
  for (const key in object) {
    if (!keys.includes(key)) {
      expect(object[key]).toEqual(expectedObject[key])
    }
  }
}

export async function expectError(
  errorCode: bigint,
  script: Promise<any>,
  contract?: ContractInstance
) {
  if (contract) {
    return await expectAssertionError(script, contract.address, Number(errorCode))
  } else {
    try {
      await script
    } catch (e: any) {
      const err = e.toString()
      const regex = new RegExp(`${errorCode}$`)
      if (!regex.test(err)) {
        console.log(err)
        throw new Error('Invalid Error message')
      }
    }
  }
}

export async function expectVMError(error: string, script: Promise<any>) {
  let isError: boolean = false
  try {
    await script
  } catch (e: unknown) {
    if (e instanceof Error) {
      const regex = new RegExp('VM execution error: ' + error)
      const regexResult = regex.exec(e.message)

      isError = regexResult ? true : false
    }
  }

  expect(isError).toBeTruthy()
}

export async function initTokensXY(signer: SignerProvider, supply: bigint) {
  const token0 = TokenFaucet.at(
    (await deployTokenFaucet(signer, '', '', supply, supply)).contractInstance.address
  )
  const token1 = TokenFaucet.at(
    (await deployTokenFaucet(signer, '', '', supply, supply)).contractInstance.address
  )

  return token0.contractId < token1.contractId ? [token0, token1] : [token1, token0]
}

export async function initFeeTier(
  invariant: InvariantInstance,
  signer: SignerProvider,
  fee: bigint,
  tickSpacing: bigint
) {
  return await AddFeeTier.execute(signer, {
    initialFields: {
      invariant: invariant.contractId,
      fee,
      tickSpacing
    },
    attoAlphAmount: MAP_ENTRY_DEPOSIT
  })
}

export async function feeTierExists(
  invariant: InvariantInstance,
  ...feeTiers: { fee: bigint; tickSpacing: bigint }[]
) {
  let tierStatus: Array<boolean> = []
  for (const feeTier of feeTiers) {
    tierStatus.push(
      (
        await invariant.methods.feeTierExist({
          args: { fee: feeTier.fee, tickSpacing: feeTier.tickSpacing }
        })
      ).returns
    )
  }
  return tierStatus
}

export const removeFeeTier = async (
  invariant: InvariantInstance,
  signer: SignerProvider,
  fee: bigint,
  tickSpacing: bigint
) => {
  return await RemoveFeeTier.execute(signer, {
    initialFields: {
      invariant: invariant.contractId,
      fee,
      tickSpacing
    }
  })
}

export async function initPool(
  invariant: InvariantInstance,
  signer: SignerProvider,
  token0: TokenInstance,
  token1: TokenInstance,
  fee: bigint,
  tickSpacing: bigint,
  initSqrtPrice: bigint,
  initTick: bigint
) {
  return await CreatePool.execute(signer, {
    initialFields: {
      invariant: invariant.contractId,
      token0: token0.contractId,
      token1: token1.contractId,
      fee,
      tickSpacing,
      initSqrtPrice,
      initTick
    },
    attoAlphAmount: MAP_ENTRY_DEPOSIT * 2n
  })
}

export const withdrawProtocolFee = async (
  invariant: InvariantInstance,
  signer: SignerProvider,
  token0: TokenInstance,
  token1: TokenInstance,
  fee: bigint,
  tickSpacing: bigint
) => {
  return await WithdrawProtocolFee.execute(signer, {
    initialFields: {
      invariant: invariant.address,
      token0: token0.address,
      token1: token1.address,
      fee,
      tickSpacing
    },
    attoAlphAmount: DUST_AMOUNT
  })
}

export async function withdrawTokens(
  signer: SignerProvider,
  ...tokens: [token: TokenInstance, amount: bigint][]
) {
  for (const [tokenN, amountN] of tokens) {
    await Withdraw.execute(signer, {
      initialFields: {
        token: tokenN.contractId,
        amount: amountN
      },
      attoAlphAmount: DUST_AMOUNT
    })
  }
}

export async function getFeeTiers(invariant: InvariantInstance) {
  return decodeFeeTiers((await invariant.methods.getFeeTiers()).returns)
}

export async function getPool(
  invariant: InvariantInstance,
  token0: TokenInstance,
  token1: TokenInstance,
  fee: bigint,
  tickSpacing: bigint
) {
  return decodePool(
    (
      await invariant.methods.getPool({
        args: {
          token0: token0.contractId,
          token1: token1.contractId,
          fee,
          tickSpacing
        }
      })
    ).returns
  )
}

export const getPools = async (invariant: InvariantInstance) => {
  return decodePools((await invariant.methods.getPools()).returns)
}

export async function getPosition(invariant: InvariantInstance, owner: Address, index: bigint) {
  return decodePosition(
    (
      await invariant.methods.getPosition({
        args: {
          owner,
          index
        }
      })
    ).returns
  )
}

export const changeProtocolFee = async (
  invariant: InvariantInstance,
  signer: SignerProvider,
  newFee: bigint
) => {
  return await ChangeProtocolFee.execute(signer, {
    initialFields: {
      invariant: invariant.contractId,
      newFee
    }
  })
}

export const getProtocolFee = async (invariant: InvariantInstance) => {
  return (await invariant.methods.getProtocolFee()).returns
}

export async function initPositionWithLiquidity(
  invariant: InvariantInstance,
  signer: SignerProvider,
  token0: TokenInstance,
  token0Amount: bigint,
  token1: TokenInstance,
  token1Amount: bigint,
  fee: bigint,
  tickSpacing: bigint,
  lowerTick: bigint,
  upperTick: bigint,
  liquidity: bigint,
  index: bigint,
  slippageLimitLower: bigint,
  slippageLimitUpper: bigint
) {
  await InitializeEmptyPosition.execute(signer, {
    initialFields: {
      invariant: invariant.contractId,
      token0: token0.contractId,
      token1: token1.contractId,
      fee,
      tickSpacing,
      lowerTick,
      upperTick
    },
    attoAlphAmount: MAP_ENTRY_DEPOSIT * 6n
  })

  return await IncreasePositionLiquidity.execute(signer, {
    initialFields: {
      invariant: invariant.contractId,
      token0: token0.contractId,
      token1: token1.contractId,
      approvedTokens0: token0Amount,
      approvedTokens1: token1Amount,
      index,
      fee,
      tickSpacing,
      lowerTick: lowerTick,
      upperTick: upperTick,
      liquidityDelta: liquidity,
      slippageLimitLower,
      slippageLimitUpper
    },
    tokens: [
      { id: token0.contractId, amount: token0Amount },
      { id: token1.contractId, amount: token1Amount }
    ]
  })
}

export const quote = async (
  invariant: InvariantInstance,
  signer: SignerProvider,
  token0: TokenInstance,
  token1: TokenInstance,
  fee: bigint,
  tickSpacing: bigint,
  xToY: boolean,
  amount: bigint,
  byAmountIn: boolean,
  sqrtPriceLimit: bigint
) => {
  return (
    await invariant.methods.quote({
      args: {
        token0: token0.contractId,
        token1: token1.contractId,
        fee,
        tickSpacing,
        xToY,
        amount,
        byAmountIn,
        sqrtPriceLimit
      }
    })
  ).returns
}

export const removePosition = async (
  invariant: InvariantInstance,
  signer: SignerProvider,
  index: bigint
) => {
  return await RemovePosition.execute(signer, {
    initialFields: {
      invariant: invariant.contractId,
      index
    }
  })
}

export async function initSwap(
  invariant: InvariantInstance,
  signer: SignerProvider,
  token0: TokenInstance,
  token1: TokenInstance,
  fee: bigint,
  tickSpacing: bigint,
  xToY: boolean,
  amount: bigint,
  byAmountIn: boolean,
  sqrtPriceLimit: bigint
) {
  const id = xToY ? token0.contractId : token1.contractId
  return await Swap.execute(signer, {
    initialFields: {
      invariant: invariant.contractId,
      token0: token0.contractId,
      token1: token1.contractId,
      fee,
      tickSpacing,
      xToY,
      amount,
      byAmountIn,
      sqrtPriceLimit
    },
    tokens: [{ id, amount }]
  })
}

export const getTick = async (
  invariant: InvariantInstance,
  token0: TokenInstance,
  token1: TokenInstance,
  fee: bigint,
  tickSpacing: bigint,
  index: bigint
) => {
  return (
    await invariant.methods.getTick({
      args: {
        token0: token0.contractId,
        token1: token1.contractId,
        fee,
        tickSpacing,
        index
      }
    })
  ).returns
}

export const isTickInitialized = async (
  invariant: InvariantInstance,
  token0: TokenInstance,
  token1: TokenInstance,
  fee: bigint,
  tickSpacing: bigint,
  index: bigint
) => {
  return (
    await invariant.view.isTickInitialized({
      args: {
        token0: token0.contractId,
        token1: token1.contractId,
        fee,
        tickSpacing,
        index
      }
    })
  ).returns
}
