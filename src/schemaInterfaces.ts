import Options from './options'

export interface ColumnDefinition {
  sqlType: string;
  columnType: string;
  nullable: boolean;
  tsType: string;
}

export interface TableDefinition {
  [columnName: string]: ColumnDefinition
}

export interface EnumDefinition {
  [columnName: string]: string[];
}

export interface Database {
  connectionString: string
  query<T>(queryString: string): Promise<T[]>
  getDefaultSchema(): string
  getEnumTypes(schema?: string): Promise<EnumDefinition>
  getTableDefinition(tableName: string, tableSchema: string): Promise<TableDefinition>
  getTableTypes(tableName: string, tableSchema: string, options: Options): Promise<TableDefinition>
  getSchemaTables(schemaName: string): Promise<string[]>
}
