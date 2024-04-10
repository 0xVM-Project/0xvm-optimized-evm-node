import json from '@rollup/plugin-json';
import typescript from '@rollup/plugin-typescript';
import { cleandir } from 'rollup-plugin-cleandir';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import versionInjector from 'rollup-plugin-version-injector';
import replace from '@rollup/plugin-replace';
const isProduction = process.env.NODE_ENV === 'production';
export default {
  input: ['./src/index.ts'],
  output: [
    {
      file: './dist/index.mjs',
      format: 'esm',
      banner: 'import { createRequire as ___createRequire } from "module";',//custom for lmdb.js
    },
  ],
  plugins: [
    cleandir('./dist'),
    json(),
    nodeResolve({
      extensions: ['.ts', '.mjs', '.cjs', '.js', '.json', '.node'],
      exportConditions: ['node'],
      preferBuiltins: true,
    }),
    typescript(),
    commonjs({
      requireReturnsDefault: 'auto',
      sourceMap: !isProduction,
      ignoreDynamicRequires:true,//custom for lmdb.js
    }),
    //custom for lmdb.js
    replace({
      delimiters: ['', ''],
      'return require(load.path(dir))': "return ___createRequire(import.meta.url)(load.path(dir))",
    }),
    versionInjector({
      injectInComments: false,
      injectInTags: {
        fileRegexp: /\.(js|cjs)$/,
        tagId: 'VI',
        dateFormat: 'yyyy-mm-dd HH:MM',
      },
    }),
  ],
};
