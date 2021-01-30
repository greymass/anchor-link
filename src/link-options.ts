import type {APIClient} from '@greymass/eosio'
import type {ChainIdType} from 'eosio-signing-request'
import type {LinkStorage} from './link-storage'
import type {LinkTransport} from './link-transport'
import type {LinkCallbackService} from './link-callback'

/**
 * Type describing a EOSIO chain.
 */
export interface LinkChainConfig {
    /**
     * The chains unique 32-byte id.
     */
    chainId: ChainIdType
    /**
     * URL to EOSIO node to communicate with (or a @greymass/eosio APIClient instance).
     */
    nodeUrl: string | APIClient
}

/**
 * Available options when creating a new [[Link]] instance.
 */
export interface LinkOptions {
    /**
     * Link transport responsible for presenting signing requests to user, required.
     */
    transport: LinkTransport
    /**
     * Chain configurations to support.
     */
    chains?: LinkChainConfig[]
    /**
     * ChainID or esr chain name alias for which the link is valid.
     * @deprecated Use options.chains instead.
     */
    chainId?: ChainIdType
    /**
     * URL to EOSIO node to communicate with or a @greymass/eosio APIClient instance.
     * @deprecated Use options.chains instead.
     */
    client?: string | APIClient
    /**
     * URL to link callback service.
     * Defaults to https://cb.anchor.link.
     */
    service?: string | LinkCallbackService
    /**
     * Optional storage adapter that will be used to persist sessions if set.
     * If not storage adapter is set but the given transport provides a storage, that will be used.
     * Explicitly set this to `null` to force no storage.
     */
    storage?: LinkStorage | null
    /**
     * Whether to verify identity proofs submitted by the signer, default is true.
     * @note If this is disabled the login and identify methods will not return an account object.
     */
    verifyProofs?: boolean
}

export namespace LinkOptions {
    /** @internal */
    export const defaults = {
        service: 'https://cb.anchor.link',
    }
}
