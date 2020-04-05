import typescript from 'rollup-plugin-typescript2'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs' 
import json from '@rollup/plugin-json'
import nodePolyfills from 'rollup-plugin-node-polyfills'
import {terser} from 'rollup-plugin-terser'

let config

if (process.env['UNPKG_BUNDLE']) {
    config = {
        input: './src/index.ts',
        output: {
            name: 'AnchorLink',
            file: 'lib/bundle.js',
            format: 'umd',
            sourcemap: true
        },
        plugins: [
            commonjs({
                namedExports: {
                    'eosjs-ecc': ['privateToPublic', 'randomKey', 'recover', 'Aes']
                }
            }),
            nodePolyfills(),
            json(),
            resolve({browser: true}),
            typescript({tsconfigOverride: {target: 'es5'}}),
            terser(),
        ]
    }
} else {
    config = {
        input: './src/index.ts',
        output: {
            file: 'lib/index.es5.js',
            format: 'cjs',
            sourcemap: true
        },
        external: ['eosio-signing-request', 'eosjs', 'fetch-ponyfill', 'pako', 'uuid', 'ws', 'eosjs-ecc'],
        plugins: [
            typescript({tsconfigOverride: {target: 'es5'}}),
        ]
    }
}

export default config