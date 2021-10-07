/* eslint-disable camelcase */
import * as mysql from 'mysql'
import { mapValues, isEqual } from 'lodash'
import { URL } from 'url'
import { TableDefinition, Database, EnumDefinition } from './schemaInterfaces'
import Options from './options'
import { convertToEntity } from './utils'

const columnsSchemaNames = [
  'table_catalog',
  'table_schema',
  'table_name',
  'column_name',
  'ordinal_position',
  'column_default',
  'is_nullable',
  'data_type',
  'character_maximum_length',
  'character_octet_length',
  'numeric_precision',
  'numeric_scale',
  'datetime_precision',
  'character_set_name',
  'collation_name',
  'column_type',
  'column_key',
  'column_comment',
].map((n) => `${n} as ${n}`).join(', ')

export class MysqlDatabase implements Database {
  private db: mysql.Connection
  private defaultSchema: string

  constructor(public connectionString: string) {
    this.db = mysql.createConnection(connectionString)
    const url = new URL(connectionString)
    if (url && url.pathname) {
      const database = url.pathname.substr(1)
      this.defaultSchema = database
    } else {
      this.defaultSchema = 'public'
    }
  }

  // uses the type mappings from https://github.com/mysqljs/ where sensible
  private static mapTableDefinitionToType(tableDefinition: TableDefinition, customTypes: string[], options: Options): TableDefinition {
    if (!options) throw new Error()
    return mapValues(tableDefinition, column => {
      switch (column.sqlType) {
        case 'char':
        case 'varchar':
        case 'text':
        case 'tinytext':
        case 'mediumtext':
        case 'longtext':
        case 'time':
        case 'geometry':
        case 'set':
        case 'enum':
          // keep set and enum defaulted to string if custom type not mapped
          column.tsType = 'string'
          return column
        case 'integer':
        case 'int':
        case 'smallint':
        case 'mediumint':
        case 'bigint':
        case 'double':
        case 'decimal':
        case 'numeric':
        case 'float':
        case 'year':
          column.tsType = 'number'
          return column
        case 'tinyint':
          if (column.columnType === 'tinyint(1)' && !column.nullable) {
            column.tsType = 'boolean'
          } else column.tsType = 'number'
          return column
        case 'json':
          column.tsType = 'Object'
          return column
        case 'date':
        case 'datetime':
        case 'timestamp':
          column.tsType = 'Date'
          return column
        case 'tinyblob':
        case 'mediumblob':
        case 'longblob':
        case 'blob':
        case 'binary':
        case 'varbinary':
        case 'bit':
          column.tsType = 'Buffer'
          return column
        default:
          if (customTypes.indexOf(column.sqlType) !== -1) {
            column.tsType = options.transformTypeName(column.sqlType)
            return column
          } else {
            console.log(`Type [${column.sqlType}] has been mapped to [any] because no specific type has been found.`)
            column.tsType = 'any'
            return column
          }
      }
    })
  }

  private static parseMysqlEnumeration(mysqlEnum: string): string[] {
    return mysqlEnum
      .replace(/(^(enum|set)\('|'\)$)/gi, '')
      .split('\',\'')
  }

  private static getEnumNameFromColumn(dataType: string, columnName: string): string {
    return `${dataType}_${columnName}`
  }

  public query<T>(queryString: string) {
    return this.queryAsync<T>(queryString)
  }

  public async getEnumTypes(schema?: string): Promise<EnumDefinition> {
    const params: string[] = []

    const sql = [
      'SELECT',
      columnsSchemaNames,
      'FROM information_schema.columns',
      'WHERE data_type IN (\'enum\', \'set\')',
    ]
    if (schema) {
      sql.push('and table_schema = ?')
      params.push(schema)
    }

    const rawEnumRecords = await this.queryAsync<InformationSchemaColumn>(
      sql.join(' '),
      params,
    )

    return rawEnumRecords.reduce((table, enumItem) => {
      const enumName = MysqlDatabase.getEnumNameFromColumn(enumItem.data_type, enumItem.column_name)
      const enumValues = MysqlDatabase.parseMysqlEnumeration(enumItem.column_type)

      if (table[enumName] && !isEqual(table[enumName], enumValues)) {
        const errorMsg = 'Multiple enums with the same name and contradicting types were found: ' +
          `${enumItem.column_name}: ${JSON.stringify(table[enumName])} and ${JSON.stringify(enumValues)}`
        throw new Error(errorMsg)
      }
      return {
        ...table,
        [enumName]: enumValues,
      }
    }, {} as EnumDefinition)
  }

  public async getTableDefinition(tableName: string, tableSchema: string): Promise<TableDefinition> {
    const sql = [
      'SELECT',
      columnsSchemaNames,
      'FROM information_schema.columns',
      'WHERE table_name = ? and table_schema = ?',
    ].join(' ')

    const tableColumns = await this.queryAsync<InformationSchemaColumn>(
      sql,
      [tableName, tableSchema],
    )

    return tableColumns.reduce((table, schemaItem) => {
      const columnName = schemaItem.column_name
      const dataType = schemaItem.data_type

      return {
        ...table,
        [columnName]: {
          sqlType: /^(enum|set)$/i.test(dataType) ? MysqlDatabase.getEnumNameFromColumn(dataType, columnName) : dataType,
          columnType: schemaItem.column_type,
          nullable: schemaItem.is_nullable === 'YES',
          tsType: '',
        },
      }
    }, {} as TableDefinition)
  }

  public async getTableTypes(tableName: string, tableSchema: string, options: Options) {
    const enumTypes = await this.getEnumTypes(tableSchema)
    const customTypes = Object.keys(enumTypes)
    const tableDef = await this.getTableDefinition(tableName, tableSchema)
    return MysqlDatabase.mapTableDefinitionToType(tableDef, customTypes, options)
  }

  public async getSchemaTables(schemaName: string): Promise<string[]> {
    const columnNames = [
      'table_catalog',
      'table_schema',
      'table_name',
      'table_type',
      'temporary',
    ]

    const sql = [
      'SELECT',
      columnNames.map((n) => `${n} as ${n}`).join(', '),
      'FROM information_schema.tables',
      'WHERE table_schema = ?',
    ].join(' ')

    const schemaTables = await this.queryAsync<InformationSchemaTable>(
      sql,
      [schemaName],
    )

    return schemaTables.map((schemaItem) => schemaItem.table_name)
  }

  public queryAsync<T>(queryString: string, escapedValues?: Array<string>): Promise<T[]> {
    // console.log('--------------------------------------------------------')
    // console.log('schemaMysql.queryAsync')
    // console.log(queryString)
    // console.log(escapedValues)
    return new Promise((resolve, reject) => {
      this.db.query(
        queryString,
        escapedValues,
        (error, results) => {
          if (error) {
            reject(error)
          }
          resolve(results.map(convertToEntity))
        })
    })
  }

  public getDefaultSchema(): string {
    return this.defaultSchema
  }
}

interface InformationSchemaTable {
  table_catalog: string;
  table_schema: string;
  table_name: string;
  table_type: string;
  temporary: string;
}

interface InformationSchemaColumn {
  table_catalog: string;
  table_schema: string;
  table_name: string;
  column_name: string;
  ordinal_position: string;
  column_default: any | null;
  is_nullable: string;
  data_type: string;
  character_maximum_length: string;
  character_octet_length: string;
  numeric_precision: string;
  numeric_scale: string;
  datetime_precision: string;
  character_set_name: string;
  collation_name: string;
  column_type: string;
  column_key: string;
  column_comment: string;
}
