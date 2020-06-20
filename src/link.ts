import * as esr from 'eosio-signing-request'
import {ApiInterfaces, JsonRpc} from 'eosjs'
import * as ecc from 'eosjs-ecc'
import makeFetch from 'fetch-ponyfill'
import WebSocket from 'isomorphic-ws'
import zlib from 'pako'
import {v4 as uuid} from 'uuid'

import {CancelError, IdentityError} from './errors'
import {LinkCreate} from './link-abi'
import {defaults, LinkOptions} from './link-options'
import {LinkChannelSession, LinkFallbackSession, LinkSession} from './link-session'
import {LinkStorage} from './link-storage'
import {LinkTransport} from './link-transport'
import {abiEncode, fetch, generatePrivateKey, normalizePublicKey, publicKeyEqual} from './utils'

/** EOSIO permission level with actor and signer, a.k.a. 'auth', 'authority' or 'account auth' */
export type PermissionLevel = esr.abi.PermissionLevel

/**
 * Payload accepted by the [[Link.transact]] method.
 * Note that one of `action`, `actions` or `transaction` must be set.
 */
export interface TransactArgs {
    /** Full transaction to sign. */
    transaction?: esr.abi.Transaction
    /** Action to sign. */
    action?: esr.abi.Action
    /** Actions to sign. */
    actions?: esr.abi.Action[]
}

/**
 * Options for the [[Link.transact]] method.
 */
export interface TransactOptions {
    /**
     * Whether to broadcast the transaction or just return the signature.
     * Defaults to true.
     */
    broadcast?: boolean
}

/**
 * The result of a [[Link.transact]] call.
 */
export interface TransactResult {
    /** The signing request that was sent. */
    request: esr.SigningRequest
    /** The transaction signatures. */
    signatures: string[]
    /** The callback payload. */
    payload: esr.CallbackPayload
    /** The signer authority. */
    signer: PermissionLevel
    /** The resulting transaction. */
    transaction: esr.abi.Transaction
    /** Serialized version of transaction. */
    serializedTransaction: Uint8Array
    /** Push transaction response from api node, only present if transaction was broadcast. */
    processed?: {[key: string]: any}
}

/**
 * The result of a [[Link.identify]] call.
 */
export interface IdentifyResult extends TransactResult {
    /** The identified account. */
    account: object
    /** The public key that signed the identity proof.  */
    signerKey: string
}

/**
 * The result of a [[Link.login]] call.
 */
export interface LoginResult extends IdentifyResult {
    /** The session created by the login. */
    session: LinkSession
}

/**
 * Main class, also exposed as the default export of the library.
 *
 * Example:
 *
 * ```ts
 * import AnchorLink from 'anchor-link'
 * import ConsoleTransport from 'anchor-link-console-transport'
 *
 * const link = new AnchorLink({
 *     transport: new ConsoleTransport()
 * })
 *
 * const result = await link.transact({actions: myActions})
 * ```
 */
export class Link implements esr.AbiProvider {
    /** The eosjs RPC instance used to communicate with the EOSIO node. */
    public readonly rpc: JsonRpc
    /** Transport used to deliver requests to the user wallet. */
    public readonly transport: LinkTransport
    /** EOSIO ChainID for which requests are valid. */
    public readonly chainId: string
    /** Storage adapter used to persist sessions. */
    public readonly storage?: LinkStorage

    private serviceAddress: string
    private requestOptions: esr.SigningRequestEncodingOptions
    private abiCache = new Map<string, any>()
    private pendingAbis = new Map<string, Promise<any>>()

