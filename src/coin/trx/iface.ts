import { ContractType, PermissionType, ContractTypeUrl } from "./enum";
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

export class TronTransaction extends protocol.Transaction {
  constructor(tx: protocol.Transaction, txID: string) {
    super(tx);
    this.txID = txID;
  }

  txID: string;
}

export interface SignTransaction {
  txID: string, 
  signature: Array<string>,
}

// /**
//  * This interface represents a form of:
//  * @external https://github.com/BitGo/bitgo-account-lib/blob/5f282588701778a4421c75fa61f42713f56e95b9/resources/trx/protobuf/tron.proto#L239
//  */
// export interface TransactionReceipt {
//   /**
//    * This does not exist in protobuf because it's attached by the node rpc calls.
//    */
//   txID?: string;
//   raw_data: RawData;
//   raw_data_hex: string;
//   signature?: Array<string>;
// }

// export interface RawDataRootFields {
//   expiration: number;
//   timestamp: number;
//   ref_block_bytes: string;
//   ref_block_hash: string;
// }

// export interface RawData extends RawDataRootFields { 
//   contract: Array<ContractContainer> 
// };

// export interface ContractContainer {
//   parameter: { 
//     value: TransferContract | AccountPermissionUpdateContract;
//     type_url: ContractTypeUrl;
//   }
//   type: ContractType;
// }

// export interface TransferContract {
//   amount: number;
//   // base58 encoded addresses
//   to_address: string;
//   owner_address: string;
// }

// export interface AccountPermissionUpdateContract {
//   owner_address: string;
//   owner: PermissionContainer;
//   witness?: PermissionContainer;
//   actives: Array<PermissionContainer>;
// }

// export interface PermissionContainer {
//   keys: Array<PermissionKey>;
//   // hex-encoded
//   operations: string; 
//   permission_name: string;
//   threshold: Number;
//   type?: string;
// }

// export interface PermissionKey {
//   address: string;
//   weight: number;
// }
