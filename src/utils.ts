import {Serialize} from 'eosjs'

import {Bytes} from './link-abi'
import * as linkAbi from './link-abi.json'

const types = Serialize.getTypesFromAbi(Serialize.createInitialTypes(), linkAbi)

export function abiEncode(value: any, typeName: string): Uint8Array {
    let type = types.get(typeName)
    if (!type) {
        throw new Error(`No such type: ${type}`)
    }
    let buf = new Serialize.SerialBuffer()
    type.serialize(buf, value)
    return buf.asUint8Array()
}

export function abiDecode<T = any>(data: Bytes, typeName: string): T {
    let type = types.get(typeName)
    if (!type) {
        throw new Error(`No such type: ${type}`)
    }
    if (typeof data === 'string') {
        data = Serialize.hexToUint8Array(data)
    } else if (!(data instanceof Uint8Array)) {
        data = new Uint8Array(data)
    }
    let buf = new Serialize.SerialBuffer({
        array: data,
    })
    return type.deserialize(buf) as T
}