    /** Create a new link instance. */
    constructor(options: LinkOptions) {
        if (typeof options !== 'object') {
            throw new TypeError('Missing options object')
        }
        if (!options.transport) {
            throw new TypeError(
                'options.transport is required, see https://github.com/greymass/anchor-link#transports'
            )
        }
        if (options.rpc === undefined || typeof options.rpc === 'string') {
            this.rpc = new JsonRpc(options.rpc || defaults.rpc, {fetch: fetch as any})
        } else {
            this.rpc = options.rpc
        }
        if (options.chainId) {
            this.chainId =
                typeof options.chainId === 'number'
                    ? esr.nameToId(options.chainId)
                    : options.chainId
        } else {
            this.chainId = defaults.chainId
        }
        this.serviceAddress = (options.service || defaults.service).trim().replace(/\/$/, '')
        this.transport = options.transport
        if (options.storage !== null) {
            this.storage = options.storage || this.transport.storage
        }
        this.requestOptions = {
            abiProvider: this,
            textDecoder: options.textDecoder || new TextDecoder(),
            textEncoder: options.textEncoder || new TextEncoder(),
            zlib,
        }
    }

    /**
     * Fetch the ABI for given account, cached.
     * @internal
     */
    public async getAbi(account: string) {
        let rv = this.abiCache.get(account)
        if (!rv) {
            let getAbi = this.pendingAbis.get(account)
            if (!getAbi) {
                getAbi = this.rpc.get_abi(account)
                this.pendingAbis.set(account, getAbi)
            }
            rv = (await getAbi).abi
            this.pendingAbis.delete(account)
            if (rv) {
                this.abiCache.set(account, rv)
            }
        }
        return rv
    }

    /**
     * Create a new unique buoy callback url.
     * @internal
     */
    public createCallbackUrl() {
        return `${this.serviceAddress}/${uuid()}`
    }

    /**
     * Create a SigningRequest instance configured for this link.
     * @internal
     */
    public async createRequest(args: esr.SigningRequestCreateArguments, transport?: LinkTransport) {
        const t = transport || this.transport
        // generate unique callback url
        let request = await esr.SigningRequest.create(
            {
                ...args,
                chainId: this.chainId,
                broadcast: false,
                callback: {
                    url: this.createCallbackUrl(),
                    background: true,
                },
            },
            this.requestOptions
        )
        if (t.prepare) {
            request = await t.prepare(request)
        }
        return request
    }

    /**
     * Send a SigningRequest instance using this link.
     * @internal
     */
    public async sendRequest(
        request: esr.SigningRequest,
        transport?: LinkTransport,
        broadcast = false
    ) {
        const t = transport || this.transport
        try {
            const linkUrl = request.data.callback
            if (!linkUrl.startsWith(this.serviceAddress)) {
                throw new Error('Request must have a link callback')
            }
            if (request.data.flags !== 2) {
                throw new Error('Invalid request flags')
            }
            // wait for callback or user cancel
            const ctx: {cancel?: () => void} = {}
            const socket = waitForCallback(linkUrl, ctx).then((data) => {
                if (typeof data.rejected === 'string') {
                    throw new CancelError(`Rejected by wallet: ${data.rejected}`)
                }
                return data
            })
            const cancel = new Promise<never>((resolve, reject) => {
                t.onRequest(request, (reason) => {
                    if (ctx.cancel) {
                        ctx.cancel()
                    }
                    if (typeof reason === 'string') {
                        reject(new CancelError(reason))
                    } else {
                        reject(reason)
                    }
                })
            })
            const payload = await Promise.race([socket, cancel])
            const signer: PermissionLevel = {
                actor: payload.sa,
                permission: payload.sp,
            }
            const signatures: string[] = Object.keys(payload)
                .filter((key) => key.startsWith('sig') && key !== 'sig0')
                .map((key) => payload[key]!)
            // recreate transaction from request response
            const resolved = await esr.ResolvedSigningRequest.fromPayload(
                payload,
                this.requestOptions
            )
            const info = resolved.request.getInfo()
            if (info['fuel_sig']) {
                signatures.unshift(info['fuel_sig'])
            }
            const {serializedTransaction, transaction} = resolved
            const result: TransactResult = {
                request: resolved.request,
                serializedTransaction,
                transaction,
                signatures,
                payload,
                signer,
            }
            if (broadcast) {
                const res = await this.rpc.push_transaction({
                    signatures: result.signatures,
                    serializedTransaction: result.serializedTransaction,
                })
                result.processed = res.processed
            }
            if (t.onSuccess) {
                t.onSuccess(request, result)
            }
            return result
        } catch (error) {
            if (t.onFailure) {
                t.onFailure(request, error)
            }
            throw error
        }
    }

