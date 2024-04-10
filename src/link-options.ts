import type {APIClient} from '@wharfkit/antelope'
import type {ChainIdType} from '@wharfkit/signing-request'

import type {LinkCallbackService} from './link-callback'
import type {LinkChain} from './link'
import type {LinkStorage} from './link-storage'
import type {LinkTransport} from './link-transport'

/**
 * Type describing a EOSIO chain.
 */
export interface LinkChainConfig {
    /**
     * The chains unique 32-byte id.
     */
    chainId: ChainIdType
    /**
     * URL to EOSIO node to communicate with (or a @wharfkit/antelope APIClient instance).
     */
    nodeUrl: string | APIClient
}

/**
 * Available options when creating a new [[Link]] instance.
 */
export interface LinkOptions {
    /**
     * Link transport responsible for presenting signing requests to user.
     */
    transport: LinkTransport
    /**
     * Chain configurations to support.
     * For example for a link that can login and transact on EOS and WAX:
     * ```ts
     * [
     *     {
     *         chainId: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
     *         nodeUrl: 'https://eos.greymass.com',
     *     },
     *     {
     *         chainId: '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4',
     *         nodeUrl: 'https://wax.greymass.com',
     *     },
     * ]
     * ```
     */
    chains: (LinkChainConfig | LinkChain)[]
    /**
     * ChainID or esr chain name alias for which the link is valid.
     * @deprecated Use [[chains]] instead.
     */
    chainId?: ChainIdType
    /**
     * URL to EOSIO node to communicate with or a `@wharfkit/antelope` APIClient instance.
     * @deprecated Use [[chains]] instead.
     */
    client?: string | APIClient
    /**
     * URL to callback forwarder service or an object implementing [[LinkCallbackService]].
     * See [buoy-nodejs](https://github.com/greymass/buoy-nodejs) and (buoy-golang)[https://github.com/greymass/buoy-golang]
     * for reference implementations.
     * @default `https://cb.anchor.link`
     */
    service?: string | LinkCallbackService
    /**
     * Optional storage adapter that will be used to persist sessions. If not set will use the transport storage
     * if available, explicitly set this to `null` to force no storage.
     * @default Use transport storage.
     */
    storage?: LinkStorage | null
    /**
     * Whether to verify identity proofs submitted by the signer, if this is disabled the
     * [[Link.login | login]] and [[Link.identify | identify]] methods will not return an account object.
     * @default `false`
     */
    verifyProofs?: boolean
    /**
     * Whether to encode the chain ids with the identity request that establishes a session.
     * Only applicable when using multiple chain configurations, can be set to false to
     * decrease QR code sizes when supporting many chains.
     * @default `true`
     */
    encodeChainIds?: boolean
}

/** @internal */
export namespace LinkOptions {
    /** @internal */
    export const defaults = {
        service: 'https://cb.anchor.link',
        verifyProofs: false,
        encodeChainIds: true,
    }
}
