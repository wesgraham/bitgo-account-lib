import {BaseCoin as CoinConfig} from "@bitgo/statics";
import {BaseTransaction} from "../../transaction";
import {convertFromRawTransaction, getBase58AddressFromBinary} from "./utils";
import BigNumber from "bignumber.js";
import {ParseTransactionError} from "../baseCoin/errors";
import {TransactionType} from "../baseCoin/enum";
import {BaseKey} from "../baseCoin/iface";
import {protocol} from "../../../resources/trx/protobuf/tron";
import * as crypto from 'crypto';
import {Signature, Utils} from ".";

export class Transaction extends BaseTransaction {
  private _transaction?: protocol.Transaction;

  /**
   *
   * @param coinConfig
   * @param rawTransaction
   */
  constructor(coinConfig: Readonly<CoinConfig>, rawTransaction?: string | TronTransaction) {
    super(coinConfig);
    if (rawTransaction) {
      let parsedTx: any = rawTransaction;
      if (typeof rawTransaction === 'string') {
        parsedTx = JSON.parse(rawTransaction);
      }

      // decode our transaction and set a txID;
      const decodedTx = this.decodeTransaction(parsedTx);
      this._transaction = decodedTx;

      // decode our raw data and record the fields
      if (!this._transaction.raw_data) {
        throw new ParseTransactionError('Failed to create raw data field on Transaction.');
      }

      const decodedRawData = new protocol.Transaction.raw(this._transaction.raw_data);
      // create our txID from raw_data_hex if we were not provided it
      this._id = decodedTx.txID ? decodedTx.txID : Transaction.createTxID(decodedRawData);
      this.recordRawDataFields(decodedRawData);

      // add our signatures if we have any
      if (this._transaction.signature) {
        this.addSignatures(this._transaction.signature);
      }
    }
  }

  public addSignatures(signatures: Uint8Array[]) {
    // we have signatures
    if (signatures && signatures.length > 0) {
      this._signatures = signatures.map(n => new Signature(Buffer.from(n).toString('hex')));
    }

    // reintroduce these signatures on our transaction
    if (this._transaction) {
      this._transaction.signature = signatures;
    }
  }

  private static createTxID(rawData: protocol.Transaction.raw): string {
    if (!rawData) {
      throw new ParseTransactionError('Empty transaction rawData field.');
    }

    const encodedBuffer = protocol.Transaction.raw.encode(rawData).finish();
    const newTxid = crypto.createHash('sha256').update(encodedBuffer).digest('hex');
    return newTxid;
  }

  /**
   * Parse the transaction raw data and record the most important fields.
   * @param rawData Object from a tron transaction
   */
  private recordRawDataFields(rawData: protocol.Transaction.Iraw) {
    this._validFrom = Number(rawData.timestamp);
    this._validTo = Number(rawData.expiration);

    if (!rawData.contract || rawData.contract.length > 1) {
      throw new ParseTransactionError('Failed raw data contract or too many contracts.');
    }

    const parameter = rawData.contract[0].parameter;
    if (!parameter || !parameter.value) {
      throw new ParseTransactionError('malformed contract');
    }

    switch (rawData.contract[0].type) {
      case protocol.Transaction.Contract.ContractType.TransferContract:
        const transferContract = protocol.TransferContract.decode(parameter.value);

        this._fromAddresses = [ { address: getBase58AddressFromBinary(transferContract.owner_address) } ];
        this._type = TransactionType.Send;
        const destination = {
          address: getBase58AddressFromBinary(transferContract.to_address),
          value: new BigNumber(Number(transferContract.amount)),
        };
        this._destination = [ destination ];
        break;
      case protocol.Transaction.Contract.ContractType.AccountPermissionUpdateContract:
        const contract = protocol.AccountPermissionUpdateContract.decode(parameter.value);

        this._fromAddresses = [ { address: getBase58AddressFromBinary(contract.owner_address) } ];
        this._type = TransactionType.WalletInitialization;
      default:
        throw new ParseTransactionError('Unsupported contract type');
    }
  }

  /**
   * Decodes a JSON encoded transaction.
   * @param raw raw_data_hex field from tron transactions. this should also have a txID
   */
  decodeTransaction(raw: any): TronTransaction {
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
   * Tron transaction do not contain the owners account address so it is not possible to check the
   * private key with any but the account main address. This is not enough to fail this check, so it
   * is a no-op.
   */
  canSign(key: BaseKey): boolean {
    return true;
  }

  toJson(): { [k: string]: any } {
    if (!this._transaction) {
      throw new ParseTransactionError('Empty transaction');
    }

    let baseObj = Utils.convertToRawTransaction(this._transaction);
    baseObj.txID = this._id;

    return baseObj;
  }
}

export class TronTransaction extends protocol.Transaction {
  constructor(tx: protocol.Transaction, txID: string) {
    super(tx);
    this.txID = txID;
  }

  txID: string;
}
