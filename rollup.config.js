import fs from 'fs'
import dts from 'rollup-plugin-dts'
import babel from '@rollup/plugin-babel'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from '@rollup/plugin-typescript'
import {terser} from 'rollup-plugin-terser'
import json from '@rollup/plugin-json'
import replace from '@rollup/plugin-replace'

import pkg from './package.json'

const license = fs.readFileSync('LICENSE').toString('utf-8').trim()
const banner = `
/**
 * Anchor Link v${pkg.version}
 * ${pkg.homepage}
 *
 * @license
 * ${license.replace(/\n/g, '\n * ')}
 */
`.trim()

const exportFix = `
(function () {
    var pkg = AnchorLink;
    AnchorLink = pkg.default;
    for (var key in pkg) {
        if (key === 'default') continue;
        AnchorLink[key] = pkg[key];
    }
})()
`

const replaceVersion = replace({
    preventAssignment: true,
    __ver: pkg.version,
})

export default [
    {
        input: 'src/index-bundle.ts',
        output: {
            banner,
            file: pkg.main,
            format: 'cjs',
            sourcemap: true,
            exports: 'default',
        },
        plugins: [replaceVersion, typescript({target: 'es6'})],
        external: Object.keys({...pkg.dependencies, ...pkg.peerDependencies}),
        onwarn,
    },
    {
        input: 'src/index.ts',
        output: {
            banner,
            file: pkg.module,
            format: 'esm',
            sourcemap: true,
        },
        plugins: [replaceVersion, typescript({target: 'es2020'})],
        external: Object.keys({...pkg.dependencies, ...pkg.peerDependencies}),
        onwarn,
    },
    {
        input: 'src/index.ts',
        output: {banner, file: pkg.types, format: 'esm'},
        onwarn,
        plugins: [dts()],
    },
    {
        input: pkg.module,
        output: {
            banner,
            footer: exportFix,
            name: 'AnchorLink',
            file: pkg.unpkg,
            format: 'iife',
            sourcemap: true,
            exports: 'named',
        },
        plugins: [
            replaceVersion,
            resolve({browser: true}),
            commonjs(),
            json(),
            babel({
                babelHelpers: 'bundled',
                exclude: /node_modules\/core-js.*/,
                presets: [
                    [
                        '@babel/preset-env',
                        {
                            targets: '>0.25%, not dead',
                            useBuiltIns: 'usage',
                            corejs: '3',
                        },
                    ],
                ],
            }),
            terser({
                format: {
                    comments(_, comment) {
                        return comment.type === 'comment2' && /@license/.test(comment.value)
                    },
                    max_line_len: 500,
                },
            }),
        ],
        external: Object.keys({...pkg.peerDependencies}),
        onwarn,
    },
]

function onwarn(warning, rollupWarn) {
    if (warning.code === 'CIRCULAR_DEPENDENCY') {
        // unnecessary warning
        return
    }
    if (
        warning.code === 'UNUSED_EXTERNAL_IMPORT' &&
        warning.source === 'tslib' &&
        warning.names[0] === '__read'
    ) {
        // when using ts with importHelpers: true rollup complains about this
        // seems safe to ignore since __read is not actually imported or used anywhere in the resulting bundles
        return
    }
    rollupWarn(warning)
}
