const tronweb = require('tronweb');

import { protocol } from '../../../resources/trx/protobuf/tron';

import * as assert from 'assert';
import { Account, TronTransaction, SignTransaction } from './iface';
import { ContractType, PermissionType } from './enum';
import { UtilsError, ParseTransactionError } from '../baseCoin/errors';
import Long = require('long');

/**
 * Tron-specific helper functions
 */
export type TronBinaryLike = ByteArray | TronBinary | string;
export type TronBinary = Buffer | Uint8Array;
export type ByteArray = number[];

export function generateAccount(): Account {
  return tronweb.utils.accounts.generateAccount();
}

export function isBase58Address(address: string): boolean {
  return tronweb.utils.crypto.isAddressValid(address);
}

export function isHexAddress(address: string): boolean {
  return tronweb.isAddress(address);
}

export function getByteArrayFromHexAddress(str: string): ByteArray {
  return tronweb.utils.code.hexStr2byteArray(str);
}

export function getHexAddressFromByteArray(arr: ByteArray): string {
  return tronweb.utils.code.byteArray2hexStr(arr);
}

/**
 * Indicates whether the passed string is a safe hex string for tron's purposes.
 * @param hex A valid hex string must be a string made of numbers and characters and has an even length.
 */
export function isValidHex(hex: string): Boolean {
  return /^(0x)?([0-9a-f]{2})+$/i.test(hex);
}

export function verifySignature(messageToVerify: string, base58Address: string, sigHex: string, useTronHeader: boolean = true): ByteArray {
  if (!isValidHex(sigHex)) {
    throw new UtilsError('signature is not in a valid format, needs to be hexadecimal');
  }

  if (!isValidHex(messageToVerify)) {
    throw new UtilsError('message is not in a valid format, needs to be hexadecimal');
  }

  if (!isBase58Address(base58Address)) {
    throw new UtilsError('address needs to be base58 encoded');
  }

  return tronweb.Trx.verifySignature(messageToVerify, base58Address, sigHex, useTronHeader);
}

export function getHexAddressFromBase58Address(base58: string): string {
  // pulled from: https://github.com/TRON-US/tronweb/blob/dcb8efa36a5ebb65c4dab3626e90256a453f3b0d/src/utils/help.js#L17
  // but they don't surface this call in index.js
  const bytes = tronweb.utils.crypto.decodeBase58Address(base58);
  return getHexAddressFromByteArray(bytes);
}

export function getPubKeyFromPriKey(privateKey: TronBinaryLike): ByteArray {
  return tronweb.utils.crypto.getPubKeyFromPriKey(privateKey);
}

export function getAddressFromPriKey(privateKey: TronBinaryLike): ByteArray {
  return tronweb.utils.crypto.getAddressFromPriKey(privateKey);
}

export function getBase58AddressFromBinary(address: TronBinary): string {
  const binaryAddr = Buffer.from(address).toString('hex');
  return getBase58AddressFromHex(binaryAddr);
}

export function getBase58AddressFromByteArray(address: ByteArray): string {
  return tronweb.utils.crypto.getBase58CheckAddress(address);
}

export function getBase58AddressFromHex(hex: string): string {
  const arr = getByteArrayFromHexAddress(hex);
  return getBase58AddressFromByteArray(arr);
}

export function signTransaction(privateKey: string | ByteArray, transaction: SignTransaction): SignTransaction {
  return tronweb.utils.crypto.signTransaction(privateKey, transaction);
}

export function signString(message: string, privateKey: string | ByteArray, useTronHeader: boolean = true): string {
  return tronweb.Trx.signString(message, privateKey, useTronHeader);
}

export function getRawAddressFromPubKey(pubBytes: ByteArray | string): ByteArray {
  return tronweb.utils.crypto.computeAddress(pubBytes);
}

/**
 * Decodes a JSON encoded transaction.
 * @param raw raw_data_hex field from tron transactions. this should also have a txID
 */
export function decodeTransaction(raw: any): TronTransaction {
  const rawTx = convertFromRawTransaction(raw);

  if (typeof rawTx.raw_data_hex !== 'string') {
    throw new ParseTransactionError('Failed to find raw data hex.');
  }

  const decodedRaw = protocol.Transaction.raw.decode(Buffer.from(rawTx.raw_data_hex, 'hex'));
  const decodedTx = new protocol.Transaction({ raw_data: decodedRaw, signature: raw.signature });

  // this doesn't come with a txID, so we have to attach it on the side
  return new TronTransaction(decodedTx, raw.txID);
}

