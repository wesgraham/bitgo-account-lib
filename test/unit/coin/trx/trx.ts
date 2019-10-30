import * as should from 'should';
import { TransactionBuilder } from '../../../../src';
import { TransactionType } from '../../../../src/coin/baseCoin/';
import {
  UnsignedBuildTransaction,
  FirstSigOnBuildTransaction,
  FirstPrivateKey,
  SecondSigOnBuildTransaction,
  SecondPrivateKey, FirstExpectedSig, SecondExpectedSig,
} from '../../../resources/trx';

describe('Tron test network', () => {
  let txBuilder: TransactionBuilder;

  beforeEach(() => {
    txBuilder = new TransactionBuilder({ coinName: 'ttrx '});
  });

  describe('Transaction from', () => {
    // test both code paths - the json'd string and transaction item
    [(rawItem) => JSON.stringify(rawItem), (rawItem) => rawItem].map((transformFn) => {
      it('should use from with a transfer contract for an unsigned tx', () => {
        txBuilder.from(transformFn(UnsignedBuildTransaction));
      });

      it('should use from with a transfer contract for a half-signed tx', () => {
        txBuilder.from(transformFn(FirstSigOnBuildTransaction));
      });

      it('should use from with a transfer contract for a fully signed tx', () => {
        txBuilder.from(transformFn(SecondSigOnBuildTransaction));
      });
    });
  });

  describe('Transaction sign', () => {
    beforeEach(() => {
      txBuilder = new TransactionBuilder({ coinName: 'ttrx '});
    });

    it('should sign an unsigned tx', () => {
      const txJson = JSON.stringify(UnsignedBuildTransaction);
      txBuilder.from(txJson);
      txBuilder.sign({ key: FirstPrivateKey });
    });

    it('should sign a signed tx with another key', () => {
      const txJson = JSON.stringify(FirstSigOnBuildTransaction);
      txBuilder.from(txJson);
      txBuilder.sign({ key: SecondPrivateKey });
    });

    it('should not duplicate an signed tx', (done) => {
      const txJson = JSON.stringify(FirstSigOnBuildTransaction);
      txBuilder.from(txJson);
      try {
        txBuilder.sign({ key: FirstPrivateKey });
        should.fail('didnt throw an error', 'throws an error');
      } catch {
        done();
      }
    });
  });

  describe('Transaction build', () => {
    beforeEach(() => {
      txBuilder = new TransactionBuilder({ coinName: 'ttrx '});
    });

    // test both code paths - the json'd string and transaction item
    [(rawItem) => JSON.stringify(rawItem), (rawItem) => rawItem].map((transformFn) => {
      it('should build an half signed tx', () => {
        txBuilder.from(transformFn(UnsignedBuildTransaction));
        txBuilder.sign({ key: FirstPrivateKey });

        const tx = txBuilder.build();

        tx.toJson().signature[0].should.equal(FirstExpectedSig);

        tx.id.should.equal(UnsignedBuildTransaction.txID);
        tx.type.should.equal(TransactionType.Send);
        tx.senders.length.should.equal(1);
        tx.senders[0].address.should.equal('TTsGwnTLQ4eryFJpDvJSfuGQxPXRCjXvZz');
        tx.destinations.length.should.equal(1);
        tx.destinations[0].address.should.equal('TNYssiPgaf9XYz3urBUqr861Tfqxvko47B');
        tx.destinations[0].value.toString().should.equal('1718');
      });

      it('should build a fully signed tx', () => {
        txBuilder.from(transformFn(FirstSigOnBuildTransaction));
        txBuilder.sign({ key: SecondPrivateKey});
        const tx = txBuilder.build();

        tx.toJson().signature[0].should.equal(FirstExpectedSig);
        tx.toJson().signature[1].should.equal(SecondExpectedSig);

        tx.id.should.equal(UnsignedBuildTransaction.txID);
        tx.type.should.equal(TransactionType.Send);
        tx.senders.length.should.equal(1);
        tx.senders[0].address.should.equal('TTsGwnTLQ4eryFJpDvJSfuGQxPXRCjXvZz');
        tx.destinations.length.should.equal(1);
        tx.destinations[0].address.should.equal('TNYssiPgaf9XYz3urBUqr861Tfqxvko47B');
        tx.destinations[0].value.toString().should.equal('1718');
        tx.validFrom.should.equal(1571811410819);
        tx.validTo.should.equal(1571811468000);
      });
    });
  });
});
