import {SigningRequest} from 'eosio-signing-request'

import {TransactResult} from './link'
import {LinkSession} from './link-session'
import {LinkStorage} from './link-storage'

/**
 * Protocol link transports need to implement.
 * A transport is responsible for getting the request to the
 * user, e.g. by opening request URIs or displaying QR codes.
 */
export interface LinkTransport {
    /**
     * Present a signing request to the user.
     * @param request The signing request.
     * @param cancel Can be called to abort the request.
     */
    onRequest(request: SigningRequest, cancel: (reason: string | Error) => void): void
    /** Called if the request was successful. */
    onSuccess?(request: SigningRequest, result: TransactResult): void
    /** Called if the request failed. */
    onFailure?(request: SigningRequest, error: Error): void
    /**
     * Called when a session request is initiated.
     * @param session Session where the request originated.
     * @param request Signing request that will be sent over the session.
     */
    onSessionRequest?(
        session: LinkSession,
        request: SigningRequest,
        cancel: (reason: string | Error) => void
    ): void
    /** Can be implemented if transport provides a storage as well. */
    storage?: LinkStorage
    /** Can be implemented to modify request just after it has been created. */
    prepare?(request: SigningRequest, session?: LinkSession): Promise<SigningRequest>
    /** Called immediately when the transaction starts */
    showLoading?(): void
}
