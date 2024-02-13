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
import { default as LogContractJson } from "../math/Log.ral.json";
import { getContractByCodeHash } from "./contracts";

// Custom types for the contract
export namespace LogTypes {
  export type State = Omit<ContractState<any>, "fields">;

  export interface CallMethodTable {
    getLog2Scale: {
      params: Omit<CallContractParams<{}>, "args">;
      result: CallContractResult<bigint>;
    };
    getLog2DoubleScale: {
      params: Omit<CallContractParams<{}>, "args">;
      result: CallContractResult<bigint>;
    };
    getLog2One: {
      params: Omit<CallContractParams<{}>, "args">;
      result: CallContractResult<bigint>;
    };
    getLog2Half: {
      params: Omit<CallContractParams<{}>, "args">;
      result: CallContractResult<bigint>;
    };
    getLog2Two: {
      params: Omit<CallContractParams<{}>, "args">;
      result: CallContractResult<bigint>;
    };
    getLog2DoubleOne: {
      params: Omit<CallContractParams<{}>, "args">;
      result: CallContractResult<bigint>;
    };
    getLog2Sqrt10001: {
      params: Omit<CallContractParams<{}>, "args">;
      result: CallContractResult<bigint>;
    };
    getLog2NegativeMaxLose: {
      params: Omit<CallContractParams<{}>, "args">;
      result: CallContractResult<bigint>;
    };
    getLog2MinBinaryPosition: {
      params: Omit<CallContractParams<{}>, "args">;
      result: CallContractResult<bigint>;
    };
    getLog2Accuracy: {
      params: Omit<CallContractParams<{}>, "args">;
      result: CallContractResult<bigint>;
    };
    getSqrtPriceDenominator: {
      params: Omit<CallContractParams<{}>, "args">;
      result: CallContractResult<bigint>;
    };
    sqrtPriceToX32: {
      params: CallContractParams<{ val: bigint }>;
      result: CallContractResult<bigint>;
    };
    getMaxSqrtPrice: {
      params: Omit<CallContractParams<{}>, "args">;
      result: CallContractResult<bigint>;
    };
    getMinSqrtPrice: {
      params: Omit<CallContractParams<{}>, "args">;
      result: CallContractResult<bigint>;
    };
    log2FloorX32: {
      params: CallContractParams<{ sqrtPrice: bigint }>;
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

class Factory extends ContractFactory<LogInstance, {}> {
  at(address: string): LogInstance {
    return new LogInstance(address);
  }

  tests = {
    getLog2Scale: async (
      params?: Omit<
        TestContractParams<never, never>,
        "testArgs" | "initialFields"
      >
    ): Promise<TestContractResult<bigint>> => {
      return testMethod(
        this,
        "getLog2Scale",
        params === undefined ? {} : params
      );
    },
    getLog2DoubleScale: async (
      params?: Omit<
        TestContractParams<never, never>,
        "testArgs" | "initialFields"
      >
    ): Promise<TestContractResult<bigint>> => {
      return testMethod(
        this,
        "getLog2DoubleScale",
        params === undefined ? {} : params
      );
    },
    getLog2One: async (
      params?: Omit<
        TestContractParams<never, never>,
        "testArgs" | "initialFields"
      >
    ): Promise<TestContractResult<bigint>> => {
      return testMethod(this, "getLog2One", params === undefined ? {} : params);
    },
    getLog2Half: async (
      params?: Omit<
        TestContractParams<never, never>,
        "testArgs" | "initialFields"
      >
    ): Promise<TestContractResult<bigint>> => {
      return testMethod(
        this,
        "getLog2Half",
        params === undefined ? {} : params
      );
    },
    getLog2Two: async (
      params?: Omit<
        TestContractParams<never, never>,
        "testArgs" | "initialFields"
      >
    ): Promise<TestContractResult<bigint>> => {
      return testMethod(this, "getLog2Two", params === undefined ? {} : params);
    },
    getLog2DoubleOne: async (
      params?: Omit<
        TestContractParams<never, never>,
        "testArgs" | "initialFields"
      >
    ): Promise<TestContractResult<bigint>> => {
      return testMethod(
        this,
        "getLog2DoubleOne",
        params === undefined ? {} : params
      );
    },
    getLog2Sqrt10001: async (
      params?: Omit<
        TestContractParams<never, never>,
        "testArgs" | "initialFields"
      >
    ): Promise<TestContractResult<bigint>> => {
      return testMethod(
        this,
        "getLog2Sqrt10001",
        params === undefined ? {} : params
      );
    },
    getLog2NegativeMaxLose: async (
      params?: Omit<
        TestContractParams<never, never>,
        "testArgs" | "initialFields"
      >
    ): Promise<TestContractResult<bigint>> => {
      return testMethod(
        this,
        "getLog2NegativeMaxLose",
        params === undefined ? {} : params
      );
    },
    getLog2MinBinaryPosition: async (
      params?: Omit<
        TestContractParams<never, never>,
        "testArgs" | "initialFields"
      >
    ): Promise<TestContractResult<bigint>> => {
      return testMethod(
        this,
        "getLog2MinBinaryPosition",
        params === undefined ? {} : params
      );
    },
    getLog2Accuracy: async (
      params?: Omit<
        TestContractParams<never, never>,
        "testArgs" | "initialFields"
      >
    ): Promise<TestContractResult<bigint>> => {
      return testMethod(
        this,
        "getLog2Accuracy",
        params === undefined ? {} : params
      );
    },
    getSqrtPriceDenominator: async (
      params?: Omit<
        TestContractParams<never, never>,
        "testArgs" | "initialFields"
      >
    ): Promise<TestContractResult<bigint>> => {
      return testMethod(
        this,
        "getSqrtPriceDenominator",
        params === undefined ? {} : params
      );
    },
    sqrtPriceToX32: async (
      params: Omit<TestContractParams<never, { val: bigint }>, "initialFields">
    ): Promise<TestContractResult<bigint>> => {
      return testMethod(this, "sqrtPriceToX32", params);
    },
    getMaxSqrtPrice: async (
      params?: Omit<
        TestContractParams<never, never>,
        "testArgs" | "initialFields"
      >
    ): Promise<TestContractResult<bigint>> => {
      return testMethod(
        this,
        "getMaxSqrtPrice",
        params === undefined ? {} : params
      );
    },
    getMinSqrtPrice: async (
      params?: Omit<
        TestContractParams<never, never>,
        "testArgs" | "initialFields"
      >
    ): Promise<TestContractResult<bigint>> => {
      return testMethod(
        this,
        "getMinSqrtPrice",
        params === undefined ? {} : params
      );
    },
    log2FloorX32: async (
      params: Omit<
        TestContractParams<never, { sqrtPrice: bigint }>,
        "initialFields"
      >
    ): Promise<TestContractResult<bigint>> => {
      return testMethod(this, "log2FloorX32", params);
    },
  };
}

// Use this object to test and deploy the contract
export const Log = new Factory(
  Contract.fromJson(
    LogContractJson,
    "",
    "a164dca8515c4547a97a50d7b8fe21bff48d38276ed799f0a38df5c28ca3e289"
  )
);

// Use this class to interact with the blockchain
export class LogInstance extends ContractInstance {
  constructor(address: Address) {
    super(address);
  }

  async fetchState(): Promise<LogTypes.State> {
    return fetchContractState(Log, this);
  }

  methods = {
    getLog2Scale: async (
      params?: LogTypes.CallMethodParams<"getLog2Scale">
    ): Promise<LogTypes.CallMethodResult<"getLog2Scale">> => {
      return callMethod(
        Log,
        this,
        "getLog2Scale",
        params === undefined ? {} : params,
        getContractByCodeHash
      );
    },
    getLog2DoubleScale: async (
      params?: LogTypes.CallMethodParams<"getLog2DoubleScale">
    ): Promise<LogTypes.CallMethodResult<"getLog2DoubleScale">> => {
      return callMethod(
        Log,
        this,
        "getLog2DoubleScale",
        params === undefined ? {} : params,
        getContractByCodeHash
      );
    },
    getLog2One: async (
      params?: LogTypes.CallMethodParams<"getLog2One">
    ): Promise<LogTypes.CallMethodResult<"getLog2One">> => {
      return callMethod(
        Log,
        this,
        "getLog2One",
        params === undefined ? {} : params,
        getContractByCodeHash
      );
    },
    getLog2Half: async (
      params?: LogTypes.CallMethodParams<"getLog2Half">
    ): Promise<LogTypes.CallMethodResult<"getLog2Half">> => {
      return callMethod(
        Log,
        this,
        "getLog2Half",
        params === undefined ? {} : params,
        getContractByCodeHash
      );
    },
    getLog2Two: async (
      params?: LogTypes.CallMethodParams<"getLog2Two">
    ): Promise<LogTypes.CallMethodResult<"getLog2Two">> => {
      return callMethod(
        Log,
        this,
        "getLog2Two",
        params === undefined ? {} : params,
        getContractByCodeHash
      );
    },
    getLog2DoubleOne: async (
      params?: LogTypes.CallMethodParams<"getLog2DoubleOne">
    ): Promise<LogTypes.CallMethodResult<"getLog2DoubleOne">> => {
      return callMethod(
        Log,
        this,
        "getLog2DoubleOne",
        params === undefined ? {} : params,
        getContractByCodeHash
      );
    },
    getLog2Sqrt10001: async (
      params?: LogTypes.CallMethodParams<"getLog2Sqrt10001">
    ): Promise<LogTypes.CallMethodResult<"getLog2Sqrt10001">> => {
      return callMethod(
        Log,
        this,
        "getLog2Sqrt10001",
        params === undefined ? {} : params,
        getContractByCodeHash
      );
    },
    getLog2NegativeMaxLose: async (
      params?: LogTypes.CallMethodParams<"getLog2NegativeMaxLose">
    ): Promise<LogTypes.CallMethodResult<"getLog2NegativeMaxLose">> => {
      return callMethod(
        Log,
        this,
        "getLog2NegativeMaxLose",
        params === undefined ? {} : params,
        getContractByCodeHash
      );
    },
    getLog2MinBinaryPosition: async (
      params?: LogTypes.CallMethodParams<"getLog2MinBinaryPosition">
    ): Promise<LogTypes.CallMethodResult<"getLog2MinBinaryPosition">> => {
      return callMethod(
        Log,
        this,
        "getLog2MinBinaryPosition",
        params === undefined ? {} : params,
        getContractByCodeHash
      );
    },
    getLog2Accuracy: async (
      params?: LogTypes.CallMethodParams<"getLog2Accuracy">
    ): Promise<LogTypes.CallMethodResult<"getLog2Accuracy">> => {
      return callMethod(
        Log,
        this,
        "getLog2Accuracy",
        params === undefined ? {} : params,
        getContractByCodeHash
      );
    },
    getSqrtPriceDenominator: async (
      params?: LogTypes.CallMethodParams<"getSqrtPriceDenominator">
    ): Promise<LogTypes.CallMethodResult<"getSqrtPriceDenominator">> => {
      return callMethod(
        Log,
        this,
        "getSqrtPriceDenominator",
        params === undefined ? {} : params,
        getContractByCodeHash
      );
    },
    sqrtPriceToX32: async (
      params: LogTypes.CallMethodParams<"sqrtPriceToX32">
    ): Promise<LogTypes.CallMethodResult<"sqrtPriceToX32">> => {
      return callMethod(
        Log,
        this,
        "sqrtPriceToX32",
        params,
        getContractByCodeHash
      );
    },
    getMaxSqrtPrice: async (
      params?: LogTypes.CallMethodParams<"getMaxSqrtPrice">
    ): Promise<LogTypes.CallMethodResult<"getMaxSqrtPrice">> => {
      return callMethod(
        Log,
        this,
        "getMaxSqrtPrice",
        params === undefined ? {} : params,
        getContractByCodeHash
      );
    },
    getMinSqrtPrice: async (
      params?: LogTypes.CallMethodParams<"getMinSqrtPrice">
    ): Promise<LogTypes.CallMethodResult<"getMinSqrtPrice">> => {
      return callMethod(
        Log,
        this,
        "getMinSqrtPrice",
        params === undefined ? {} : params,
        getContractByCodeHash
      );
    },
    log2FloorX32: async (
      params: LogTypes.CallMethodParams<"log2FloorX32">
    ): Promise<LogTypes.CallMethodResult<"log2FloorX32">> => {
      return callMethod(
        Log,
        this,
        "log2FloorX32",
        params,
        getContractByCodeHash
      );
    },
  };

  async multicall<Calls extends LogTypes.MultiCallParams>(
    calls: Calls
  ): Promise<LogTypes.MultiCallResults<Calls>> {
    return (await multicallMethods(
      Log,
      this,
      calls,
      getContractByCodeHash
    )) as LogTypes.MultiCallResults<Calls>;
  }
}
