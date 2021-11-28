import {strict as assert} from 'assert'
import 'mocha'

import {Link, LinkTransport} from '../src'
import {SigningRequest} from 'eosio-signing-request'
import {
    API,
    APIClient,
    APIProvider,
    APIResponse,
    PermissionLevel,
    PrivateKey,
    TimePointSec,
} from '@greymass/eosio'
import {LinkCallback, LinkCallbackResponse, LinkCallbackService} from '../src/link-callback'
import {readFileSync} from 'fs'
import {join as pathJoin} from 'path'
import {LinkCreate} from '../src/link-types'

const now = TimePointSec.fromMilliseconds(Date.now())
const expiration = TimePointSec.fromMilliseconds(Date.now() + 60 * 1000)

class TestManager implements LinkTransport, APIProvider, LinkCallbackService, LinkCallback {
    key = PrivateKey.generate('K1')
    signer = PermissionLevel.from({actor: 'foobar', permission: 'active'})
    account = API.v1.AccountObject.from({
        account_name: this.signer.actor,
        head_block_num: 123456789,
        head_block_time: now,
        privileged: false,
        last_code_update: '1970-01-01T00:00:00.000',
        created: '2001-01-01T00:00:00.000',
        core_liquid_balance: '42.0000 EOS',
        ram_quota: 10000,
        net_weight: 200000,
        cpu_weight: 2000000,
        net_limit: {
            used: 500,
            available: 21323091,
            max: 21323567,
        },
        cpu_limit: {
            used: 3222,
            available: 12522,
            max: 15744,
        },
        ram_usage: 5394,
        permissions: [
            {
                perm_name: 'active',
                parent: 'owner',
                required_auth: {
                    threshold: 1,
                    keys: [
                        {
                            key: this.key.toPublic(),
                            weight: 1,
                        },
                    ],
                    accounts: [],
                    waits: [],
                },
            },
            {
                perm_name: 'owner',
                parent: '',
                required_auth: {
                    threshold: 1,
                    keys: [
                        {
                            key: this.key.toPublic(),
                            weight: 1,
                        },
                    ],
                    accounts: [],
                    waits: [],
                },
            },
        ],
        total_resources: {
            owner: this.signer.actor,
            net_weight: '20.5000 EOS',
            cpu_weight: '174.4929 EOS',
            ram_bytes: 7849,
        },
    })

    morph(json): APIResponse {
        return {
            json,
            text: JSON.stringify(json),
            status: 200,
            headers: {},
        }
    }

    // api
    async call(path: string, params?: any): Promise<APIResponse> {
        switch (path) {
            case '/v1/chain/get_account':
                return this.morph(this.account)
            case '/v1/chain/get_abi': {
                const account = String(params.account_name)
                const data = readFileSync(pathJoin(__dirname, 'abis', `${account}.json`))
                return this.morph({account_name: account, abi: JSON.parse(data.toString('utf-8'))})
            }
            case '/v1/chain/push_transaction': {
                return this.morph({})
            }
            default:
                throw new Error(`Unexpected request to ${path}`)
        }
    }

    // callback
    url = 'test://'
    create() {
        return this
    }
    async wait(): Promise<LinkCallbackResponse> {
        const request = this.lastRequest
        if (!request) {
            throw new Error('No request')
        }
        const info: LinkCreate | undefined = request.getInfoKey('link', LinkCreate)
        if (info && String(info.session_name) === 'abort') {
            return {rejected: 'no thanks'}
        }
        const abis = await request.fetchAbis()
        const resolved = request.resolve(abis, this.signer, {
            expiration,
            ref_block_num: 0,
            ref_block_prefix: 0,
        })
        const digest = resolved.transaction.signingDigest(request.getChainId())
        const signature = this.key.signDigest(digest)
        const callback = resolved.getCallback([signature])
        return callback!.payload
    }
    cancel() {}

    // transport
    lastRequest?: SigningRequest
    lastCancel?: (reason: string | Error) => void
    onRequest(request: SigningRequest, cancel: (reason: string | Error) => void): void {
        this.lastRequest = request
        this.lastCancel = cancel
    }
}

const manager = new TestManager()
const client = new APIClient({provider: manager})
const link = new Link({
    chains: [
        {
            nodeUrl: client,
            chainId: 'beefface00000000000000000000000000000000000000000000000000000000',
        },
    ],
    transport: manager,
    service: manager,
    verifyProofs: true
})

suite('session', function () {
    test('login & transact', async function () {
        const {account, session, transaction, resolvedTransaction} = await link.login('test')
        assert.equal(String(account!.account_name), 'foobar')
        assert.equal(String(transaction.expiration), expiration.toString())
        assert.equal(String(resolvedTransaction.expiration), expiration.toString())
        assert.equal(String(resolvedTransaction.actions[0].data.scope), 'test')
        await session.transact({
            action: {
                account: 'eosio.token',
                name: 'transfer',
                authorization: [session.auth],
                data: {
                    from: session.auth.actor,
                    to: 'teamgreymass',
                    quantity: '100000.0000 EOS',
                    memo: 'lol',
                },
            },
        })
    })
    test('abort from wallet', async function () {
        try {
            await link.login('abort')
            assert.fail()
        } catch (error) {
            assert.equal(error.message, 'User canceled request (no thanks)')
        }
    })
})
