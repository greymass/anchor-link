export interface LinkCosigner {
    /**
     * The account to be used as the actor in the cosigning actions authorization
     */
    account: string,
    /**
     * Whether this cosigner should be used for every transaction.
     *      defaults to undefined, meaning threshold will be used to determine if cosigned
     *      set to true to force all transactions to be cosigned
     */
    always?: boolean,
    /**
     * The permission level to be used in the cosigning actions authorization
     */
    permission: string,
    /**
     * The account name of the contract to use as the cosigning action
     */
    contract: string,
    /**
     * The method name on the contract to use as the cosigning action
     */
    method: string,
    /**
     * The CPU threshold the user account needs to be below for the cosigner action to be prepended
     *      defaults to 5000 (5ms) in the code
     *      set to a number value to raise or lower this threshold
     */
    threshold?: number,
    /**
     * The URL that the transaction should be submitted to in order to retrieve the cosigning signature
     */
    url?: string,
}
