// TODO: Break out to separate module

import {SigningRequest} from 'eosio-signing-request'
import qrcode from 'qrcode-terminal'

import {LinkTransport} from './link-transport'

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