/**
 * Converts a newly parsed tx to the transaction format that protobufjs expects.
 */
export function convertFromRawTransaction(rawTx: any): any {
  // we have to convert hex-encoded fields
  if (rawTx.signature && rawTx.signature.length) {
    rawTx.signature = rawTx.signature.map(n => Buffer.from(n, 'hex'));
  }

  rawTx.raw_data.ref_block_hash = Buffer.from(rawTx.raw_data.ref_block_hash, 'hex');
  rawTx.raw_data.ref_block_bytes = Buffer.from(rawTx.raw_data.ref_block_bytes, 'hex');

  if (rawTx.raw_data.contract && rawTx.raw_data.contract[0].type === 'TransferContract') {
    rawTx.raw_data.contract[0].type = 1;
  }

  return rawTx;
}

export function convertToRawTransaction(tx: protocol.Transaction): any {
  let rawTx: any = tx.toJSON();

  if (!tx.raw_data) {
    throw new UtilsError('Raw data field not found.');
  }

  // we have to convert hex-encoded fields
  if (tx.signature && tx.signature.length) {
    rawTx.signature = tx.signature.map(n => Buffer.from(n).toString('hex'));
  }

  if (rawTx.raw_data.contract && rawTx.raw_data.contract[0].type === 'TransferContract') {
    let value = rawTx.raw_data.contract[0].parameter.value;

    const transferContract = protocol.TransferContract.decode(Buffer.from(value, 'base64'));

    const owner_address = Buffer.from(transferContract.owner_address).toString('hex');
    const to_address = Buffer.from(transferContract.to_address).toString('hex');
    const amount = transferContract.amount.toString();

    rawTx.raw_data.contract[0].parameter.value = { owner_address, to_address, amount };
  }

  rawTx.raw_data.ref_block_hash = Buffer.from(rawTx.raw_data.ref_block_hash).toString('hex');
  rawTx.raw_data.ref_block_bytes = Buffer.from(rawTx.raw_data.ref_block_bytes).toString('hex');

  rawTx.raw_data_hex = Buffer.from(protocol.Transaction.raw.encode(tx.raw_data).finish()).toString('hex');

  return rawTx;
}

/**
 * Decodes a base64 encoded transaction in its protobuf representation.
 * @param hexString raw_data_hex field from tron transactions
 */
export function decodeRawTransaction(hexString: string): protocol.Transaction.raw {
  const bytes = Buffer.from(hexString, 'hex');

  const transaction = protocol.Transaction.raw.decode(bytes);

  return transaction;
}

// /**
//  * Decodes a base64 encoded transaction in its protobuf representation.
//  * @param hexString raw_data_hex field from tron transactions
//  */
// export function decodeTransaction(hexString: string): RawData {
//   let rawTransaction = decodeRawTransaction(hexString);
//   rawTransaction.contract = decodeContracts(hexString);
//   return rawTransaction;
// }

// export function decodeContracts(hexString: string): Array<ContractContainer> {
//   const raw = decodeTransactionHexString(hexString);

//   // there should not be multiple contracts in this data
//   if (raw.contract.length !== 1) {
//     throw new UtilsError('Number of contracts is greater than 1.');
//   }

//   let contractContainer: ContractContainer;

//   let contract: TransferContract | AccountPermissionUpdateContract;
//   let contractType: ContractType;

//   // ensure the contract type is supported
//   switch  (raw.contract[0].parameter.type_url) {
//     case 'type.googleapis.com/protocol.TransferContract':
//       contractType = ContractType.Transfer;

//       contract = this.decodeTransferContract(rawTransaction.contracts[0].parameter.value);
//       break;
//     case 'type.googleapis.com/protocol.AccountPermissionUpdateContract':
//       contractType = ContractType.AccountPermissionUpdate;
//       contract = this.decodeAccountPermissionUpdateContract(rawTransaction.contracts[0].parameter.value);
//       break;
//     default:
//       throw new UtilsError('Unsupported contract type');
//   }

//   return [ contractContainer ];
// }

