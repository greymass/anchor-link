# Anchor Link Protocol

Persistent sessions that allows applications to setup a persistent and secure channel for pushing signature requests (ESR/EEP-7) to a wallet.

## Definitions

-   dApp - EOSIO application using Anchor Link its signature provider
-   Wallet - Application holding the private keys for the users EOSIO account(s)
-   Forwarder - Untrusted POST -> WebSocket data forwarder routed with UUIDs
-   Channel - One-way push channel via the forwarder
-   Request - A EOSIO Signing Request (ESR/EEP-7)
-   Callback - A request response sent on a one-time channel from Wallet -> dApp
-   Session - Persistent dApp <-> Wallet session

## Wallet initialization

Wallet generates a new key-pair (hence referred to as the "receive key") and a UUID that will be used to setup a persistent channel for receiving requests.

## Creating a Session

1. dApp generates a key-pair that will be used to encrypt subsequent request, hence referred to as the "request key". It also generates a UUID that is used to create a one-time channel
2. dApp creates an Identity Request using the public request key and sends it directly to the Wallet (QR code/NFC reader/local URI handler)
3. Wallet stores the request key and constructs a callback payload with the identity proof (as per the ESR spec) along with the extra fields `link_ch` which is the persistent channel wallet channel url and `link_key` which is the wallet receive key.
4. dApp validates the identity proof and stores the `link_ch` and `link_key` along with the request key.
5. dApp can now push encrypted requests to the wallet's receive channel with the shared secret derived from its own request key and the wallets receive key.

In pseudo-code:

```python
# dApp
forwarder_address = "https://forward.example.com"
private_request_key = secp256k1_random_key()
public_request_key = secp256k1_get_public(private_request_key)
callback_ch = forwarder_address + "/" + gen_uuidv4()
request = esr_make_id_request(callback_ch, metadata={req_key=public_request_key})
ui_show_qr_code(request)
response = wait_for_callback(callback_ch)
assert(verify_id_proof(response["id_proof"]))
save_session(private_request_key, response["link_ch"], response["link_key"])

# Wallet
forwarder_address = "https://forward.example.com" # does not have to be the same as dApp
private_receive_key = secp256k1_random_key()
public_receive_key = secp256k1_get_public(private_receive_key)
receive_ch = forwarder_address + "/" + gen_uuidv4()
def handle_id_request(request):
    assert(present_to_user(request) == ACCEPTED)
    proof = sign_id_proof(request)
    response = esr_make_id_response(request, proof)
    response.metadata["link_ch"] = receive_ch
    response.metadata["link_key"] = public_receive_key
    push_channel(response, request.get_callback())
```

## Transacting using a Session

1. dApp creates a request with the transaction that should be signed along with a new UUID for the callback.
2. dApp encrypts the request using the shared secret derived from its own request key and the wallet receive key and pushes it to the wallet receive channel.
3. Wallet decrypts the request received on the channel and presents it to the user, if accepted the request is signed and the response is sent to the callback
4. dApp reconstructs the transaction, attaches the signature received from the wallet and broadcasts it to the network

In pseudo-code:

```python
# dApp
forwarder_address = "https://forward.example.com"
session = load_session()
callback_ch = forwarder_address + "/" + gen_uuidv4()
request = esr_make_request(transaction, callback_ch)
request.metadata["expiry"] = date_now() + 60
encrypted = aes_encrypt(request, shared_secret(session["public_receive_key"], session["private_request_key"])
encrypted_envelope = {key: session["public_request_key"], ciphertext: encrypted, checksum: sha256(request)}
push_channel(encrypted_envelope, session["link_ch"])
response = wait_for_callback(callback_ch)
push_transaction(MY_RPC_NODE, response.get_signed_transaction())

# Wallet
def handle_channel_push(encrypted):
    assert(is_active_session_key(encrypted.key))
    request = aes_decrypt(encrypted.ciphertext, shared_secret(session["private_receive_key"], encrypted.key)
    assert(verify_checksum(request, encrypted.checksum))
    assert(request.metadata["expiry"] > date_now())
    assert(present_to_user(request) == ACCEPTED)
    signature = sign_request(request)
    response = esr_make_response(request, signature)
    send_callback(response, request.get_callback())
```

## Security considerations

For the Forwarder to remain untrusted several security measures has to be taken.

### MITM / Request modification

The Forwarder could intercept signing requests from the dApp and modify them before passing them on to the Wallet.

#### Mitigation

The identity request that establishes the channel always goes directly to the wallet via QR code, NFC tag or local URI handler.

The request contains a public key that the dApp holds the private key for. All subsequent requests over the channel are encrypted to a shared secret known only by the dApp and Wallet.

### Replay attacks

Signing requests can be configured to always resolve to a unique transaction making replay attacks possible. The Forwarder could save all requests passing on the channel and selectively re-send them in an attempt to trick the Wallet user.

#### Mitigation

Each request contains an expiry time. Wallets can additionally keep track of the request callback urls and reject any request with a re-used UUID.

### Denial of Service

The Forwarder could refuse to deliver requests or callbacks. It could also publish all channel UUIDs that has seen more than one use for allowing someone to push a large amount of data to a wallet, possibly preventing it from receiving legitimate requests.

#### Mitigation

There are no protocol level mitigation for this type of attack except for the encryption that prevents the forwarder from selectively targeting users based on what data is being sent.

The forwarder service is easy to run and open-source, wallets can use multiple service providers and re-negotiate channels if the currently used forwarder becomes malicious or unreliable.
