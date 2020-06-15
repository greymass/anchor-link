import * as esr from 'eosio-signing-request'
import {JsonRpc, Numeric, Serialize} from 'eosjs'
import * as ecc from 'eosjs-ecc'
import makeFetch from 'fetch-ponyfill'

import {PermissionLevel} from './link'
import {Bytes, SealedMessage} from './link-abi'
import linkAbi from './link-abi-data'

/** @internal */
export const fetch = makeFetch().fetch

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

/**
 * Generate a random private key.
 * Uses browser crypto if available, otherwise falls back to slow eosjs-ecc.
 * @internal
 */
export async function generatePrivateKey() {
    if (typeof window !== 'undefined' && window.crypto) {
        const data = new Uint32Array(32)
        window.crypto.getRandomValues(data)
        return ecc.PrivateKey.fromBuffer(Buffer.from(data)).toString()
    } else {
        return await ecc.randomKey()
    }
}

/**
 * Retreives the first authorizer of the first action
 * @internal
 */
export function getFirstAuthorizer(args: esr.SigningRequestCreateArguments): PermissionLevel {
    try {
        if (args.action) {
            return args.action.authorization[0]
        }
        if (args.actions) {
            return args.actions[0].authorization[0]
        }
        if (args.transaction) {
            return args.transaction.actions[0].authorization[0]
        }
    } catch (e) {
        throw new Error(`Request error while processing authorization: ${e.message}`)
    }
    throw new Error('Request does not contain authorization')
}

/**
 * Creates TAPOS Values based on current blockchain state
 * @internal
 */
export async function createTapos(rpc: JsonRpc, expireInSeconds: number = 120) {
    const info = await rpc.get_info()
    return {
        ref_block_num: info.last_irreversible_block_num & 0xffff,
        ref_block_prefix: getBlockPrefix(info.last_irreversible_block_id),
        expiration: getExpiration(expireInSeconds),
    }
}
export function reverseNibbles(hex) {
    const rv: any = []
    for (let i = hex.length - 1; i > 0; i -= 2) {
        rv.push(hex[i - 1] + hex[i])
    }
    return rv.join('')
}
export function getBlockPrefix(blockIdHex) {
    const hex = reverseNibbles(blockIdHex.substring(16, 24))
    return parseInt(hex, 16)
}
export function getExpiration(expireInSeconds: number = 120): string {
    const currentDate = new Date()
    const timePlus = currentDate.getTime() + expireInSeconds * 1000
    const timeInISOString = new Date(timePlus).toISOString()
    return timeInISOString.substr(0, timeInISOString.length - 1)
}
