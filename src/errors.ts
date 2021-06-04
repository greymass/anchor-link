import type {LinkSession} from './link-session'

/**
 * Error codes. Accessible using the `code` property on errors thrown by [[Link]] and [[LinkSession]].
 * - `E_DELIVERY`: Unable to route message to wallet.
 * - `E_TIMEOUT`: Request was delivered but user/wallet didn't respond in time.
 * - `E_CANCEL`: The [[LinkTransport]] canceled the request.
 * - `E_IDENTITY`: Identity proof failed to verify.
 */
export type LinkErrorCode = 'E_DELIVERY' | 'E_TIMEOUT' | 'E_CANCEL' | 'E_IDENTITY'

/**
 * Error that is thrown if a [[LinkTransport]] cancels a request.
 * @internal
 */
export class CancelError extends Error {
    public code = 'E_CANCEL'
    constructor(reason?: string) {
        super(`User canceled request ${reason ? '(' + reason + ')' : ''}`)
    }
}

/**
 * Error that is thrown if an identity request fails to verify.
 * @internal
 */
export class IdentityError extends Error {
    public code = 'E_IDENTITY'
    constructor(reason?: string) {
        super(`Unable to verify identity ${reason ? '(' + reason + ')' : ''}`)
    }
}

/**
 * Error originating from a [[LinkSession]].
 * @internal
 */
export class SessionError extends Error {
    public code: 'E_DELIVERY' | 'E_TIMEOUT'
    public session: LinkSession
    constructor(reason: string, code: 'E_DELIVERY' | 'E_TIMEOUT', session: LinkSession) {
        super(reason)
        this.code = code
        this.session = session
    }
}
