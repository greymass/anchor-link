# Anchor Link [![Package Version](https://img.shields.io/npm/v/anchor-link.svg?style=flat-square)](https://www.npmjs.com/package/anchor-link) ![License](https://img.shields.io/npm/l/anchor-link.svg?style=flat-square)

Persistent, fast and secure signature provider for EOSIO chains built on top of [EOSIO Signing Requests (EEP-7)](https://github.com/greymass/eosio-signing-request)

Key features:
  - Persistent sessions
  - Cross device signing
  - End to end encryption
  - Open standard

Resources:
  - [API Documentation](https://greymass.github.io/anchor-link)
  - [Protocol specification](./protocol.md)
  - [Usage examples](./examples)
  - [Developer chat](https://t.me/anchor_link)

## Installation

The `anchor-link` package is distributed both as a module on [npm](https://www.npmjs.com/package/anchor-link) and a standalone bundle on [unpkg](http://unpkg.com/anchor-link).

### Browser using a bundler (recommended)

Install Anchor Link and a [transport](#transports):

```
yarn add anchor-link anchor-link-browser-transport
# or
npm install --save anchor-link anchor-link-browser-transport
```

Import them into your project:

```js
import AnchorLink from 'anchor-link'
import AnchorLinkBrowserTransport from 'anchor-link-browser-transport'
```

### Browser using a pre-built bundle

Include the scripts in your `<head>` tag.

```html
<script src="https://unpkg.com/anchor-link"></script>
<script src="https://unpkg.com/anchor-link-browser-transport"></script>
```

`AnchorLink` and `AnchorLinkBrowserTransport` are now available in the global scope of your document.

### Using node.js

Using node.js

```
yarn add anchor-link anchor-link-console-transport
# or
npm install --save anchor-link anchor-link-console-transport
```

Import them into your project:

```js
const AnchorLink = require('anchor-link')
const AnchorLinkConsoleTransport = require('anchor-link-console-transport')
```

## Basic usage

First you need to instantiate your transport and the link.

```ts
const transport = new AnchorLinkBrowserTransport()
const link = new AnchorLink({
    transport,
    chains: [
        {
            chainId: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
            nodeUrl: 'https://eos.greymass.com',
        }
    ],
})
```

Now you have a link instance that can be used in the browser to login and/or transact. See [options](https://greymass.github.io/anchor-link/interfaces/linkoptions.html) for a full list of available options.

### Basic transact

To sign action(s) or a transaction using the link without logging in you can call the [transact](https://greymass.github.io/anchor-link/classes/link.html#transact) method on your link instance.

```ts
const action = {
    account: 'eosio',
    name: 'voteproducer',
    authorization: [
        {
            actor: '............1', // ............1 will be resolved to the signing accounts name
            permission: '............2', // ............2 will be resolved to the signing accounts authority (e.g. 'active')
        },
    ],
    data: {
        voter: '............1', // same as above, resolved to the signers account name
        proxy: 'greymassvote',
        producers: [],
    },
}
link.transact({action}).then(({signer, transaction}) => {
    console.log(
        `Success! Transaction signed by ${signer} and bradcast with transaction id: ${transaction.id}`
    )
})
```

### Transact with a session

To create a persistent session where you can push multiple transaction to a users wallet you need to call the [login](https://greymass.github.io/anchor-link/classes/link.html#login) method on your link instance.

```ts
link.login('mydapp').then(({session}) => {
    console.log(`Logged in as ${session.auth}`)
    const action = {
        account: 'eosio',
        name: 'voteproducer',
        authorization: [session.auth],
        data: {
            voter: session.auth.actor,
            proxy: 'greymassvote',
            producers: [],
        },
    }
    session.transact({action}).then(({transaction}) => {
        console.log(`Transaction broadcast! Id: ${transaction.id}`)
    })
})
```

You can find more examples in the [examples directory](./examples) at the root of this repository and don't forget to look at the [API documentation](https://greymass.github.io/anchor-link/classes/link.html).

## Transports

Transports in Anchor Link are responsible for getting signature requests to the users wallet when establishing a session or when using anchor link without logging in.

Available transports:

 Package | Description
---------| ---------------
 [anchor-link-browser-transport](https://github.com/greymass/anchor-link-browser-transport) | Browser overlay that generates QR codes or triggers local URI handler if available
 [anchor-link-console-transport](https://github.com/greymass/anchor-link-console-transport) | Transport that prints ASCII QR codes and esr:// links to the JavaScript console

See the [`LinkTransport` documentation](https://greymass.github.io/anchor-link/interfaces/linktransport.html) for details on how to implement custom transports.

## Protocol

The Anchor Link protocol uses EEP-7 identity requests to establish a channel to compatible wallets using an untrusted HTTP POST to WebSocket forwarder (see [buoy node.js](https://github.com/greymass/buoy-nodejs) and [buoy golang](https://github.com/greymass/buoy-golang)).

A session key and unique channel URL is generated by the client which is attached to the identity request and sent to the wallet (see [transports](#transports)). The wallet signs the identity proof and sends it back along with its own channel URL and session key. Subsequent signature requests can now be encrypted to a shared secret derived from the two keys and pushed directly to the wallet channel.

[📘 Protocol specification](./protocol.md)

## Developing

You need [Make](https://www.gnu.org/software/make/), [node.js](https://nodejs.org/en/) and [yarn](https://classic.yarnpkg.com/en/docs/install) installed.

Clone the repository and run `make` to checkout all dependencies and build the project. See the [Makefile](./Makefile) for other useful targets. Before submitting a pull request make sure to run `make lint`.

---

Made with ☕️&❤️ by [team Greymass](https://greymass.com), if you find this useful please consider [supporting us](https://greymass.com/support-us).