    /**
     * Sign and optionally broadcast a EOSIO transaction, action or actions.
     *
     * Example:
     *
     * ```ts
     * let result = await myLink.transact({transaction: myTx})
     * ```
     *
     * @param args The action, actions or transaction to use.
     * @param options Options for this transact call.
     * @param transport Transport override, for internal use.
     */
    public async transact(
        args: TransactArgs,
        options?: TransactOptions,
        transport?: LinkTransport
    ): Promise<TransactResult> {
        const t = transport || this.transport
        const broadcast = options ? options.broadcast !== false : true
        // Initialize the loading state of the transport
        if (t && t.showLoading) {
            t.showLoading()
        }
        // eosjs transact compat: upgrade to transaction if args have any header fields
        let anyArgs = args as any
        if (
            args.actions &&
            (anyArgs.expiration ||
                anyArgs.ref_block_num ||
                anyArgs.ref_block_prefix ||
                anyArgs.max_net_usage_words ||
                anyArgs.max_cpu_usage_ms ||
                anyArgs.delay_sec)
        ) {
            args = {
                transaction: {
                    expiration: '1970-01-01T00:00:00',
                    ref_block_num: 0,
                    ref_block_prefix: 0,
                    max_net_usage_words: 0,
                    max_cpu_usage_ms: 0,
                    delay_sec: 0,
                    ...anyArgs,
                },
            }
        }
        const request = await this.createRequest(args, t)
        const result = await this.sendRequest(request, t, broadcast)
        return result
    }

    /**
     * Send an identity request and verify the identity proof.
     * @param requestPermission Optional request permission if the request is for a specific account or permission.
     * @param info Metadata to add to the request.
     * @note This is for advanced use-cases, you probably want to use [[Link.login]] instead.
     */
    public async identify(
        requestPermission?: PermissionLevel,
        info?: {[key: string]: string | Uint8Array}
    ): Promise<IdentifyResult> {
        const request = await this.createRequest({
            identity: {permission: requestPermission || null},
            info,
        })
        const res = await this.sendRequest(request)
        if (!res.request.isIdentity()) {
            throw new IdentityError(`Unexpected response`)
        }
        const message = Buffer.concat([
            Buffer.from(request.getChainId(), 'hex'),
            Buffer.from(res.serializedTransaction),
            Buffer.alloc(32),
        ])
        const {signer} = res
        const signerKey = ecc.recover(res.signatures[0], message)
        const account = await this.rpc.get_account(signer.actor)
        if (!account) {
            throw new IdentityError(`Signature from unknown account: ${signer.actor}`)
        }
        const permission = account.permissions.find(
            ({perm_name}) => perm_name === signer.permission
        )
        if (!permission) {
            throw new IdentityError(
                `${signer.actor} signed for unknown permission: ${signer.permission}`
            )
        }
        const auth = permission.required_auth
        const keyAuth = auth.keys.find(({key}) => publicKeyEqual(key, signerKey))
        if (!keyAuth) {
            throw new IdentityError(`${formatAuth(signer)} has no key matching id signature`)
        }
        if (auth.threshold > keyAuth.weight) {
            throw new IdentityError(`${formatAuth(signer)} signature does not reach auth threshold`)
        }
        if (requestPermission) {
            if (
                (requestPermission.actor !== esr.PlaceholderName &&
                    requestPermission.actor !== signer.actor) ||
                (requestPermission.permission !== esr.PlaceholderPermission &&
                    requestPermission.permission !== signer.permission)
            ) {
                throw new IdentityError(
                    `Unexpected identity proof from ${formatAuth(signer)}, expected ${formatAuth(
                        requestPermission
                    )} `
                )
            }
        }
        return {
            ...res,
            account,
            signerKey,
        }
    }

