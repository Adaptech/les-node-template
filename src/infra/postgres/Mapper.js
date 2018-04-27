import SqlError from "./SqlError";
import { Where, Order } from "../queries";
import SqlBuilder from "./SqlBuilder";
import {Mapper, MapperReadResult} from "../Mapper";

export const CREATE_VERSION_SQL = `CREATE TABLE "$versions" (name TEXT PRIMARY KEY, version FLOAT(53))`;
const GET_VERSION_SQL = `SELECT version FROM "$versions" WHERE name = $1`;
const SET_VERSION_SQL = `INSERT INTO "$versions" (name, version) VALUES ($1, $2) 
 ON CONFLICT (name) DO UPDATE SET version = $2`;
const FULL_COUNT_COLUMN = "$full_count";

/**
 * ReadModel - Postgres Mapper
 */
export class MapperImpl extends Mapper {
  /**
   * @constructor
   * @param {ModelDefinition[]} modelsDefs
   * @param {object} db
   * @param {object} logger
   */
  constructor(modelsDefs, db, logger) {
    super(modelsDefs);
    this._db = db;
    this._logger = logger;
  }

  /**
   * Insert payload into read model
   * @param {string} modelName
   * @param {object} payload
   * @returns {Promise<void>}
   */
  async insert(modelName, payload) {
    const modelDef = this._getModelDefByName(modelName);
    modelDef.validatePayload(payload, true);

    const sql = SqlBuilder.upsert(Object.keys(payload), modelDef);
    await this._runSql(this._db.none, sql, payload);
  }

  /**
   * Update read model with changes when where condition is met
   * @param {string} modelName
   * @param {object} changes
   * @param {object} where
   * @returns {Promise<number>}
   */
  async update(modelName, changes, where) {
    const modelDef = this._getModelDefByName(modelName);
    modelDef.validatePayload(changes);
    const _where = new Where(where);
    const updateKeys = Object.keys(changes); //.filter(k => !modelDef.primaryKey.includes(k));
    const setValues = updateKeys.map(k => changes[k]);
    const { sql: whereSql, values } = SqlBuilder.toWhereSql(_where, setValues);
    const sql = SqlBuilder.update(updateKeys, whereSql, modelDef);
    const result = await this._runSql(this._db.result, sql, values);
    return result.rowCount;
  }

  /**
   * Select from read model
   * @param {string} modelName
   * @param {object} filter
   * @returns {Promise<MapperReadResult>}
   */
  async select(modelName, filter) {
    const modelDef = this._getModelDefByName(modelName);
    const where = Where.fromFilter(filter);
    const orderBy = Order.fromFilter(filter);
    return this._find(modelDef, where, orderBy, filter.skip, filter.limit);
  }

  async remove(modelName, where) {
    const modelDef = this._getModelDefByName(modelName);
    const _where = new Where(where);
    const { sql: whereSql, values } = SqlBuilder.toWhereSql(_where);
    const sql = SqlBuilder.delete(whereSql, modelDef);
    const result = await this._runSql(this._db.result, sql, values);
    return result.rowCount;
  }

  /**
   * Drop read model if it exists
   * @param {string} modelName
   * @param {number} [version]
   * @returns {Promise<void>}
   */
  async tryDropModel(modelName, version) {
    const modelDef = this._getModelDefByName(modelName);
    const useVersion = version || modelDef.version;
    const sql = `DROP TABLE IF EXISTS ${modelDef.name}_v${useVersion};\n`;
    await this._runSql(this._db.none, sql);
  }

  /**
   * Create read model if it doesn't exists
   * @param {string} modelName
   * @param {number} [version]
   * @returns {Promise<void>}
   */
  async tryCreateModel(modelName, version) {
    const modelDef = this._getModelDefByName(modelName);
    const useVersion = version || modelDef.version;
    this._logger.info(`Try creating model ${modelDef.name} table for version ${useVersion}...`);
    let sql = SqlBuilder.createTable(modelDef) + ";\n";
    for (const indexColumns of modelDef.indexes) {
      sql += SqlBuilder.createIndex(indexColumns, modelDef) + ";\n";
    }
    await this._runSql(this._db.none, sql);
  }

  /**
   * Get read model version
   * @param {string} modelName
   * @returns {Promise<number>}
   */
  async getModelVersion(modelName) {
    const modelDef = this._getModelDefByName(modelName);
    const result = await this._runSql(this._db.oneOrNone, GET_VERSION_SQL, modelDef.name);
    if (!result) return 0;
    return result.version;
  }

  /**
   * Set read model version
   * @param {string} modelName
   * @param {number} version
   * @returns {Promise<void>}
   */
  async setModelVersion(modelName, version) {
    const modelDef = this._getModelDefByName(modelName);
    await this._runSql(this._db.none, SET_VERSION_SQL, [modelDef.name, version || modelDef.version]);
  }

  async _find(model, where, orderBy, skip = 0, limit = "ALL") {
    const { sql: whereSql, values } = SqlBuilder.toWhereSql(where);
    const sql = SqlBuilder.select(whereSql, orderBy, model);
    const sqlLimit = ` OFFSET ${skip} LIMIT ${limit}`;
    const results = (await this._runSql(this._db.any, sql + sqlLimit, values)) || [];
    const total = results.length ? parseInt(results[0][FULL_COUNT_COLUMN]) : 0;
    return new MapperReadResult(results.map(({[FULL_COUNT_COLUMN]: x, ...y}) => y), total);
  }

  async _runSql(method, sql, values) {
    try {
      this._logger.debug("SQL", sql, values);
      return (await method.call(this._db, sql, values));
    } catch (e) {
      throw new SqlError(e, sql, values);
    }
  }
}
export default MapperImpl;