import * as assert from 'assert'
import { generateEnumType, generateTableInterface, generateTableTypes } from '../../src/typescript'
import Options from '../../src/options'

const options = new Options({
  camelCase: false,
  meta: false,
  singularTableNames: false,
  writeHeader: true,
})

describe('Typescript', () => {
  describe('generateTableInterface', () => {
    it('empty table definition object', () => {
      const tableInterface = generateTableInterface('tableName', {}, options)
      assert.equal(tableInterface,
        '\n' +
        '        export interface tableName {\n' +
        '        \n' +
        '        }\n' +
        '    ')
    })
    it('table name is reserved', () => {
      const tableInterface = generateTableInterface('package', {}, options)
      assert.equal(tableInterface,
        '\n' +
        '        export interface package_ {\n' +
        '        \n' +
        '        }\n' +
        '    ')
    })
    it('table with columns', () => {
      const tableInterface = generateTableInterface('tableName', {
        col1: { sqlType: 'name1', nullable: false, columnType: '', tsType: '' },
        col2: { sqlType: 'name2', nullable: false, columnType: '', tsType: '' },
      }, options)
      assert.equal(tableInterface,
        '\n' +
        '        export interface tableName {\n' +
        '        col1: tableNameFields.col1;\n' +
        'col2: tableNameFields.col2;\n' +
        '\n' +
        '        }\n' +
        '    ')
    })
    it('table with reserved columns', () => {
      const tableInterface = generateTableInterface('tableName', {
        string: { sqlType: 'name1', nullable: false, columnType: '', tsType: '' },
        number: { sqlType: 'name2', nullable: false, columnType: '', tsType: '' },
        package: { sqlType: 'name3', nullable: false, columnType: '', tsType: '' },
      }, options)
      assert.equal(tableInterface,
        '\n' +
        '        export interface tableName {\n' +
        '        string: tableNameFields.string_;\n' +
        'number: tableNameFields.number_;\n' +
        'package: tableNameFields.package_;\n' +
        '\n' +
        '        }\n' +
        '    ')
    })
  })
  describe('generateEnumType', () => {
    it('empty object', () => {
      const enumType = generateEnumType({}, options)
      assert.equal(enumType, '')
    })
    it('with enumerations', () => {
      const enumType = generateEnumType({
        enum1: ['val1', 'val2', 'val3', 'val4'],
        enum2: ['val5', 'val6', 'val7', 'val8'],
      }, options)
      assert.equal(enumType,
        'export type enum1 = \'val1\' | \'val2\' | \'val3\' | \'val4\';\n' +
        'export type enum2 = \'val5\' | \'val6\' | \'val7\' | \'val8\';\n')
    })
  })
  describe('generateEnumType', () => {
    it('empty object', () => {
      const enumType = generateEnumType({}, options)
      assert.equal(enumType, '')
    })
    it('with enumerations', () => {
      const enumType = generateEnumType({
        enum1: ['val1', 'val2', 'val3', 'val4'],
        enum2: ['val5', 'val6', 'val7', 'val8'],
      }, options)
      assert.equal(enumType,
        'export type enum1 = \'val1\' | \'val2\' | \'val3\' | \'val4\';\n' +
        'export type enum2 = \'val5\' | \'val6\' | \'val7\' | \'val8\';\n')
    })
  })
  describe('generateTableTypes', () => {
    it('empty table definition object', () => {
      const tableTypes = generateTableTypes('tableName', {}, options)
      assert.equal(tableTypes,
        '\n' +
        '        export namespace tableNameFields {' +
        '\n        ' +
        '\n        ' +
        '}' +
        '\n    ')
    })
    it('with table definitions', () => {
      const tableTypes = generateTableTypes('tableName', {
        col1: { sqlType: 'name1', nullable: false, columnType: '', tsType: 'string' },
        col2: { sqlType: 'name2', nullable: false, columnType: '', tsType: 'number' },
      }, options)
      assert.equal(tableTypes,
        '\n' +
        '        export namespace tableNameFields {' +
        '\n        export type col1 = string;' +
        '\nexport type col2 = number;' +
        '\n' +
        '\n        }' +
        '\n    ')
    })
    it('with nullable column definitions', () => {
      const tableTypes = generateTableTypes('tableName', {
        col1: { sqlType: 'name1', nullable: true, columnType: '', tsType: 'string' },
        col2: { sqlType: 'name2', nullable: true, columnType: '', tsType: 'number' },
      }, options)
      assert.equal(tableTypes,
        '\n' +
        '        export namespace tableNameFields {' +
        '\n        export type col1 = string| null;' +
        '\nexport type col2 = number| null;' +
        '\n' +
        '\n        }' +
        '\n    ')
    })
  })
})
