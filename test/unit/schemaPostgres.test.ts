import * as assert from 'assert'
import * as sinon from 'sinon'
import proxyquire from 'proxyquire'
import PgPromise from 'pg-promise'
import { TableDefinition } from '../../src/schemaInterfaces'
import Options from '../../src/options'

const options = new Options({
  camelCase: false,
  meta: false,
  singularTableNames: false,
  writeHeader: true,
})

const pgp = PgPromise()

describe('PostgresDatabase', () => {
  const sandbox = sinon.createSandbox()
  const db = {
    query: sandbox.stub(),
    each: sandbox.stub(),
    map: sandbox.stub(),
  }
  let PostgresDBReflection: any
  let PostgresProxy: any
  before(() => {
    const pgpStub: any = () => db
    pgpStub.as = pgp.as
    const SchemaPostgres = proxyquire('../../src/schemaPostgres', {
      'pg-promise': () => pgpStub,
    })
    PostgresDBReflection = SchemaPostgres.PostgresDatabase
    PostgresProxy = new PostgresDBReflection()
  })
  beforeEach(() => {
    sandbox.reset()
  })
  after(() => {
    sandbox.restore()
  })
  describe('query', () => {
    it('calls postgres query', () => {
      PostgresProxy.query('SELECT * FROM TEST')
      assert.equal(db.query.getCall(0).args[0], 'SELECT * FROM TEST')
    })
  })
  describe('getEnumTypes', () => {
    it('writes correct query with schema name', () => {
      PostgresProxy.getEnumTypes('schemaName')
      assert.equal(db.each.getCall(0).args[0],
        'select n.nspname as schema, t.typname as name, e.enumlabel as value ' +
        'from pg_type t join pg_enum e on t.oid = e.enumtypid ' +
        'join pg_catalog.pg_namespace n ON n.oid = t.typnamespace ' +
        'where n.nspname = \'schemaName\' ' +
        'order by t.typname asc, e.enumlabel asc;')
      assert.deepEqual(db.each.getCall(0).args[1], [])
    })
    it('writes correct query without schema name', () => {
      PostgresProxy.getEnumTypes()
      assert.equal(db.each.getCall(0).args[0],
        'select n.nspname as schema, t.typname as name, e.enumlabel as value ' +
        'from pg_type t join pg_enum e on t.oid = e.enumtypid ' +
        'join pg_catalog.pg_namespace n ON n.oid = t.typnamespace  ' +
        'order by t.typname asc, e.enumlabel asc;')
      assert.deepEqual(db.each.getCall(0).args[1], [])
    })
    it('handles response from db', async () => {
      const enums = await PostgresProxy.getEnumTypes()
      const callback = db.each.getCall(0).args[2]
      const dbResponse = [
        { name: 'name', value: 'value1' },
        { name: 'name', value: 'value2' },
      ]
      dbResponse.forEach(callback)
      assert.deepEqual(enums, { name: ['value1', 'value2'] })
    })
  })
  describe('getTableDefinition', () => {
    it('writes correct query', () => {
      PostgresProxy.getTableDefinition('tableName', 'schemaName')
      assert.equal(db.each.getCall(0).args[0],
        'SELECT column_name, udt_name, is_nullable ' +
        'FROM information_schema.columns ' +
        'WHERE table_name = $1 and table_schema = $2')
      assert.deepEqual(db.each.getCall(0).args[1], ['tableName', 'schemaName'])
    })
    it('handles response from db', async () => {
      const tableDefinition = await PostgresProxy.getTableDefinition()
      const callback = db.each.getCall(0).args[2]
      const dbResponse = [
        { column_name: 'col1', udt_name: 'int2', is_nullable: 'YES' },
        { column_name: 'col2', udt_name: 'text', is_nullable: 'NO' },
      ]
      dbResponse.forEach(callback)
      assert.deepEqual(tableDefinition, {
        col1: { udtName: 'int2', nullable: true },
        col2: { udtName: 'text', nullable: false },
      })
    })
  })
  describe('getTableTypes', () => {
    const tableTypesSandbox = sinon.createSandbox()
    before(() => {
      tableTypesSandbox.stub(PostgresProxy, 'getEnumTypes')
      tableTypesSandbox.stub(PostgresProxy, 'getTableDefinition')
      tableTypesSandbox.stub(PostgresDBReflection, 'mapTableDefinitionToType')
    })
    beforeEach(() => {
      tableTypesSandbox.reset()
    })
    after(() => {
      tableTypesSandbox.restore()
    })
    it('gets custom types from enums', async () => {
      PostgresProxy.getEnumTypes.returns(Promise.resolve({ enum1: [], enum2: [] }))
      PostgresProxy.getTableDefinition.returns(Promise.resolve({}))
      await PostgresProxy.getTableTypes('tableName', 'tableSchema')
      assert.deepEqual(PostgresDBReflection.mapTableDefinitionToType.getCall(0).args[1], ['enum1', 'enum2'])
    })
    it('gets table definitions', async () => {
      PostgresProxy.getEnumTypes.returns(Promise.resolve({}))
      PostgresProxy.getTableDefinition.returns(Promise.resolve({
        table: {
          udtName: 'name',
          nullable: false,
          columnType: '',
          tsType: '',
        },
      }))
      await PostgresProxy.getTableTypes('tableName', 'tableSchema')
      assert.deepEqual(PostgresProxy.getTableDefinition.getCall(0).args, ['tableName', 'tableSchema'])
      assert.deepEqual(PostgresDBReflection.mapTableDefinitionToType.getCall(0).args[0], {
        table: {
          udtName: 'name',
          nullable: false,
          columnType: '',
          tsType: '',
        },
      })
    })
  })
  describe('getSchemaTables', () => {
    it('writes correct query', () => {
      PostgresProxy.getSchemaTables('schemaName')
      assert.equal(db.map.getCall(0).args[0],
        'SELECT table_name ' +
        'FROM information_schema.columns ' +
        'WHERE table_schema = $1 ' +
        'GROUP BY table_name')
      assert.deepEqual(db.map.getCall(0).args[1], ['schemaName'])
    })
    it('handles response from db', async () => {
      await PostgresProxy.getSchemaTables()
      const callback = db.map.getCall(0).args[2]
      const dbResponse = [
        { table_name: 'table1' },
        { table_name: 'table2' },
      ]
      const schemaTables = dbResponse.map(callback)
      assert.deepEqual(schemaTables, ['table1', 'table2'])
    })
  })
  describe('mapTableDefinitionToType', () => {
    describe('maps to string', () => {
      it('bpchar', () => {
        const td: TableDefinition = {
          column: {
            sqlType: 'bpchar',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'string')
      })
      it('char', () => {
        const td: TableDefinition = {
          column: {
            sqlType: 'char',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'string')
      })
      it('varchar', () => {
        const td: TableDefinition = {
          column: {
            sqlType: 'varchar',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'string')
      })
      it('text', () => {
        const td: TableDefinition = {
          column: {
            sqlType: 'text',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'string')
      })
      it('citext', () => {
        const td: TableDefinition = {
          column: {
            sqlType: 'citext',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'string')
      })
      it('uuid', () => {
        const td: TableDefinition = {
          column: {
            sqlType: 'uuid',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'string')
      })
      it('bytea', () => {
        const td: TableDefinition = {
          column: {
            sqlType: 'bytea',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'string')
      })
      it('inet', () => {
        const td: TableDefinition = {
          column: {
            sqlType: 'inet',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'string')
      })
      it('time', () => {
        const td: TableDefinition = {
          column: {
            sqlType: 'time',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'string')
      })
      it('timetz', () => {
        const td: TableDefinition = {
          column: {
            sqlType: 'timetz',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'string')
      })
      it('interval', () => {
        const td: TableDefinition = {
          column: {
            sqlType: 'interval',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'string')
      })
      it('name', () => {
        const td: TableDefinition = {
          column: {
            sqlType: 'name',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'string')
      })
    })
    describe('maps to number', () => {
      it('int2', () => {
        const td: TableDefinition = {
          column: {
            sqlType: 'int2',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'number')
      })
      it('int4', () => {
        const td: TableDefinition = {
          column: {
            sqlType: 'int4',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'number')
      })
      it('int8', () => {
        const td: TableDefinition = {
          column: {
            sqlType: 'int8',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'number')
      })
      it('float4', () => {
        const td: TableDefinition = {
          column: {
            sqlType: 'float4',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'number')
      })
      it('float8', () => {
        const td: TableDefinition = {
          column: {
            sqlType: 'float8',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'number')
      })
      it('numeric', () => {
        const td: TableDefinition = {
          column: {
            sqlType: 'numeric',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'number')
      })
      it('money', () => {
        const td: TableDefinition = {
          column: {
            sqlType: 'money',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'number')
      })
      it('oid', () => {
        const td: TableDefinition = {
          column: {
            sqlType: 'oid',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'number')
      })
    })
    describe('maps to boolean', () => {
      it('bool', () => {
        const td: TableDefinition = {
          column: {
            sqlType: 'bool',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'boolean')
      })
    })
    describe('maps to Object', () => {
      it('json', () => {
        const td: TableDefinition = {
          column: {
            sqlType: 'json',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'Object')
      })
      it('jsonb', () => {
        const td: TableDefinition = {
          column: {
            sqlType: 'jsonb',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'Object')
      })
    })
    describe('maps to Date', () => {
      it('date', () => {
        const td: TableDefinition = {
          column: {
            sqlType: 'date',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'Date')
      })
      it('timestamp', () => {
        const td: TableDefinition = {
          column: {
            sqlType: 'timestamp',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'Date')
      })
      it('timestamptz', () => {
        const td: TableDefinition = {
          column: {
            sqlType: 'timestamptz',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'Date')
      })
    })
    describe('maps to Array<number>', () => {
      it('_int2', () => {
        const td: TableDefinition = {
          column: {
            sqlType: '_int2',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'Array<number>')
      })
      it('_int4', () => {
        const td: TableDefinition = {
          column: {
            sqlType: '_int4',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'Array<number>')
      })
      it('_int8', () => {
        const td: TableDefinition = {
          column: {
            sqlType: '_int8',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'Array<number>')
      })
      it('_float4', () => {
        const td: TableDefinition = {
          column: {
            sqlType: '_float4',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'Array<number>')
      })
      it('_float8', () => {
        const td: TableDefinition = {
          column: {
            sqlType: '_float8',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'Array<number>')
      })
      it('_numeric', () => {
        const td: TableDefinition = {
          column: {
            sqlType: '_numeric',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'Array<number>')
      })
      it('_money', () => {
        const td: TableDefinition = {
          column: {
            sqlType: '_money',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'Array<number>')
      })
    })
    describe('maps to Array<boolean>', () => {
      it('_bool', () => {
        const td: TableDefinition = {
          column: {
            sqlType: '_bool',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, ['CustomType'], options).column.tsType, 'Array<boolean>')
      })
    })
    describe('maps to Array<string>', () => {
      it('_varchar', () => {
        const td: TableDefinition = {
          column: {
            sqlType: '_varchar',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, ['CustomType'], options).column.tsType, 'Array<string>')
      })
      it('_text', () => {
        const td: TableDefinition = {
          column: {
            sqlType: '_text',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, ['CustomType'], options).column.tsType, 'Array<string>')
      })
      it('_citext', () => {
        const td: TableDefinition = {
          column: {
            sqlType: '_citext',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, ['CustomType'], options).column.tsType, 'Array<string>')
      })
      it('_uuid', () => {
        const td: TableDefinition = {
          column: {
            sqlType: '_uuid',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, ['CustomType'], options).column.tsType, 'Array<string>')
      })
      it('_bytea', () => {
        const td: TableDefinition = {
          column: {
            sqlType: '_bytea',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, ['CustomType'], options).column.tsType, 'Array<string>')
      })
    })

    describe('maps to Array<Object>', () => {
      it('_json', () => {
        const td: TableDefinition = {
          column: {
            sqlType: '_json',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'Array<Object>')
      })
      it('_jsonb', () => {
        const td: TableDefinition = {
          column: {
            sqlType: '_jsonb',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'Array<Object>')
      })
    })

    describe('maps to Array<Date>', () => {
      it('_timestamptz', () => {
        const td: TableDefinition = {
          column: {
            sqlType: '_timestamptz',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, [], options).column.tsType, 'Array<Date>')
      })
    })

    describe('maps to custom', () => {
      it('CustomType', () => {
        const td: TableDefinition = {
          column: {
            sqlType: 'CustomType',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, ['CustomType'], options).column.tsType, 'CustomType')
      })
    })
    describe('maps to any', () => {
      it('UnknownType', () => {
        const td: TableDefinition = {
          column: {
            sqlType: 'UnknownType',
            nullable: false,
            columnType: '',
            tsType: '',
          },
        }
        assert.equal(PostgresDBReflection.mapTableDefinitionToType(td, ['CustomType'], options).column.tsType, 'any')
      })
    })
  })
})
