import { ContractType, PermissionType } from "./enum";
import { protocol } from "../../../resources/trx/protobuf/tron";

export interface Account {
  publicKey: string;
  privateKey: string;
}

export interface Parameter {
  value: string;
  typeUrl: string;
}

export interface Contract {
  parameter: Parameter;
  type: string;
}

export interface SignTransaction {
  txID: string,
  signature: Array<string>,
}
