import { Address, DUST_AMOUNT, SignerProvider } from '@alephium/web3'
import {
  AddFeeTier,
  CreatePool,
  IncreasePositionLiquidity,
  InitializeEmptyPosition,
  InvariantInstance,
  Swap,
  Withdraw
} from '../artifacts/ts'
import { TokenFaucet, TokenFaucetInstance } from '../artifacts/ts/TokenFaucet'
import {
  MAP_ENTRY_DEPOSIT,
  decodeFeeTiers,
  decodePool,
  decodePosition,
  deployTokenFaucet
} from './utils'

type TokenInstance = TokenFaucetInstance

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
        await invariant.view.feeTierExist({
          args: { fee: feeTier.fee, tickSpacing: feeTier.tickSpacing }
        })
      ).returns
    )
  }
  return tierStatus
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
  return decodeFeeTiers((await invariant.view.getFeeTiers()).returns)
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
    tokens: [
      { id: token0.contractId, amount },
      { id: token1.contractId, amount }
    ]
  })
}
