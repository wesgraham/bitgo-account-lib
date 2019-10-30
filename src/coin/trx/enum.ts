/**
 * Contract type describes a class of contract in a Transaction. This structure is used to identify what the Contract is.
 */
export enum ContractType {
  /**
   * This is a transfer of TRX contract.
   */
  Transfer = 'TransferContract',
  /**
   * This is the multi-sig initialization contract.
   */
  AccountPermissionUpdate = 'AccountPermissionUpdateContract',
}

export enum PermissionType {
  Owner,
  Witness,
  Active,
}
