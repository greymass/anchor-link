import {v4 as uuid} from 'uuid'
import {CallbackPayload} from 'eosio-signing-request'
import WebSocket from 'isomorphic-ws'

/** Service that handles waiting for a ESR callback to be sent to an url. */
export interface LinkCallbackService {
    create(): LinkCallback
}

/** Callback that can be waited for. */
export interface LinkCallback {
    /** Url that should be hit to trigger the callback. */
    url: string
    /** Wait for the callback to resolve. */
    wait(): Promise<CallbackPayload>
    /** Cancel a pending callback. */
    cancel(): void
}

/** @internal */
export class BouyCallbackService implements LinkCallbackService {
    readonly address: string
    constructor(address: string) {
        this.address = address.trim().replace(/\/$/, '')
    }

    create() {
        const url = `${this.address}/${uuid()}`
        return new BouyCallback(url)
    }
}

/** @internal */
class BouyCallback implements LinkCallback {
    constructor(readonly url: string) {}
    private ctx: {cancel?: () => void} = {}
    wait() {
        return waitForCallback(this.url, this.ctx)
    }
    cancel() {
        if (this.ctx.cancel) {
            this.ctx.cancel()
        }
    }
}

/**
 * Connect to a WebSocket channel and wait for a message.
 * @internal
 */
function waitForCallback(url: string, ctx: {cancel?: () => void}) {
    return new Promise<CallbackPayload>((resolve, reject) => {
        let active = true
        let retries = 0
        const socketUrl = url.replace(/^http/, 'ws')
        const handleResponse = (response: string) => {
            try {
                resolve(JSON.parse(response))
            } catch (error) {
                error.message = 'Unable to parse callback JSON: ' + error.message
                reject(error)
            }
        }
        const connect = () => {
            const socket = new WebSocket(socketUrl)
            ctx.cancel = () => {
                active = false
                if (
                    socket.readyState === WebSocket.OPEN ||
                    socket.readyState === WebSocket.CONNECTING
                ) {
                    socket.close()
                }
            }
            socket.onmessage = (event) => {
                active = false
                if (socket.readyState === WebSocket.OPEN) {
                    socket.close()
                }
                if (typeof Blob !== 'undefined' && event.data instanceof Blob) {
                    const reader = new FileReader()
                    reader.onload = () => {
                        handleResponse(reader.result as string)
                    }
                    reader.onerror = (error) => {
                        reject(error)
                    }
                    reader.readAsText(event.data)
                } else {
                    if (typeof event.data === 'string') {
                        handleResponse(event.data)
                    } else {
                        handleResponse(event.data.toString())
                    }
                }
            }
            socket.onopen = () => {
                retries = 0
            }
            socket.onclose = () => {
                if (active) {
                    setTimeout(connect, backoff(retries++))
                }
            }
        }
        connect()
    })
}

/**
 * Exponential backoff function that caps off at 10s after 10 tries.
 * https://i.imgur.com/IrUDcJp.png
 * @internal
 */
function backoff(tries: number): number {
    return Math.min(Math.pow(tries * 10, 2), 10 * 1000)
}
