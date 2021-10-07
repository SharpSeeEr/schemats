/**
 * Generate typescript interface from table schema
 * Created by xiamx on 2016-08-10.
 */

import { EnumDefinition, TableDefinition } from './schemaInterfaces'
import Options from './options'

function nameIsReservedKeyword(name: string): boolean {
  const reservedKeywords = [
    // Reserved Words
    'break',
    'case',
    'catch',
    'class',
    'const',
    'continue',
    'debugger',
    'default',
    'delete',
    'do',
    'else',
    'enum',
    'export',
    'extends',
    'false',
    'finally',
    'for',
    'function',
    'if',
    'import',
    'in',
    'instanceof',
    'new',
    'null',
    'return',
    'super',
    'switch',
    'this',
    'throw',
    'true',
    'try',
    'typeof',
    'var',
    'void',
    'while',
    'with',

    // Strict Mode Reserved Words
    'as',
    'implements',
    'interface',
    'let',
    'package',
    'private',
    'protected',
    'public',
    'static',
    'yield',

    // Contextual Keywords
    'any',
    'boolean',
    'constructor',
    'declare',
    'get',
    'module',
    'require',
    'number',
    'set',
    'string',
    'symbol',
    'type',
    'from',
    'of',
  ]
  return reservedKeywords.indexOf(name) !== -1
}

function normalizeName(name: string): string {
  if (nameIsReservedKeyword(name)) {
    return name + '_'
  } else {
    return name
  }
}

export function generateTableInterface(tableNameRaw: string, tableDefinition: TableDefinition, options: Options) {
  const tableName = options.transformTypeName(tableNameRaw)

  const members = Object.keys(tableDefinition)
    .map(c => {
      const columnName = options.transformColumnName(c)
      const normalized = normalizeName(columnName)

      return `${columnName}: ${tableName}Fields.${normalized};`
    })

  return [
    `export interface ${normalizeName(tableName)} {`,
    members.join('\n'),
    '}',
  ].join('\n')
}

export function generateEnumType(enumObject: EnumDefinition, options: Options) {
  return Object
    .keys(enumObject)
    .map((enumNameRaw) => {
      const enumName = options.transformTypeName(enumNameRaw)
      const enumValues = enumObject[enumNameRaw]
      return [
        `export type ${enumName} = `,
        enumValues.map((v) => `'${v}'`).join(' | '),
        ';',
      ].join('')
    })
    .join('\n')
}

export function generateTableTypes(tableNameRaw: string, tableDefinition: TableDefinition, options: Options) {
  const tableName = options.transformTypeName(tableNameRaw)
  const fields = Object
    .keys(tableDefinition)
    .map((columnNameRaw) => {
      const type = tableDefinition[columnNameRaw].tsType
      const nullable = tableDefinition[columnNameRaw].nullable ? '| null' : ''
      const columnName = options.transformColumnName(columnNameRaw)
      return `export type ${normalizeName(columnName)} = ${type}${nullable};`
    })

  return [
    `export namespace ${tableName}Fields {`,
    fields.join('\n'),
    '}',
  ].join('\n')
}
