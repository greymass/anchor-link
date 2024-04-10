import {Bytes, Name, PublicKey, Struct, TimePointSec, UInt32, UInt64} from '@wharfkit/antelope'

@Struct.type('sealed_message')
export class SealedMessage extends Struct {
    @Struct.field('public_key') from!: PublicKey
    @Struct.field('uint64') nonce!: UInt64
    @Struct.field('bytes') ciphertext!: Bytes
    @Struct.field('uint32') checksum!: UInt32
}

@Struct.type('link_create')
export class LinkCreate extends Struct {
    @Struct.field('name') session_name!: Name
    @Struct.field('public_key') request_key!: PublicKey
    @Struct.field('string', {extension: true}) user_agent?: string
}

@Struct.type('link_info')
export class LinkInfo extends Struct {
    @Struct.field('time_point_sec') expiration!: TimePointSec
}