    /**
     * Login and create a persistent session.
     * @param identifier The session identifier, an EOSIO name (`[a-z1-5]{1,12}`).
     *                   Should be set to the contract account if applicable.
     */
    public async login(identifier: string): Promise<LoginResult> {
        const privateKey = await generatePrivateKey()
        const requestKey = ecc.privateToPublic(privateKey)
        const createInfo: LinkCreate = {
            session_name: identifier,
            request_key: requestKey,
        }
        const res = await this.identify(undefined, {
            link: abiEncode(createInfo, 'link_create'),
        })
        const metadata = {sameDevice: res.request.getRawInfo()['return_path'] !== undefined}
        let session: LinkSession
        if (res.payload.link_ch && res.payload.link_key && res.payload.link_name) {
            session = new LinkChannelSession(
                this,
                {
                    identifier,
                    auth: res.signer,
                    publicKey: res.signerKey,
                    channel: {
                        url: res.payload.link_ch,
                        key: res.payload.link_key,
                        name: res.payload.link_name,
                    },
                    requestKey: privateKey,
                },
                metadata
            )
        } else {
            session = new LinkFallbackSession(
                this,
                {
                    identifier,
                    auth: res.signer,
                    publicKey: res.signerKey,
                },
                metadata
            )
        }
        if (this.storage) {
            await this.storeSession(identifier, session)
        }
        return {
            ...res,
            session,
        }
    }

    /**
     * Restore previous session, see [[Link.login]] to create a new session.
     * @param identifier The session identifier, should be same as what was used when creating the session with [[Link.login]].
     * @param auth A specific session auth to restore, if omitted the most recently used session will be restored.
     * @returns A [[LinkSession]] instance or null if no session can be found.
     * @throws If no [[LinkStorage]] adapter is configured or there was an error retrieving the session data.
     **/
    public async restoreSession(identifier: string, auth?: PermissionLevel) {
        if (!this.storage) {
            throw new Error('Unable to restore session: No storage adapter configured')
        }
        let key: string
        if (auth) {
            key = this.sessionKey(identifier, formatAuth(auth))
        } else {
            let latest = (await this.listSessions(identifier))[0]
            if (!latest) {
                return null
            }
            key = this.sessionKey(identifier, formatAuth(latest))
        }
        let data = await this.storage.read(key)
        if (!data) {
            return null
        }
        let sessionData: any
        try {
            sessionData = JSON.parse(data)
        } catch (error) {
            throw new Error(
                `Unable to restore session: Stored JSON invalid (${error.message || String(error)})`
            )
        }
        const session = LinkSession.restore(this, sessionData)
        if (auth) {
            // update latest used
            await this.touchSession(identifier, auth)
        }
        return session
    }

    /**
     * List stored session auths for given identifier.
     * The most recently used session is at the top (index 0).
     * @throws If no [[LinkStorage]] adapter is configured or there was an error retrieving the session list.
     **/
    public async listSessions(identifier: string) {
        if (!this.storage) {
            throw new Error('Unable to list sessions: No storage adapter configured')
        }
        let key = this.sessionKey(identifier, 'list')
        let list: PermissionLevel[]
        try {
            list = JSON.parse((await this.storage.read(key)) || '[]')
        } catch (error) {
            throw new Error(
                `Unable to list sessions: Stored JSON invalid (${error.message || String(error)})`
            )
        }
        return list
    }

    /**
     * Remove stored session for given identifier and auth.
     * @throws If no [[LinkStorage]] adapter is configured or there was an error removing the session data.
     */
    public async removeSession(identifier: string, auth: PermissionLevel) {
        if (!this.storage) {
            throw new Error('Unable to remove session: No storage adapter configured')
        }
        let key = this.sessionKey(identifier, formatAuth(auth))
        await this.storage.remove(key)
        await this.touchSession(identifier, auth, true)
    }

