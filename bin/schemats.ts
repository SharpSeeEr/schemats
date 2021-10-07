#! /usr/bin/env node
/**
 * Commandline interface
 * Created by xiamx on 2016-08-10.
 */

import yargs from 'yargs'
import * as fs from 'fs'
import { typescriptOfSchema } from '../src/index'
import { OptionValues } from '../src/options'

interface SchematsArguments {
  conn: string;
  table: string[];
  schema: string;
  output: string;
  noHeader: boolean;
  camelCase: boolean;
  singular: boolean;
  meta: boolean;
}

const yargsOptions: { [key: string]: yargs.Options } = {
  conn: {
    alias: 'c',
    description: 'database connection string',
    demandOption: true,
    requiresArg: true,
    nargs: 1,
  },
  table: {
    alias: 't',
    description: 'table name',
    array: true,
    requiresArg: true,
  },
  schema: {
    alias: 's',
    description: 'schema name',
  },
  camelCase: {
    alias: 'C',
    description: 'convert table and column names to camel case',
    boolean: true,
  },
  singular: {
    description: 'convert table names from plural to singular',
    boolean: true,
  },
  meta: {
    alias: 'm',
    description: 'create meta-info objects for tables describing indexes and database types',
    boolean: true,
  },
  noHeader: {
    alias: 'no-header',
    description: 'Do not write header',
    boolean: true,
    default: false,
  },
  output: {
    alias: 'o',
    description: 'output filename',
    type: 'string',
  },
}

const argv = yargs(process.argv.slice(2))
  .usage('Usage: $0 <command> [options]')
  .global('config')
  .default('config', 'schemats.json')
  .config()
  .env('SCHEMATS')
  .command('generate', 'generate type definition')
  .demandCommand(1)
  .example(
    '$0 generate -c postgres://username:password@localhost/db -t table1 -t table2 -s schema -o interface_output.ts',
    'generate typescript interfaces from schema',
  )
  .help()
  .options(yargsOptions)
  .argv as unknown as SchematsArguments

console.log(argv)

const options: OptionValues = {
  writeHeader: !argv.noHeader || true,
  camelCase: argv.camelCase || false,
  singularTableNames: argv.singular || false,
  meta: argv.meta || false,
}

typescriptOfSchema(
  argv.conn,
  argv.table,
  argv.schema,
  options,
).then((formattedOutput) => {
  fs.writeFileSync(argv.output, formattedOutput)
  process.exit(0)
}).catch((e) => {
  console.error(e)
  process.exit(1)
})
