/** Error that is thrown if a LinkPresenter calls the cancel callback. */
export class CancelError extends Error {
    public code = 'E_CANCEL'
    constructor(reason?: string) {
        super(`User canceled request ${reason ? '(' + reason + ')' : ''}`)
    }
}

/** Error that is thrown if an identity request fails to verify. */
export class IdentityError extends Error {
    public code = 'E_IDENTITY'
    constructor(reason?: string) {
        super(`Unable to verify identity ${reason ? '(' + reason + ')' : ''}`)
    }
}

/**
 * Session error codes.
 * - E_DELIVERY: Unable to request message to wallet.
 * - E_TIMEOUT: Request was delivered but user/wallet didn't respond in time.
 */
export type SessionErrorCode = 'E_DELIVERY' | 'E_TIMEOUT'

/** Error that is thrown by session transport. */
export class SessionError extends Error {
    public code: SessionErrorCode
    constructor(reason: string, code: SessionErrorCode) {
        super(reason)
        this.code = code
    }
}
