import {ChainName} from 'eosio-signing-request'
import {JsonRpc} from 'eosjs'
import {LinkStorage} from './link-storage'
import {LinkTransport} from './link-transport'

/**
 * Available options when creating a new [[Link]] instance.
 */
export interface LinkOptions {
    /**
     * Link transport responsible for presenting signing requests to user, required.
     */
    transport: LinkTransport
    /**
     * ChainID or esr chain name alias for which the link is valid.
     * Defaults to EOS (aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906).
     */
    chainId?: string | ChainName
    /**
     * URL to EOSIO node to communicate with or e eosjs JsonRpc instance.
     * Defaults to https://eos.greymass.com
     */
    rpc?: string | JsonRpc
    /**
     * URL to link callback service.
     * Defaults to https://cb.anchor.link.
     */
    service?: string
    /**
     * Optional storage adapter that will be used to persist sessions if set.
     * If not storage adapter is set but the given transport provides a storage, that will be used.
     * Explicitly set this to `null` to force no storage.
     */
    storage?: LinkStorage | null
    /**
     * Text encoder, only needed in old browsers or if used in node.js versions prior to v13.
     */
    textEncoder?: TextEncoder
    /**
     * Text decoder, only needed in old browsers or if used in node.js versions prior to v13.
     */
    textDecoder?: TextDecoder
}

/** @internal */
export const defaults = {
    chainId: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
    rpc: 'https://eos.greymass.com',
    service: 'https://cb.anchor.link',
}
