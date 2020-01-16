export default {
    version: 'eosio::abi/1.1',
    types: [],
    structs: [
        {
            name: 'sealed_message',
            base: '',
            fields: [
                {
                    name: 'from',
                    type: 'public_key',
                },
                {
                    name: 'nonce',
                    type: 'uint64',
                },
                {
                    name: 'ciphertext',
                    type: 'bytes',
                },
                {
                    name: 'checksum',
                    type: 'uint32',
                },
            ],
        },
        {
            name: 'link_create',
            base: '',
            fields: [
                {
                    name: 'session_name',
                    type: 'name',
                },
                {
                    name: 'request_key',
                    type: 'public_key',
                },
            ],
        },
        {
            name: 'link_info',
            base: '',
            fields: [
                {
                    name: 'expiration',
                    type: 'time_point_sec',
                },
            ],
        },
    ],
    actions: [],
    ricardian_clauses: [],
    error_messages: [],
    tables: [],
    abi_extensions: [],
}