// /**
//  * Decodes a transaction's raw field from a base64 encoded string. This is a protobuf representation.
//  * @param hexString this is the raw hexadecimal encoded string. Doc found in the following link.
//  * @example
//  * @see {@link https://github.com/BitGo/bitgo-account-lib/blob/5f282588701778a4421c75fa61f42713f56e95b9/resources/trx/protobuf/tron.proto#L319}
//  */
// export function decodeRawTransaction(hexString: string): RawDataRootFields {
//   const raw = decodeTransactionHexString(hexString);
//   return {
//     ref_block_num: raw.ref_block_num,
//     ref_block_bytes: raw.ref_block_bytes,
//     expiration: raw.expiration,
//     timestamp: raw.timestamp,
//   };
// }

// /**
//  * Decodes a raw hex string for a Transaction.
//  * @param hexString
//  */
// export function decodeTransactionHexString(hexString: string): any {
//   const bytes = Buffer.from(hexString, 'hex');

//   let raw;
//   try {
//     // we need to decode our raw_data_hex field first
//     raw = protocol.Transaction.raw.decode(bytes).toJSON();
//   } catch (e) {
//     throw new UtilsError('There was an error decoding the initial raw_data_hex from the serialized tx.');
//   }

//   return raw;
// }

// /** Deserialize the segment of the txHex which corresponds with the details of the transfer
//  * @param transferHex is the value property of the "parameter" field of contractList[0]
//  * */
// export function decodeTransferContract(transferHex: string): TransferContract {
//   const contractBytes = Buffer.from(transferHex, 'base64');
//   let transferContract;

//   try {
//     transferContract = protocol.TransferContract.decode(contractBytes).toJSON();
//   } catch (e) {
//     throw new UtilsError('There was an error decoding the transfer contract in the transaction.');
//   }

//   if (!transferContract.ownerAddress) {
//     throw new UtilsError('Owner address does not exist in this transfer contract.');
//   }

//   if (!transferContract.toAddress) {
//     throw new UtilsError('Destination address does not exist in this transfer contract.');
//   }

//   if (!transferContract.hasOwnProperty('amount')) {
//     throw new UtilsError('Amount does not exist in this transfer contract.');
//   }

//   // deserialize attributes
//   const ownerAddress = getBase58AddressFromByteArray(getByteArrayFromHexAddress(Buffer.from(transferContract.ownerAddress, 'base64').toString('hex')));
//   const toAddress = getBase58AddressFromByteArray(getByteArrayFromHexAddress(Buffer.from(transferContract.toAddress, 'base64').toString('hex')));
//   const amount = transferContract.amount;

//   return {
//     to_address: toAddress,
//     owner_address: ownerAddress,
//     amount,
//   };
// }

// /**
//  * Deserialize the segment of the txHex corresponding with the details of the contract which updates
//  * account permission
//  * @param {string} base64
//  * @returns {AccountPermissionUpdateContract}
//  */
// export function decodeAccountPermissionUpdateContract(base64: string): AccountPermissionUpdateContract {
//   const accountUpdateContract = protocol.AccountPermissionUpdateContract.decode(Buffer.from(base64, 'base64')).toJSON();
//   assert(accountUpdateContract.ownerAddress);
//   assert(accountUpdateContract.owner);
//   assert(accountUpdateContract.hasOwnProperty('actives'));

//   const ownerAddress = getBase58AddressFromByteArray(getByteArrayFromHexAddress(Buffer.from(accountUpdateContract.ownerAddress, 'base64').toString('hex')));
//   const owner: Permission = createPermission((accountUpdateContract.owner));
//   let witness: Permission | undefined = undefined;
//   if(accountUpdateContract.witness) {
//     witness = createPermission(accountUpdateContract.witness);
//   }
//   const activeList = accountUpdateContract.actives.map((active) => createPermission(active));

//   return {
//     owner_address: ownerAddress,
//     owner,
//     witness,
//     actives: activeList,
//   }
// }

// export function createPermission(raw: { permissionName: string, threshold: number}): Permission {
//   let permissionType: PermissionType;
//   const permission = raw.permissionName.toLowerCase().trim();
//   if (permission === 'owner') {
//     permissionType = PermissionType.Owner;
//   }
//   else if (permission === "witness") {
//     permissionType = PermissionType.Witness;
//   } else if (permission.substr(0,6) === "active") {
//     permissionType = PermissionType.Active;
//   } else {
//     throw new UtilsError('Permission type not parseable.');
//   }
//   return { type: permissionType, threshold: raw.threshold };
// }

