const eslintPluginImport = require('eslint-plugin-import')
const eslintPluginJest = require('eslint-plugin-jest')
const airbnbBaseConfig = require('eslint-config-airbnb-base')

module.exports = [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        process: 'readonly',
        require: 'readonly',
        jest: 'readonly' // Para Jest
      }
    },
    plugins: {
      import: eslintPluginImport,
      jest: eslintPluginJest
    },
    rules: {
      ...airbnbBaseConfig.rules,
      'no-console': 'off', // Permitir console.log
      'import/extensions': [
        'error',
        'ignorePackages',
        {
          js: 'always'
        }
      ],
      'jest/no-disabled-tests': 'warn',
      'jest/no-focused-tests': 'error',
      'jest/prefer-to-be': 'warn'
    }
  }
]
