import {SignatureProvider, SigningRequest} from 'eosio-signing-request'
import {ApiInterfaces} from 'eosjs'
import * as ecc from 'eosjs-ecc'
import {EventEmitter} from 'events'

import {SessionError} from './errors'
import {Link, TransactArgs} from './link'
import {LinkInfo, SealedMessage} from './link-abi'
import {LinkTransport} from './link-transport'
import {abiEncode} from './utils'

export interface LinkSessionData {
    /** Authenticated user permission. */
    auth: {
        actor: string
        permission: string
    }
    /** Public key of authenticated user */
    publicKey: string
    /** The Wallet channel. */
    channel: string
    /** The public key used to encrypt requests. */
    channelKey: string
    /** The sequence number the channel is on. */
    channelSequence: number
    /** The private key used to sign requests */
    privateKey: string
}

function sealMessage(message: string, privateKey: string, publicKey: string) {
    const res = ecc.Aes.encrypt(privateKey, publicKey, message)
    const data: SealedMessage = {
        from: ecc.privateToPublic(privateKey),
        nonce: res.nonce.toString(),
        ciphertext: res.message,
        checksum: res.checksum,
    }
    return abiEncode(data, 'sealed_message')
}

/**
 * Link session, emits 'info' event when sequence number advances.
 */
export class LinkSession extends EventEmitter {
    readonly link: Link
    readonly auth: {
        actor: string
        permission: string
    }
    readonly publicKey: string

    private transport: LinkTransport
    private exporter: () => LinkSessionData

    constructor(link: Link, data: LinkSessionData) {
        super()
        this.link = link
        this.auth = data.auth
        this.publicKey = data.publicKey
        // private key never leaves closure unless exported explicitly
        let seq = data.channelSequence
        this.exporter = () => ({...data, channelSequence: seq})
        const {privateKey, channel, channelKey} = data
        const signatureProvider: SignatureProvider = {
            sign(message: string) {
                const signature = ecc.signHash(message, privateKey)
                return {signer: '', signature}
            },
        }
        this.transport = {
            onSuccess: (request, result) => {
                if (this.link.transport.onSuccess) {
                    this.link.transport.onSuccess(request, result)
                }
            },
            onFailure: (request, error) => {
                if (this.link.transport.onFailure) {
                    this.link.transport.onFailure(request, error)
                }
            },
            onRequest: (request: SigningRequest, cancel: (reason: string | Error) => void) => {
                seq++
                let info: LinkInfo = {seq}
                this.emit('info', info)
                request.data.info.push({key: 'link', value: abiEncode(info, 'link_info')})
                request.sign(signatureProvider)
                this.link.rpc
                    .fetchBuiltin(channel, {
                        method: 'POST',
                        headers: {
                            'X-Buoy-Wait': '60', // todo configurable timeout
                        },
                        body: sealMessage(request.encode(), privateKey, channelKey),
                    })
                    .then((response) => {
                        if (response.status !== 200) {
                            cancel(new SessionError('Unable to push message', 'E_DELIVERY'))
                        } else {
                            setTimeout(() => {
                                cancel(
                                    new SessionError('Wallet did not respond in time', 'E_TIMEOUT')
                                )
                            }, 30 * 1000)
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
            },
        }
    }

    export() {
        return this.exporter()
    }

    public makeSignatureProvider(): ApiInterfaces.SignatureProvider {
        return this.link.makeSignatureProvider([this.publicKey], this.transport)
    }

    transact(args: TransactArgs) {
        return this.link.transact(args, this.transport)
    }
}
