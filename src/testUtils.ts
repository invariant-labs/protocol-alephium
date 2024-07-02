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
  deployTokenFaucet,
  decodeTick
} from './utils'
import { expectAssertionError } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { VMError } from './consts'
import { FeeTier, PoolKey } from '../artifacts/ts/types'

type TokenInstance = TokenFaucetInstance

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

export async function expectVMError(error: VMError, script: Promise<any>) {
  let isError: boolean = false
  try {
    await script
  } catch (e: unknown) {
    if (e instanceof Error) {
      const regex = new RegExp(error)
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
  feeTier: FeeTier
) {
  return await AddFeeTier.execute(signer, {
    initialFields: {
      invariant: invariant.contractId,
      feeTier
    },
    attoAlphAmount: MAP_ENTRY_DEPOSIT
  })
}

export async function feeTierExists(invariant: InvariantInstance, ...feeTiers: FeeTier[]) {
  let tierStatus: Array<boolean> = []
  for (const feeTier of feeTiers) {
    tierStatus.push(
      (
        await invariant.methods.feeTierExist({
          args: { feeTier }
        })
      ).returns
    )
  }
  return tierStatus
}

export const removeFeeTier = async (
  invariant: InvariantInstance,
  signer: SignerProvider,
  feeTier: FeeTier
) => {
  return await RemoveFeeTier.execute(signer, {
    initialFields: {
      invariant: invariant.contractId,
      feeTier
    }
  })
}

export async function initPool(
  invariant: InvariantInstance,
  signer: SignerProvider,
  token0: TokenInstance,
  token1: TokenInstance,
  feeTier: FeeTier,
  initSqrtPrice: bigint,
  initTick: bigint
) {
  return await CreatePool.execute(signer, {
    initialFields: {
      invariant: invariant.contractId,
      token0: token0.contractId,
      token1: token1.contractId,
      feeTier,
      initSqrtPrice,
      initTick
    },
    attoAlphAmount: MAP_ENTRY_DEPOSIT * 2n
  })
}

export const withdrawProtocolFee = async (
  invariant: InvariantInstance,
  signer: SignerProvider,
  poolKey: PoolKey
) => {
  return await WithdrawProtocolFee.execute(signer, {
    initialFields: {
      invariant: invariant.address,
      poolKey
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

export async function getPool(invariant: InvariantInstance, poolKey: PoolKey) {
  return decodePool(
    (
      await invariant.methods.getPool({
        args: {
          poolKey
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
  signer: PrivateKeyWallet,
  poolKey: PoolKey,
  token0Amount: bigint,
  token1Amount: bigint,
  lowerTick: bigint,
  upperTick: bigint,
  liquidity: bigint,
  index: bigint,
  slippageLimitLower: bigint,
  slippageLimitUpper: bigint
) {
  expect((await getPosition(invariant, signer.address, index)).exist).toBeFalsy()

  await InitializeEmptyPosition.execute(signer, {
    initialFields: {
      invariant: invariant.contractId,
      poolKey,
      lowerTick,
      upperTick
    },
    attoAlphAmount: MAP_ENTRY_DEPOSIT * 6n
  })

  return await IncreasePositionLiquidity.execute(signer, {
    initialFields: {
      invariant: invariant.contractId,
      poolKey,
      approvedTokens0: token0Amount,
      approvedTokens1: token1Amount,
      index,
      lowerTick: lowerTick,
      upperTick: upperTick,
      liquidityDelta: liquidity,
      slippageLimitLower,
      slippageLimitUpper
    },
    tokens: [
      { id: poolKey.tokenX, amount: token0Amount },
      { id: poolKey.tokenY, amount: token1Amount }
    ]
  })
}

export const quote = async (
  invariant: InvariantInstance,
  poolKey: PoolKey,
  xToY: boolean,
  amount: bigint,
  byAmountIn: boolean,
  sqrtPriceLimit: bigint
) => {
  return (
    await invariant.methods.quote({
      args: {
        poolKey,
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
  poolKey: PoolKey,
  xToY: boolean,
  amount: bigint,
  byAmountIn: boolean,
  sqrtPriceLimit: bigint
) {
  const id = xToY ? poolKey.tokenX : poolKey.tokenY
  return await Swap.execute(signer, {
    initialFields: {
      invariant: invariant.contractId,
      poolKey,
      xToY,
      amount,
      byAmountIn,
      sqrtPriceLimit
    },
    tokens: [{ id, amount }]
  })
}

export const getTick = async (invariant: InvariantInstance, poolKey: PoolKey, index: bigint) => {
  return decodeTick(
    (
      await invariant.methods.getTick({
        args: {
          poolKey,
          index
        }
      })
    ).returns
  )
}

export const isTickInitialized = async (
  invariant: InvariantInstance,
  poolKey: PoolKey,
  index: bigint
) => {
  return (
    await invariant.view.isTickInitialized({
      args: {
        poolKey,
        index
      }
    })
  ).returns
}
