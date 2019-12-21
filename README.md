# anchor-link

Example usage:

```ts
import {Link} from 'anchor-link'

const link = new Link({
    chainId: 'e70aaab8997e1dfce58fbfac80cbbb8fecec7b99cf982a9444273cbc64c41473',
    rpc: 'https://jungle.greymass.com',
    service: 'https://link.dirty.fish',
})

link.transact({
    broadcast: true,
    action: {
        account: 'eosio.token',
        name: 'transfer',
        authorization: [
            {
                actor: '............1',
                permission: '............1',
            },
        ],
        data: {
            from: '............1',
            to: 'teamgreymass',
            quantity: '0.0001 EOS',
            memo: 'nani',
        },
    },
})
    .then((result) => {
        console.log('success', result)
    })
    .catch((error) => {
        console.log('error', error)
    })
```
