import { BaseSignature } from "../baseCoin/iface";

export class Signature implements BaseSignature {
  /**
   * Constructor
   * @param signature hex-encoded
   */
  constructor(public signature: string) { }
}
