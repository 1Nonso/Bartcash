import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
   {
      ignores: [
         'dist/**',
         'node_modules/**',
         'build/**',
      ],
   },
   ...tseslint.configs.recommended,
   {
      files: ['src/**/*.ts'],
      languageOptions: {
         globals: {
            ...globals.node,
         },
      },
      rules: {
         '@typescript-eslint/no-unused-vars':
            [
               'warn',
               {
                  argsIgnorePattern:
                     '^_',
               },
            ],
         '@typescript-eslint/no-explicit-any':
            'warn',
      },
   },
);
