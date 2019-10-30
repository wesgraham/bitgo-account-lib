const tronweb = require('tronweb');

import { protocol } from '../../../resources/trx/protobuf/tron';

import * as assert from 'assert';
import { Account, SignTransaction } from './iface';
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
