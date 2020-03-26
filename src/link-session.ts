import {SigningRequest} from 'eosio-signing-request'
import {ApiInterfaces} from 'eosjs'

import {SessionError} from './errors'
import {Link, TransactArgs} from './link'
import {LinkInfo} from './link-abi'
import {LinkTransport} from './link-transport'
import {abiEncode, sealMessage} from './utils'

/**
 * Type describing a link session that can create a eosjs compatible
 * signature provider and transact for a specific auth.
 */
export abstract class LinkSession {
    /** The underlying link instance used by the session. */
    abstract link: Link
    /** The public key the session can sign for. */
    abstract publicKey: string
    /** The EOSIO auth (a.k.a. permission level) the session can sign for. */
    abstract auth: {
        actor: string
        permission: string
    }
    /** Session type, e.g. 'channel'.  */
    abstract type: string
    /** Arbitrary metadata that will be serialized with the session. */
    abstract metadata: {[key: string]: any}
    /** Creates a eosjs compatible authority provider. */
    abstract makeAuthorityProvider(): ApiInterfaces.AuthorityProvider
    /** Creates a eosjs compatible signature provider that can sign for the session public key. */
    abstract makeSignatureProvider(): ApiInterfaces.SignatureProvider
    /**
     * Transact using this session.
     * @see Link#transact
     */
    abstract transact(args: TransactArgs)
    /** Returns a JSON-encodable object that can be passed to the constructor to recreate the session. */
    abstract serialize(): SerializedLinkSession
    /** Restore a previously serialized session. */
    static restore(link: Link, data: SerializedLinkSession): LinkSession {
        switch (data.type) {
            case 'channel':
                return new LinkChannelSession(link, data.data, data.metadata)
            case 'fallback':
                return new LinkFallbackSession(link, data.data, data.metadata)
            default:
                throw new Error('Unable to restore, session data invalid')
        }
    }
}

interface SerializedLinkSession {
    type: string
    metadata: {[key: string]: any}
    data: any
}

interface ChannelInfo {
    /** Public key requests are encrypted to. */
    key: string
    /** The wallet given channel name, usually the device name. */
    name: string
    /** The channel push url. */
    url: string
}

export interface LinkChannelSessionData {
    /** Authenticated user permission. */
    auth: {
        actor: string
        permission: string
    }
    /** Public key of authenticated user */
    publicKey: string
    /** The wallet channel url. */
    channel: ChannelInfo
    /** The private request key. */
    requestKey: string
}

/**
 * Link session that pushes requests over a channel.
 */
export class LinkChannelSession extends LinkSession implements LinkTransport {
    readonly link: Link
    readonly auth: {
        actor: string
        permission: string
    }
    readonly type = 'channel'
    readonly metadata
    readonly publicKey: string
    serialize: () => SerializedLinkSession
    private channel: ChannelInfo
    private timeout = 2 * 60 * 1000 // ms
    private encrypt: (request: SigningRequest) => Uint8Array

    constructor(link: Link, data: LinkChannelSessionData, metadata: any) {
        super()
        this.link = link
        this.auth = data.auth
        this.publicKey = data.publicKey
        this.channel = data.channel
        this.encrypt = (request) => {
            return sealMessage(request.encode(true, false), data.requestKey, data.channel.key)
        }
        this.metadata = {
            ...(metadata || {}),
            timeout: this.timeout,
            name: this.channel.name,
        }
        this.serialize = () => ({
            type: 'channel',
            data,
            metadata: this.metadata,
        })
    }

    onSuccess(request, result) {
        if (this.link.transport.onSuccess) {
            this.link.transport.onSuccess(request, result)
        }
    }

    onFailure(request, error) {
        if (this.link.transport.onFailure) {
            this.link.transport.onFailure(request, error)
        }
    }

    onRequest(request, cancel) {
        const info: LinkInfo = {
            expiration: new Date(Date.now() + this.timeout).toISOString().slice(0, -1),
        }
        if (this.link.transport.onSessionRequest) {
            this.link.transport.onSessionRequest(this, request, cancel)
        }
        setTimeout(() => {
            cancel(new SessionError('Wallet did not respond in time', 'E_TIMEOUT'))
        }, this.timeout + 500)
        request.data.info.push({
            key: 'link',
            value: abiEncode(info, 'link_info'),
        })
        this.link.rpc
            .fetchBuiltin(this.channel.url, {
                method: 'POST',
                headers: {
                    'X-Buoy-Wait': (this.timeout / 1000).toFixed(0),
                },
                body: this.encrypt(request),
            })
            .then((response) => {
                if (response.status !== 200) {
                    cancel(new SessionError('Unable to push message', 'E_DELIVERY'))
                } else {
                    // request delivered
                }
            })
            .catch((error) => {
                cancel(
                    new SessionError(
                        `Unable to reach link service (${error.message || String(error)})`,
                        'E_DELIVERY'
                    )
                )
            })
    }

    public makeSignatureProvider(): ApiInterfaces.SignatureProvider {
        return this.link.makeSignatureProvider([this.publicKey], this)
    }

    public makeAuthorityProvider(): ApiInterfaces.AuthorityProvider {
        return this.link.makeAuthorityProvider()
    }

    transact(args: TransactArgs) {
        return this.link.transact(args, this)
    }
}

export interface LinkFallbackSessionData {
    auth: {
        actor: string
        permission: string
    }
    publicKey: string
}

export class LinkFallbackSession extends LinkSession implements LinkTransport {
    readonly link: Link
    readonly auth: {
        actor: string
        permission: string
    }
    readonly type = 'fallback'
    readonly metadata: {[key: string]: any}
    readonly publicKey: string
    serialize: () => SerializedLinkSession

    constructor(link: Link, data: LinkFallbackSessionData, metadata: any) {
        super()
        this.link = link
        this.auth = data.auth
        this.publicKey = data.publicKey
        this.metadata = metadata || {}
        this.serialize = () => ({
            type: this.type,
            data,
            metadata: this.metadata,
        })
    }

    onSuccess(request, result) {
        if (this.link.transport.onSuccess) {
            this.link.transport.onSuccess(request, result)
        }
    }

    onFailure(request, error) {
        if (this.link.transport.onFailure) {
            this.link.transport.onFailure(request, error)
        }
    }

    onRequest(request, cancel) {
        if (this.link.transport.onSessionRequest) {
            this.link.transport.onSessionRequest(this, request, cancel)
        } else {
            this.link.transport.onRequest(request, cancel)
        }
    }

    public makeSignatureProvider(): ApiInterfaces.SignatureProvider {
        return this.link.makeSignatureProvider([this.publicKey], this)
    }

    public makeAuthorityProvider(): ApiInterfaces.AuthorityProvider {
        return this.link.makeAuthorityProvider()
    }

    transact(args: TransactArgs) {
        return this.link.transact(args, this)
    }
}
