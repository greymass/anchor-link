import {ChainName} from 'eosio-signing-request'
import {JsonRpc} from 'eosjs'
import {LinkTransport} from './link-transport'

export interface LinkOptions {
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
     * URL to link service.
     * Defaults to https://cb.anchor.link.
     */
    service?: string
    /**
     * Link transport, defaults to a console transport if omitted.
     */
    transport?: LinkTransport
    /**
     * Text encoder, only needed in old browsers or if used in node.js versions prior to v13.
     */
    textEncoder?: TextEncoder
    /**
     * Text decoder, only needed in old browsers or if used in node.js versions prior to v13.
     */
    textDecoder?: TextDecoder
}

export const defaults = {
    chainId: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
    rpc: 'https://eos.greymass.com',
    service: 'https://cb.anchor.link',
}
