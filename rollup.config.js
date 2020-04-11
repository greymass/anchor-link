import typescript from 'rollup-plugin-typescript2'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs' 
import json from '@rollup/plugin-json'
import nodePolyfills from 'rollup-plugin-node-polyfills'
import {terser} from 'rollup-plugin-terser'

const tsconfigOverride = {
    compilerOptions: {target: 'ES5'}
}

let config

if (process.env['UNPKG_BUNDLE']) {
    config = {
        input: './src/index.ts',
        output: {
            name: 'AnchorLink',
            file: 'lib/bundle.js',
            format: 'iife',
            sourcemap: true,
            exports: 'named',
            outro: [
                // hack to get default export to work as global
                'var _exports = exports; exports = _exports.default; for (var key in _exports) { exports[key] = _exports[key] };',
                // get Buffer working ¯\_(ツ)_/¯
                'var Buffer = Buffer$1;',
            ].join('\n')
        },
        plugins: [
            commonjs({
                namedExports: {
                    'eosjs-ecc': ['privateToPublic', 'randomKey', 'recover', 'Aes', 'PrivateKey']
                }
            }),
            nodePolyfills(),
            json(),
            resolve({browser: true}),
            typescript({tsconfigOverride}),
            terser(),
        ]
    }
} else {
    config = {
        input: './src/index.ts',
        output: {
            file: 'lib/index.es5.js',
            format: 'cjs',
            sourcemap: true,
            exports: 'named',
            // another hack to get default export to work in cjs
            outro: 'var _exports = exports; module.exports = _exports.default; for (var key in _exports) { module.exports[key] = _exports[key] };'
        },
        external: ['eosio-signing-request', 'eosjs', 'fetch-ponyfill', 'pako', 'uuid', 'isomorphic-ws', 'eosjs-ecc'],
        plugins: [
            typescript({tsconfigOverride}),
        ]
    }
}

export default config