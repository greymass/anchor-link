import {Serialize} from 'eosjs'
import * as ecc from 'eosjs-ecc'

import {Bytes, SealedMessage} from './link-abi'
import linkAbi from './link-abi-data'

const types = Serialize.getTypesFromAbi(Serialize.createInitialTypes(), linkAbi)

export function abiEncode(value: any, typeName: string): Uint8Array {
    let type = types.get(typeName)
    if (!type) {
        throw new Error(`No such type: ${typeName}`)
    }
    let buf = new Serialize.SerialBuffer()
    type.serialize(buf, value)
    return buf.asUint8Array()
}

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
