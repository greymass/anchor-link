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
    /** Creates a eosjs compatible signature provider that can sign for the session public key. */
    abstract makeSignatureProvider(): ApiInterfaces.SignatureProvider
    /**
     * Transact using this session.
     * @see Link#transact
     */
    abstract transact(args: TransactArgs)
    /** Returns a JSON-encodable object that can be passed to the constructor to recreate the session. */
    abstract serialize(): any
    /** Restore a previously serialized session. */
    static restore(link: Link, data: any): LinkSession {
        switch (data.type) {
            case 'channel':
                return new LinkChannelSession(link, data)
            case 'fallback':
                return new LinkFallbackSession(link, data)
            default:
                throw new Error('Unable to restore, session data invalid')
        }
    }
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
    readonly publicKey: string
    serialize: () => LinkChannelSessionData
    private channel: ChannelInfo
    private timeout = 2 * 60 * 1000 // ms
    private encrypt: (request: SigningRequest) => Uint8Array

    constructor(link: Link, data: LinkChannelSessionData) {
        super()
        this.link = link
        this.auth = data.auth
        this.publicKey = data.publicKey
        this.channel = data.channel
        this.encrypt = (request) => {
            return sealMessage(request.encode(true, false), data.requestKey, data.channel.key)
        }
        this.serialize = () => ({type: 'channel', ...data})
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
            this.link.transport.onSessionRequest(
                this,
                request,
                this.timeout,
                this.channel.name,
                cancel
            )
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

export class LinkFallbackSession extends LinkSession {
    readonly link: Link
    readonly auth: {
        actor: string
        permission: string
    }
    readonly publicKey: string
    serialize: () => LinkFallbackSessionData

    constructor(link: Link, data: LinkFallbackSessionData) {
        super()
        this.link = link
        this.auth = data.auth
        this.publicKey = data.publicKey
        this.serialize = () => ({type: 'fallback', ...data})
    }

    transact(args: TransactArgs) {
        return this.link.transact(args)
    }

    public makeSignatureProvider() {
        return this.link.makeSignatureProvider([this.publicKey])
    }
}
