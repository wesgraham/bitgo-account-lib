import { BaseCoin } from "../../baseCoin";
import BigNumber from 'bignumber.js';
import {Transaction, TronTransaction} from '../transaction';
// import { RawData, TransactionReceipt } from '../iface';
import { Key } from '../key';
import { ParseTransactionError, SigningError, BuildTransactionError } from '../../baseCoin/errors';
import { Address } from '../address';
import { BaseKey } from '../../baseCoin/iface';
import { decodeRawTransaction, isValidHex, signTransaction, isBase58Address } from "../utils";
import { BaseCoin as CoinConfig } from "@bitgo/statics";
import { protocol } from "../../../../resources/trx/protobuf/tron";
import { SignTransaction } from "../iface";

export class TrxBase implements BaseCoin {
  protected constructor(private _coinConfig: Readonly<CoinConfig>) { }

  public buildTransaction(transaction: Transaction): any {
    // This is a no-op since Tron transactions are built from
    if (!transaction.id) {
      throw new BuildTransactionError('A valid transaction must have an id');
    }
    return transaction;
  }

  /**
   * Parse transaction takes in raw JSON directly from the node.
   * @param rawTransaction The Tron transaction in JSON format as returned by the Tron lib or a
   *     stringifyed version of such JSON.
   */
  public parseTransaction(rawTransaction: TronTransaction | string): Transaction {
    return new Transaction(this._coinConfig, rawTransaction);
  }

  public sign(privateKey: Key, transaction: Transaction): Transaction {
    if (!transaction.senders) {
      throw new SigningError('transaction has no sender');
    }

    if (!transaction.destinations) {
      throw new SigningError('transaction has no receiver');
    }

    // store our signatures, since we want to compare the new sig to another in a later step
    let signedTx: SignTransaction;
    try {
      // create our previous signatures in a format the helper can use
      const txToBeSigned = { txID: transaction.id, signature: transaction.signatures.map(n => n.signature) };

      signedTx = signTransaction(privateKey.key, txToBeSigned);
    } catch (e) {
      throw new SigningError('Failed to sign transaction via helper.');
    }

    // ensure that we have more signatures than what we started with
    if (!signedTx.signature || transaction.signatures.length >= signedTx.signature.length) {
      throw new SigningError('Transaction signing did not return an additional signature.');
    }

    // add our signatures to the transaction
    transaction.addSignatures(signedTx.signature.map(n => Buffer.from(n, 'hex')));

    return new Transaction(this._coinConfig, JSON.stringify(transaction.toJson()));
  }

  /**
   * Validates a passed value. This is TRX units.
   */
  public validateValue(value: BigNumber): void {
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
    if (!isBase58Address(address.address)) {
      throw new Error(address + ' is not a valid base58 address.');
    }
  }

  public validateKey(key: BaseKey) {
    // TODO: determine format for key
    return true;
  }

  public displayName(): string {
    return this._coinConfig.fullName;
  }
}
