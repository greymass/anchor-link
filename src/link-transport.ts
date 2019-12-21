import {SigningRequest} from 'eosio-signing-request'
import qrcode from 'qrcode-terminal'

import {TransactResult} from './link'

/**
 * Protocol link transports need to implement.
 * A transport is responsible for getting the request to the
 * user, e.g. by opening request URIs or displaying QR codes.
 */
export interface LinkTransport {
    /**
     * Present a signing request to the user.
     * @param request The signing request.
     * @param cancel Can be called to abort the request.
     */
    onRequest(request: SigningRequest, cancel: (reason: string | Error) => void): void
    /** Called if the request was successful. */
    onSuccess?(request: SigningRequest, result: TransactResult)
    /** Called if the request failed. */
    onFailure?(request: SigningRequest, error: Error)
}

/**
 * A signing request presenter that writes requests
 * as URI strings and ASCII qr codes to console.log.
 */
export class ConsoleTransport implements LinkTransport {
    public onRequest(request: SigningRequest) {
        const uri = request.encode()
        console.log(`Signing request\n${uri}`)
        qrcode.setErrorLevel('L')
        qrcode.generate(uri, {small: true}, (code) => {
            console.log(code)
        })
    }
}
