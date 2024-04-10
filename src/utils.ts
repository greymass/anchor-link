import makeFetch from 'fetch-ponyfill'
import {AES_CBC} from '@greymass/miniaes'
import {
    Bytes,
    Checksum256,
    Checksum512,
    PrivateKey,
    PublicKey,
    Serializer,
    UInt64,
} from '@wharfkit/antelope'
import {CallbackPayload, SigningRequest} from '@wharfkit/signing-request'

import {SealedMessage} from './link-types'

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
    const key = Checksum512.hash(Serializer.encode({object: nonce}).appending(secret.array))
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

/**
 * Extract session metadata from a callback payload and request.
 * @internal
 */
export function sessionMetadata(payload: CallbackPayload, request: SigningRequest) {
    const metadata: Record<string, any> = {
        // backwards compat, can be removed next major release
        sameDevice: request.getRawInfo()['return_path'] !== undefined,
    }
    // append extra metadata from the signer
    if (payload.link_meta) {
        try {
            const parsed = JSON.parse(payload.link_meta)
            for (const key of Object.keys(parsed)) {
                // normalize key names to camelCase
                metadata[snakeToCamel(key)] = parsed[key]
            }
        } catch (error) {
            logWarn('Unable to parse link metadata', error, payload.link_meta)
        }
    }
    return metadata
}

/**
 * Return PascalCase version of snake_case string.
 * @internal
 */
function snakeToPascal(name: string): string {
    return name
        .split('_')
        .map((v) => (v[0] ? v[0].toUpperCase() : '_') + v.slice(1))
        .join('')
}

/**
 * Return camelCase version of snake_case string.
 * @internal
 */
function snakeToCamel(name: string): string {
    const pascal = snakeToPascal(name)
    return pascal[0].toLowerCase() + pascal.slice(1)
}

/**
 * Print a warning message to console.
 * @internal
 **/
export function logWarn(...args: any[]) {
    // eslint-disable-next-line no-console
    console.warn('[anchor-link]', ...args)
}
