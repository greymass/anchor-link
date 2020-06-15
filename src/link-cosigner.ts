import * as esr from 'eosio-signing-request'
import {JsonRpc} from 'eosjs'

import {TransactArgs} from './link'
import {getFirstAuthorizer} from './utils'

export interface LinkCosigner {
    /**
     * The account to be used as the actor in the cosigning actions authorization
     */
    account: string
    /**
     * Whether this cosigner should be used for every transaction.
     *      defaults to undefined, meaning threshold will be used to determine if cosigned
     *      set to true to force all transactions to be cosigned
     */
    always?: boolean
    /**
     * The permission level to be used in the cosigning actions authorization
     */
    permission: string
    /**
     * The account name of the contract to use as the cosigning action
     */
    contract: string
    /**
     * The method name on the contract to use as the cosigning action
     */
    method: string
    /**
     * The CPU threshold the user account needs to be below for the cosigner action to be prepended
     *      defaults to 5000 (5ms) in the code
     *      set to a number value to raise or lower this threshold
     */
    threshold?: number
    /**
     * The URL that the transaction should be submitted to in order to retrieve the cosigning signature
     */
    url?: string
}

export async function attemptCosign(
    srcargs: TransactArgs,
    cosigner: LinkCosigner,
    rpc: JsonRpc
): Promise<TransactArgs> {
    const {always, threshold} = cosigner
    let args = Object.assign({}, srcargs)
    const signer = getFirstAuthorizer(args)
    // Check if this is already cosigned, and if so, just return
    if (signer.actor === cosigner.account && signer.permission === cosigner.permission) {
        return args
    }
    // If cosigning should always occur
    if (always) {
        args = prependCosigner(args, cosigner)
    } else {
        // load the current signer and inspect current resources
        const account = await rpc.get_account(signer.actor)
        const {available, max} = account.cpu_limit
        // if the user has less CPU than the threshold (5ms default), cosign
        if ((threshold && available < threshold) || available < 5000) {
            args = prependCosigner(args, cosigner)
        }
    }
    return args
}

export function prependCosigner(args: TransactArgs, cosigner: LinkCosigner): TransactArgs {
    const action = {
        account: cosigner.contract,
        name: cosigner.method,
        authorization: [{actor: cosigner.account, permission: cosigner.permission}],
        data: {},
    }
    if (args.action) {
        return {
            actions: [action, args.action],
        }
    }
    if (args.actions) {
        return {
            actions: [action, ...args.actions],
        }
    }
    if (args.transaction) {
        const actions: esr.abi.Action[] = [action, ...args.transaction.actions]
        const transaction: esr.abi.Transaction = {
            actions,
            context_free_actions: args.transaction.context_free_actions,
            delay_sec: args.transaction.delay_sec,
            expiration: args.transaction.expiration,
            max_cpu_usage_ms: args.transaction.max_cpu_usage_ms,
            max_net_usage_words: args.transaction.max_net_usage_words,
            ref_block_num: args.transaction.ref_block_num,
            ref_block_prefix: args.transaction.ref_block_prefix,
            transaction_extensions: args.transaction.transaction_extensions,
        }
        return {
            transaction,
        }
    }
    return args
}
