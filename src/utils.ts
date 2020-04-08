import {Numeric, Serialize} from 'eosjs'
import * as ecc from 'eosjs-ecc'

import {Bytes, SealedMessage} from './link-abi'
import linkAbi from './link-abi-data'

/** @internal */
const types = Serialize.getTypesFromAbi(Serialize.createInitialTypes(), linkAbi)

/**
 * Helper to ABI encode value.
 * @internal
 */
export function abiEncode(value: any, typeName: string): Uint8Array {
    let type = types.get(typeName)
    if (!type) {
        throw new Error(`No such type: ${typeName}`)
    }
    let buf = new Serialize.SerialBuffer()
    type.serialize(buf, value)
    return buf.asUint8Array()
}

/**
 * Helper to ABI decode data.
 * @internal
 */
export function abiDecode<ResultType = any>(data: Bytes, typeName: string): ResultType {
    let type = types.get(typeName)
    if (!type) {
        throw new Error(`No such type: ${typeName}`)
    }
    if (typeof data === 'string') {
        data = Serialize.hexToUint8Array(data)
    } else if (!(data instanceof Uint8Array)) {
        data = new Uint8Array(data)
    }
    let buf = new Serialize.SerialBuffer({
        array: data,
    })
    return type.deserialize(buf) as ResultType
}

/**
 * Encrypt a message using AES and shared secret derived from given keys.
 * @internal
 */
export function sealMessage(message: string, privateKey: string, publicKey: string) {
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
 * Ensure public key is in new PUB_ format.
 * @internal
 */
export function normalizePublicKey(key: string) {
    if (key.startsWith('PUB_')) {
        return key
    }
    return Numeric.publicKeyToString(Numeric.stringToPublicKey('EOS' + key.substr(-50)))
}

/**
 * Return true if given public keys are equal.
 * @internal
 */
export function publicKeyEqual(keyA: string, keyB: string) {
    return normalizePublicKey(keyA) === normalizePublicKey(keyB)
}
