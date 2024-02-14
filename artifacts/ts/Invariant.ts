/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import {
  Address,
  Contract,
  ContractState,
  TestContractResult,
  HexString,
  ContractFactory,
  EventSubscribeOptions,
  EventSubscription,
  CallContractParams,
  CallContractResult,
  TestContractParams,
  ContractEvent,
  subscribeContractEvent,
  subscribeContractEvents,
  testMethod,
  callMethod,
  multicallMethods,
  fetchContractState,
  ContractInstance,
  getContractEventsCurrentCount,
} from "@alephium/web3";
import { default as InvariantContractJson } from "../Invariant.ral.json";
import { getContractByCodeHash } from "./contracts";

// Custom types for the contract
export namespace InvariantTypes {
  export type Fields = {
    admin: Address;
    protocolFee: bigint;
    feeTierTemplateContractId: HexString;
    feeTierCount: bigint;
  };

  export type State = ContractState<Fields>;

  export interface CallMethodTable {
    getProtocolFee: {
      params: Omit<CallContractParams<{}>, "args">;
      result: CallContractResult<bigint>;
    };
    getFeeTierCount: {
      params: Omit<CallContractParams<{}>, "args">;
      result: CallContractResult<bigint>;
    };
  }
  export type CallMethodParams<T extends keyof CallMethodTable> =
    CallMethodTable[T]["params"];
  export type CallMethodResult<T extends keyof CallMethodTable> =
    CallMethodTable[T]["result"];
  export type MultiCallParams = Partial<{
    [Name in keyof CallMethodTable]: CallMethodTable[Name]["params"];
  }>;
  export type MultiCallResults<T extends MultiCallParams> = {
    [MaybeName in keyof T]: MaybeName extends keyof CallMethodTable
      ? CallMethodTable[MaybeName]["result"]
      : undefined;
  };
}

class Factory extends ContractFactory<
  InvariantInstance,
  InvariantTypes.Fields
> {
  getInitialFieldsWithDefaultValues() {
    return this.contract.getInitialFieldsWithDefaultValues() as InvariantTypes.Fields;
  }

  consts = {
    InvariantError: {
      InvalidTickSpacing: BigInt(0),
      InvalidFee: BigInt(1),
      NotAdmin: BigInt(2),
      FeeTierAlreadyExist: BigInt(3),
      FeeTierNotFound: BigInt(4),
    },
  };

  at(address: string): InvariantInstance {
    return new InvariantInstance(address);
  }

  tests = {
    getProtocolFee: async (
      params: Omit<TestContractParams<InvariantTypes.Fields, never>, "testArgs">
    ): Promise<TestContractResult<bigint>> => {
      return testMethod(this, "getProtocolFee", params);
    },
    addFeeTier: async (
      params: TestContractParams<
        InvariantTypes.Fields,
        { fee: bigint; tickSpacing: bigint }
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "addFeeTier", params);
    },
    removeFeeTier: async (
      params: TestContractParams<
        InvariantTypes.Fields,
        { fee: bigint; tickSpacing: bigint }
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "removeFeeTier", params);
    },
    getFeeTierCount: async (
      params: Omit<TestContractParams<InvariantTypes.Fields, never>, "testArgs">
    ): Promise<TestContractResult<bigint>> => {
      return testMethod(this, "getFeeTierCount", params);
    },
  };
}

// Use this object to test and deploy the contract
export const Invariant = new Factory(
  Contract.fromJson(
    InvariantContractJson,
    "",
    "deb937656eb5e44dc340d4459fdfedea34f7ec6ee2de1540f2cde7d035a9914c"
  )
);

// Use this class to interact with the blockchain
export class InvariantInstance extends ContractInstance {
  constructor(address: Address) {
    super(address);
  }

  async fetchState(): Promise<InvariantTypes.State> {
    return fetchContractState(Invariant, this);
  }

  methods = {
    getProtocolFee: async (
      params?: InvariantTypes.CallMethodParams<"getProtocolFee">
    ): Promise<InvariantTypes.CallMethodResult<"getProtocolFee">> => {
      return callMethod(
        Invariant,
        this,
        "getProtocolFee",
        params === undefined ? {} : params,
        getContractByCodeHash
      );
    },
    getFeeTierCount: async (
      params?: InvariantTypes.CallMethodParams<"getFeeTierCount">
    ): Promise<InvariantTypes.CallMethodResult<"getFeeTierCount">> => {
      return callMethod(
        Invariant,
        this,
        "getFeeTierCount",
        params === undefined ? {} : params,
        getContractByCodeHash
      );
    },
  };

  async multicall<Calls extends InvariantTypes.MultiCallParams>(
    calls: Calls
  ): Promise<InvariantTypes.MultiCallResults<Calls>> {
    return (await multicallMethods(
      Invariant,
      this,
      calls,
      getContractByCodeHash
    )) as InvariantTypes.MultiCallResults<Calls>;
  }
}
