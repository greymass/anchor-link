import {
    Name,
    NameType,
    PermissionLevel,
    PermissionLevelType,
    PrivateKey,
    PrivateKeyType,
    PublicKey,
    PublicKeyType,
    Serializer,
} from '@greymass/eosio'

import {SigningRequest} from 'eosio-signing-request'

import {SessionError} from './errors'
import {Link, TransactArgs, TransactOptions, TransactResult} from './link'
import {LinkTransport} from './link-transport'
import {LinkInfo, SealedMessage} from './link-types'
import {fetch, sealMessage} from './utils'

/**
 * Type describing a link session that can create a eosjs compatible
 * signature provider and transact for a specific auth.
 */
export abstract class LinkSession {
    /** The underlying link instance used by the session. */
    abstract link: Link
    /** App identifier that owns the session. */
    abstract identifier: Name
    /** The public key the session can sign for. */
    abstract publicKey: PublicKey
    /** The EOSIO auth (a.k.a. permission level) the session can sign for. */
    abstract auth: PermissionLevel
    /** Session type, e.g. 'channel'.  */
    abstract type: string
    /** Arbitrary metadata that will be serialized with the session. */
    abstract metadata: {[key: string]: any}
    /** Creates a eosjs compatible signature provider that can sign for the session public key. */
    abstract makeSignatureProvider(): any
    /**
     * Transact using this session. See [[Link.transact]].
     */
    abstract transact(args: TransactArgs, options?: TransactOptions): Promise<TransactResult>
    /** Returns a JSON-encodable object that can be used recreate the session. */
    abstract serialize(): SerializedLinkSession
    /**
     * Convenience, remove this session from associated [[Link]] storage if set.
     * Equivalent to:
     * ```ts
     * session.link.removeSession(session.identifier, session.auth)
     * ```
     */
    async remove() {
        if (this.link.storage) {
            await this.link.removeSession(this.identifier, this.auth)
        }
    }
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

/** @internal */
export interface SerializedLinkSession {
    type: string
    metadata: {[key: string]: any}
    data: any
}

/** @internal */
interface ChannelInfo {
    /** Public key requests are encrypted to. */
    key: PublicKeyType
    /** The wallet given channel name, usually the device name. */
    name: string
    /** The channel push url. */
    url: string
}

/** @internal */
export interface LinkChannelSessionData {
    /** App identifier that owns the session. */
    identifier: NameType
    /** Authenticated user permission. */
    auth: PermissionLevelType
    /** Public key of authenticated user */
    publicKey: PublicKeyType
    /** The wallet channel url. */
    channel: ChannelInfo
    /** The private request key. */
    requestKey: PrivateKeyType
}

/**
 * Link session that pushes requests over a channel.
 * @internal
 */
export class LinkChannelSession extends LinkSession implements LinkTransport {
    readonly link: Link
    readonly auth: PermissionLevel
    readonly identifier: Name
    readonly type = 'channel'
    readonly metadata
    readonly publicKey: PublicKey
    serialize: () => SerializedLinkSession
    private channel: ChannelInfo
    private timeout = 2 * 60 * 1000 // ms
    private encrypt: (request: SigningRequest) => SealedMessage

    constructor(link: Link, data: LinkChannelSessionData, metadata: any) {
        super()
        this.link = link
        this.auth = PermissionLevel.from(data.auth)
        this.publicKey = PublicKey.from(data.publicKey)
        this.channel = data.channel
        this.identifier = Name.from(data.identifier)
        const privateKey = PrivateKey.from(data.requestKey)
        const publicKey = PublicKey.from(data.channel.key)
        this.encrypt = (request) => {
            return sealMessage(request.encode(true, false), privateKey, publicKey)
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

    onRequest(request: SigningRequest, cancel) {
        const info = LinkInfo.from({
            expiration: new Date(Date.now() + this.timeout).toISOString().slice(0, -1),
        })
        if (this.link.transport.onSessionRequest) {
            this.link.transport.onSessionRequest(this, request, cancel)
        }
        setTimeout(() => {
            cancel(new SessionError('Wallet did not respond in time', 'E_TIMEOUT'))
        }, this.timeout + 500)
        request.setInfoKey('link', info)
        fetch(this.channel.url, {
            method: 'POST',
            headers: {
                'X-Buoy-Wait': (this.timeout / 1000).toFixed(0),
            },
            body: Serializer.encode({object: this.encrypt(request)}).array,
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

    prepare(request) {
        if (this.link.transport.prepare) {
            return this.link.transport.prepare(request, this)
        }
        return Promise.resolve(request)
    }

    showLoading() {
        if (this.link.transport.showLoading) {
            return this.link.transport.showLoading()
        }
    }

    public makeSignatureProvider(): any {
        return this.link.makeSignatureProvider([this.publicKey.toString()], this)
    }

    transact(args: TransactArgs, options?: TransactOptions) {
        return this.link.transact(args, options, this)
    }
}

/** @internal */
export interface LinkFallbackSessionData {
    auth: PermissionLevelType
    publicKey: PublicKeyType
    identifier: NameType
}

/**
 * Link session that sends every request over the transport.
 * @internal
 */
export class LinkFallbackSession extends LinkSession implements LinkTransport {
    readonly link: Link
    readonly auth: PermissionLevel
    readonly type = 'fallback'
    readonly identifier: Name
    readonly metadata: {[key: string]: any}
    readonly publicKey: PublicKey
    serialize: () => SerializedLinkSession

    constructor(link: Link, data: LinkFallbackSessionData, metadata: any) {
        super()
        this.link = link
        this.auth = PermissionLevel.from(data.auth)
        this.publicKey = PublicKey.from(data.publicKey)
        this.metadata = metadata || {}
        this.identifier = Name.from(data.identifier)
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

    prepare(request) {
        if (this.link.transport.prepare) {
            return this.link.transport.prepare(request, this)
        }
        return Promise.resolve(request)
    }

    showLoading() {
        if (this.link.transport.showLoading) {
            return this.link.transport.showLoading()
        }
    }

    public makeSignatureProvider(): any {
        return this.link.makeSignatureProvider([this.publicKey.toString()], this)
    }

    transact(args: TransactArgs, options?: TransactOptions) {
        return this.link.transact(args, options, this)
    }
}
