import { BaseCoin } from "../baseCoin";
import { coins, NetworkType } from '@bitgo/statics';
import BigNumber from "bignumber.js";
import { Transaction } from './transaction';
import Utils, { RawTransaction } from "./utils";
import { RawTransaction, ContractType } from "./iface";
import { Key } from "./key";
import { Signature } from "./signature";
import { ParseTransactionError, SigningError } from "../baseCoin/errors";
import { Address } from "./address";
import { BaseKey } from "../baseCoin/iface";
import { TransactionType } from "../baseCoin/enum";

const tronweb = require('tronweb');
const tronproto = require('../../../resources/trx/protobuf/tron_pb');
const contractproto = require('../../../resources/trx/protobuf/Contract_pb');

export default class Trx extends BaseCoin {
  public buildTransaction(transaction: Transaction): Transaction {
    // returns the format that will go to the full node,
    //   the structure of the transaction
    return transaction;
  }

  public parseTransaction(rawTransaction: any, transactionType: TransactionType): Transaction {
    const tx = new Transaction(this.network);

    if (typeof rawTransaction !== 'string') {
      throw new ParseTransactionError('Raw transaction needs to be a base64 encoded string.');
    }

    // store our transaction
    tx.rawTx = rawTransaction;
    tx.transactionType = transactionType;

    // try to parse our transaction
    let parsedTx: RawTransaction;
    try {
      parsedTx = Utils.decodeTransaction(rawTransaction);
    } catch (e) {
      throw new ParseTransactionError('Failed to decode transaction.');
    }

    switch (parsedTx.contractType) {
      case ContractType.AccountPermissionUpdate:
      case ContractType.Transfer: 
        tx.tx = parsedTx;
        break;
      default:
        throw new ParseTransactionError('This contract type is undefined or unsupported.');
    }

    return tx;
  }

  public sign(privateKey: Key, address: Address, transaction: Transaction): Signature {
    if (!transaction.txID) {
      throw new SigningError('txID needs to be set to sign.');
    }

    // we pass 0 signatures, since we want a fresh signature
    let signedTx: RawTransaction;
    let sig = new Signature();
    try {
      signedTx = Utils.signTransaction(privateKey.key, rawTx);
    } catch (e) {
      throw new SigningError('Failed to sign transaction via helper.');
    }

    if (signedTx.signature && signedTx.signature.length > 0) {
      sig.signature = signedTx.signature[0];
    } else {
      throw new SigningError('Transaction signing did not return an additional signature.');
    }

    if (transaction.existingSignatures && transaction.existingSignatures.some((sig) => signedTx.signature && signedTx.signature[0] === sig)) {
      throw new SigningError('Signing yielded an existing signature on the transaction.');
    }

    return sig;
  }
  
  /**
   * Validates a passed value. This is TRX units.
   */
  public validateValue(value: BigNumber) {
    if (value.isLessThanOrEqualTo(0)) {
      throw new Error('Value cannot be below zero.');
    }

    // max long in Java - assumed upper limit for a TRX transaction
    if (value.isGreaterThan(new BigNumber("9223372036854775807"))) {
      throw new Error('Value cannot be greater than handled by the javatron node.');
    }
  }

  public validateAddress(address: Address) {
    // assumes a base 58 address for our addresses
    if (!Utils.isBase58Address(address.address)) {
      throw new Error(address + ' is not a valid base58 address.');
    }
  }

  public validateKey(key: BaseKey) {
    // TODO: determine format for key
    return true;
  }

  get displayName(): string {
    return this.staticsCoin.fullName;
  }

  get maxFrom(): number {
    return 1;
  }

  get maxDestinations(): number {
    return 1;
  }

  constructor(network: NetworkType) {
    super(network);

    if (network === NetworkType.MAINNET) {
      this.staticsCoin = coins.get('TRX');
    } else if (network === NetworkType.TESTNET) {
      this.staticsCoin = coins.get('TTRX');
    }
  }
}