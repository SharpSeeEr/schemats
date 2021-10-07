export function convertToEntity<T>(row: Record<string, any>): T {
  if (!row) throw new Error('Cannot convert null entity')
  return Object.keys(row)
    .reduce((entity, key) => ({
      ...entity,
      [key as keyof T]: row[key],
    }), {} as T)
}
