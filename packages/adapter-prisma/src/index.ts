export { PrismaAdapter, type PrismaAdapterConfig } from './adapter.js';
export {
  createRealTable,
  dropRealTable,
  addColumn,
  dropColumn,
  createExpressionIndex,
  dropExpressionIndex,
  atomicDDL,
  getTableColumnNames,
} from './ddl.js';
export { ensureRealTable, rollbackMigration } from './migration.js';
