export * from './link'
export * from './link-session'
export type {LinkOptions} from './link-options'
export type {LinkTransport} from './link-transport'
export type {LinkStorage} from './link-storage'
export * from './errors'

// default export is Link class for convenience
import {Link} from './link'
export default Link

// expose dependencies
export * from 'eosio-signing-request'
export * from '@greymass/eosio'