    /**
     * Remove all stored sessions for given identifier.
     * @throws If no [[LinkStorage]] adapter is configured or there was an error removing the session data.
     */
    public async clearSessions(identifier: string) {
        if (!this.storage) {
            throw new Error('Unable to clear sessions: No storage adapter configured')
        }
        for (const auth of await this.listSessions(identifier)) {
            await this.removeSession(identifier, auth)
        }
    }

    /**
     * Create an eosjs compatible signature provider using this link.
     * @param availableKeys Keys the created provider will claim to be able to sign for.
     * @param transport (internal) Transport override for this call.
     * @note We don't know what keys are available so those have to be provided,
     *       to avoid this use [[LinkSession.makeSignatureProvider]] instead. Sessions can be created with [[Link.login]].
     */
    public makeSignatureProvider(
        availableKeys: string[],
        transport?: LinkTransport
    ): ApiInterfaces.SignatureProvider {
        return {
            getAvailableKeys: async () => availableKeys,
            sign: async (args) => {
                const t = transport || this.transport
                let request = esr.SigningRequest.fromTransaction(
                    args.chainId,
                    args.serializedTransaction,
                    this.requestOptions
                )
                request.setCallback(this.createCallbackUrl(), true)
                request.setBroadcast(false)
                if (t.prepare) {
                    request = await t.prepare(request)
                }
                const {
                    serializedTransaction,
                    signatures,
                } = await this.sendRequest(request, t)
                return {
                    ...args,
                    serializedTransaction,
                    signatures,
                }
            },
        }
    }

    /**
     * Create an eosjs authority provider using this link.
     * @note Uses the configured RPC Node's `/v1/chain/get_required_keys` API to resolve keys.
     */
    public makeAuthorityProvider(): ApiInterfaces.AuthorityProvider {
        const {rpc} = this
        return {
            async getRequiredKeys(args: ApiInterfaces.AuthorityProviderArgs) {
                const {availableKeys, transaction} = args
                const result = await rpc.fetch('/v1/chain/get_required_keys', {
                    transaction,
                    available_keys: availableKeys.map(normalizePublicKey),
                })
                return result.required_keys.map(normalizePublicKey)
            },
        }
    }

    /** Makes sure session is in storage list of sessions and moves it to top (most recently used). */
    private async touchSession(identifier: string, auth: PermissionLevel, remove = false) {
        let auths = await this.listSessions(identifier)
        let formattedAuth = formatAuth(auth)
        let existing = auths.findIndex((a) => formatAuth(a) === formattedAuth)
        if (existing >= 0) {
            auths.splice(existing, 1)
        }
        if (remove === false) {
            auths.unshift(auth)
        }
        let key = this.sessionKey(identifier, 'list')
        await this.storage!.write(key, JSON.stringify(auths))
    }

    /** Makes sure session is in storage list of sessions and moves it to top (most recently used). */
    private async storeSession(identifier: string, session: LinkSession) {
        let key = this.sessionKey(identifier, formatAuth(session.auth))
        let data = JSON.stringify(session.serialize())
        await this.storage!.write(key, data)
        await this.touchSession(identifier, session.auth)
    }

    /** Session storage key for identifier and suffix. */
    private sessionKey(identifier: string, suffix: string) {
        return [this.chainId, identifier, suffix].join('-')
    }
}

/**
 * Connect to a WebSocket channel and wait for a message.
 * @internal
 */
function waitForCallback(url: string, ctx: {cancel?: () => void}) {
    return new Promise<esr.CallbackPayload>((resolve, reject) => {
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
            socket.onerror = (error) => {}
            socket.onclose = (close) => {
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

/**
 * Format a EOSIO permission level in the format `actor@permission` taking placeholders into consideration.
 * @internal
 */
function formatAuth(auth: PermissionLevel): string {
    let {actor, permission} = auth
    if (actor === esr.PlaceholderName) {
        actor = '<any>'
    }
    if (permission === esr.PlaceholderName || permission === esr.PlaceholderPermission) {
        permission = '<any>'
    }
    return `${actor}@${permission}`
}
