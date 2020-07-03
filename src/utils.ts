import makeFetch from 'fetch-ponyfill'
import {Bytes, Checksum256, PrivateKey, PublicKey, Serializer, UInt64} from 'eosio-core'
import {SealedMessage} from './link-types'

import {AES_CBC} from 'asmcrypto.js'

/** @internal */
export const fetch = makeFetch().fetch

/**
 * Encrypt a message using AES and shared secret derived from given keys.
 * @internal
 */
export function sealMessage(
    message: string,
    privateKey: PrivateKey,
    publicKey: PublicKey,
    nonce?: UInt64
): SealedMessage {
    const secret = privateKey.sharedSecret(publicKey)
    if (!nonce) {
        nonce = UInt64.random()
    }
    const key = Serializer.encode({object: nonce}).appending(secret.array).sha512Digest
    const cbc = new AES_CBC(key.array.slice(0, 32), key.array.slice(32, 48))
    const ciphertext = Bytes.from(cbc.encrypt(Bytes.from(message, 'utf8').array))
    const checksumView = new DataView(Checksum256.hash(key.array).array.buffer)
    const checksum = checksumView.getUint32(0, true)
    return SealedMessage.from({
        from: privateKey.toPublic(),
        nonce,
        ciphertext,
        checksum,
    })
}
