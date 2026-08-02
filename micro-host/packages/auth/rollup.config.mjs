import typescript from '@rollup/plugin-typescript'

export default {
  input: 'src/index.ts',
  output: [
    { file: 'dist/index.js', format: 'es' },
    { file: 'dist/index.cjs', format: 'cjs', exports: 'named' },
  ],
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
      // d.ts 由 tsconfig 的 declaration 配置直接产出
    }),
  ],
}
