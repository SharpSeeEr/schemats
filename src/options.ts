import { camelCase, upperFirst } from 'lodash'
import { singular } from 'pluralize'

// const DEFAULT_OPTIONS: OptionValues = {
//   writeHeader: true,
//   camelCase: false,
//   singularTableNames: false,
//   meta: false,
// }

export type OptionValues = {
  camelCase: boolean
  writeHeader: boolean // write schemats description header
  singularTableNames: boolean,
  meta: boolean,
}

export default class Options {
  public options: OptionValues

  constructor(options: OptionValues) {
    this.options = { ...options }
  }

  private singularizeTypeName(name: string): string {
    const single = this.options.singularTableNames ? singular(name) : name
    console.log('singluarizeTypeName', this.options.singularTableNames, name, single)
    return single
  }

  private camelCaseName(name: string): string {
    return this.options.camelCase ? camelCase(name) : name
  }

  transformTypeName(typename: string) {
    let transformed = typename
    transformed = this.singularizeTypeName(transformed)
    transformed = this.camelCaseName(transformed)
    return upperFirst(transformed)
  }

  transformColumnName(columnName: string) {
    return this.camelCaseName(columnName)
  }
}
