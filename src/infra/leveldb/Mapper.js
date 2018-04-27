/* eslint no-unused-vars: 0 */
import ModelDefinition from "../ModelDefinition";
import {filter} from "../utils";
import {Where, Order} from "../queries";
import Indexes from "./Indexes";
import {Mapper, MapperReadResult} from "../Mapper";

const DEFAULT_VERSION = 1;

//Notes:
// - LevelDB data is local, so we only need to support one version of the model
export class MapperImpl extends Mapper {
  /**
   * @param {ModelDefinition[]} modelsDefs
   * @param {object} db
   * @param {Logger} logger
   */
  constructor(modelsDefs, db, logger) {
    super(modelsDefs);
    this._db = db;
    this._logger = logger;
    this._locks = {};
  }

  /**
   * Note: this method is not
   * @param modelName
   * @param payload
   * @returns {Promise<void>}
   */
  async insert(modelName, payload) {
    const modelDef = this._getModelDefByName(modelName);
    modelDef.validatePayload(payload, true);

    if (this._locks[modelName]) {
      throw new Error(`Can't insert/delete in parallel in model ${modelName}.`);
    }
    this._locks[modelName] = true;

    try {
      const total = parseInt((await this._db.get(`${modelName}$total`)), 10);
      const batch = this._prepareSaveBatch(modelDef, payload);
      batch.push({type: 'put', key: `${modelName}$total`, value: (total + 1).toString()});
      await this._db.batch(batch);
      this._locks[modelName] = false;
    } catch (err) {
      this._locks[modelName] = false;
      throw err;
    }
  }

  async update(modelName, changes, where) {
    const modelDef = this._getModelDefByName(modelName);
    modelDef.validatePayload(changes, false);

    let count = 0;
    const batch = [];
    const {rows} = await this._find(modelDef, {where});
    for (const row of rows) {
      const pkHashBefore = Indexes.getPrimaryKeyValue(modelDef, row);
      const indexesHashesBefore = Indexes.getSecondaryKeys(modelDef, row);
      Object.assign(row, changes);
      const pkHashAfter = Indexes.getPrimaryKeyValue(modelDef, row);
      if (pkHashBefore !== pkHashAfter && (await this._existsByPrimaryKey(pkHashAfter))) {
        throw new Error(`Can't update ${modelName}. Would create duplicate primary key entries.`);
      }
      if (pkHashBefore !== pkHashAfter) {
        batch.push({type: 'del', key: pkHashBefore});
        const indexesOperations = indexesHashesBefore.map(sk => ({type: 'del', key: sk}));
        batch.push(...indexesOperations);
      }
      Array.prototype.push.apply(batch, this._prepareSaveBatch(modelDef, row));
      count++;
    }

    await this._db.batch(batch);
    return count;
  }

  async select(modelName, filter) {
    const modelDef = this._getModelDefByName(modelName);

    const {rows: results, total} = await this._find(modelDef, filter);
    if (filter.order && filter.order.length > 0) {
      this._order(results, filter.order);
    }
    if (!filter.skip && !filter.limit) {
      return new MapperReadResult(results, total);
    }

    const skip = parseInt(filter.skip) || 0;
    const limit = parseInt(filter.limit) || (total - skip);
    const pagedResults = results.slice(skip, skip + limit);
    return new MapperReadResult(pagedResults, total);
  }

  async remove(modelName, where) {
    const modelDef = this._getModelDefByName(modelName);

    if (this._locks[modelName]) {
      throw new Error(`Can't insert/delete in parallel in model ${modelName}.`);
    }
    this._locks[modelName] = true;

    try {
      let count = 0;
      const batch = [];
      const {rows} = await this._find(modelDef, {where});
      const total = parseInt((await this._db.get(`${modelName}$total`)), 10);
      for (const row of rows) {
        const pkHash = Indexes.getPrimaryKeyValue(modelDef, row);
        // Delete primary entry
        batch.push({type: 'del', key: pkHash});
        // Delete indexes entries
        const indexesOperations = Indexes.getSecondaryKeys(modelDef, row)
          .map(sk => ({type: 'del', key: sk}));
        batch.push(...indexesOperations);
        count++;
      }
      // Update total for model
      batch.push({type: 'put', key: `${modelName}$total`, value: (total - count).toString()});
      await this._db.batch(batch);
      this._locks[modelName] = false;
      return count;
    } catch (err) {
      this._locks[modelName] = false;
      throw err;
    }
  }

  async tryDropModel(modelName, version) {
    const modelVersion = await this.getModelVersion(modelName);
    if (modelVersion !== version) {
      return;
    }
    this._logger.info(`Dropping ReadModel '${modelName}'...`);
    const keys = await this._keysFor(modelName);
    keys.push(`${modelName}$total`);
    return this._db.batch(keys.map(key => ({type: 'del', key})));
  }

  _keysFor(modelName) {
    return new Promise((resolve, reject) => {
      const keys = [];
      this._db.createKeyStream({gte: `${modelName}!`, lte: `${modelName};`})
        .on('data', key => keys.push(key))
        .on('end', () => resolve(keys))
        .on('error', reject);
    });
  }

  async tryCreateModel(modelName, version) {
    return this._db.put(`${modelName}$total`, "0");
  }

  async getModelVersion(modelName) {
    let version;
    try {
      version = await this._db.get(`model:${modelName}:version`);
    } catch (err) {
      if (err.type === 'NotFoundError') {
        return 0;
      }
      throw err;
    }
    return parseInt(version, 10) || DEFAULT_VERSION;
  }

  async setModelVersion(modelName, version) {
    const modelDef = this._modelsDefs[modelName];
    version = version || modelDef.version;
    this._logger.info(`Setting ReadModel '${modelName}' version to ${version}.`);
    return this._db.put(`model:${modelName}:version`, version.toString());
  }

  /**
   * @param {ModelDefinition} modelDef
   * @param {object} payload
   * @returns {object[]}
   * @private
   */
  _prepareSaveBatch(modelDef, payload) {
    const pkValue = Indexes.getPrimaryKeyValue(modelDef, payload);
    if (!Indexes.isCompleteKey(pkValue)) {
      throw new Error(`Can't insert, missing primary key value(s) in payload.`);
    }
    const batch = [
      {type: 'put', key: pkValue, value: JSON.stringify(payload)}
    ];
    Indexes.getSecondaryKeys(modelDef, payload)
      .forEach(sk => {
        batch.push({type: 'put', key: sk, value: pkValue});
      });
    return batch;
  }

  /**
   * Load all results for a model
   * @param modelName
   * @param [predicate]
   * @param [limit]
   * @returns {Promise<object[]>}
   * @private
   */
  async _loadWhere(modelName, predicate, limit) {
    limit = limit || -1;
    predicate = predicate || (() => true);
    return new Promise((resolve, reject) => {
      const lb = `${modelName}:`;
      const ub = `${modelName};`;
      const rows = [];
      this._db.createReadStream({gte: lb, lt: ub, keys: false, values: true, limit: limit})
        .on('data', data => {
          const obj = JSON.parse(data);
          if (predicate(obj)) rows.push(obj);
        })
        .on('end', () => resolve(rows))
        .on('error', reject);
    });
  }

  /**
   * Load using keys
   * @param keys
   * @returns {Promise<Array<Object>>}
   * @private
   */
  async _loadByKeys(keys) {
    const results = [];
    for (const k of keys) {
      const rawValue = await this._db.get(k);
      results.push(JSON.parse(rawValue));
    }
    return results;
  }

  /**
   * Find results matching where clause for model
   * @param {ModelDefinition} modelDef
   * @param {Object} _filter
   * @returns {Promise<object>}
   * @private
   */
  async _find(modelDef, _filter) {
    const $where = Where.fromFilter(_filter);
    //TODO optimized query when using order and no constraints
    if ($where.isEmptyOrNull() && (!_filter.order || !_filter.order.length)) {
      this._logger.debug('Find %s using no where constraints (limit=%d, skip=%d)...', modelDef.name, _filter.limit, _filter.skip);
      const skip = _filter.skip || 0;
      const rows = await this._loadWhere(modelDef.name, null, _filter.limit ? _filter.limit + skip : null);
      const total = _filter.limit ? parseInt(await this._db.get(`${modelDef.name}$total`)) : rows.length;
      return {rows, total};
    }
    //TODO composite indexes (primary or secondary) are not detected and used
    const findByPk = $where.getIndexConstraint(modelDef.primaryKey.length > 1 ? modelDef.primaryKey : modelDef.primaryKey[0]);
    if (findByPk) {
      this._logger.debug('Find %s using PK %j...', modelDef.name, findByPk);
      const rows = await this._getByPrimaryKeys(modelDef.name, findByPk.operator, findByPk.value);
      const filteredRows = filter(rows, $where.rootNode());
      return {rows: filteredRows, total: filteredRows.length};
    }
    const findByIndex = modelDef.indexes
      .map(index => $where.getIndexConstraint(index.length > 1 ? index : index[0]))
      .filter(x => x !== null)[0];
    if (findByIndex) {
      this._logger.debug('Find %s using index %j...', modelDef.name, findByIndex);
      const keys = await this._getIndexKeys(`${modelDef.name}!${findByIndex.key}`, findByIndex.operator, findByIndex.value);
      const rows = await this._loadByKeys(keys);
      const filteredRows = filter(rows, $where.rootNode());
      return {rows: filteredRows, total: filteredRows.length};
    }
    this._logger.debug('Find %s using only where constraints and no limit...', modelDef.name);
    const predicate = $where.isEmptyOrNull()
      ? null
      : row => {
        const results = filter([row], $where.rootNode());
        return results && results.length === 1;
      };
    const rows = await this._loadWhere(modelDef.name, predicate);
    return {rows, total: rows.length};
  }

  async _existsByPrimaryKey(pk) {
    try {
      await this._db.get(pk);
      return true;
    } catch (err) {
      if (err.notFound) return false;
      throw err;
    }
  }

  _getByPrimaryKeys(modelName, operator, value) {
    let options = {};
    let predicate = keyValue => true;
    const lowerBound = `${modelName}:`;
    const upperBound = `${modelName};`;
    switch (operator) {
      case 'eq':
        //TODO verify if this needs to be optimized. is get faster than iterating over one key?
        options = {gte: `${modelName}:${value}`, lte: `${modelName}:${value}`};
        break;
      case 'lt':
        options = {gt: lowerBound, lt: `${modelName}:${value}`};
        break;
      case 'lte':
        options = {gt: lowerBound, lte: `${modelName}:${value}`};
        break;
      case 'gt':
        options = {gt: `${modelName}:${value}`, lt: upperBound};
        break;
      case 'gte':
        options = {gte: `${modelName}:${value}`, lt: upperBound};
        break;
      case 'between':
        value.sort();
        options = {gte: `${modelName}:${value[0]}`, lte: `${modelName}:${value[1]}`};
        break;
      case 'inq': {
        value.sort();
        options = {gte: `${modelName}:${value[0]}`, lte: `${modelName}:${value[value.length - 1]}`};
        predicate = keyValue => value.find(x => x.toString() === keyValue);
        break;
      }
      case 'ilike': {
        options = {gt: lowerBound, lt: upperBound};
        const pattern = value.replace(/_/g, '.').replace(/%/g, '.*');
        const regex = new RegExp(`^${pattern}$`, 'i');
        predicate = keyValue => regex.test(keyValue);
        break;
      }
      case 'neq':
        options = {gt: lowerBound, lt: upperBound};
        predicate = keyValue => keyValue !== value;
        break;
      default:
        throw new Error(`Operator "${operator}" not implemented.`);
    }
    return new Promise((resolve, reject) => {
      const rows = [];
      this._db.createReadStream(options)
        .on('data', data => {
          const key = data.key.toString();
          if (predicate(key.split(':')[1])) {
            const obj = JSON.parse(data.value.toString());
            rows.push(obj);
          }
        })
        .on('end', () => resolve(rows))
        .on('error', reject);
    });
  }

  _getIndexKeys(index, operator, value) {
    let options = {};
    let predicate = keyValue => true;
    const lowerBound = `${index}:`;
    const upperBound = `${index};`;
    switch (operator) {
      case 'eq':
        options = {gt: `${index}:${value}:`, lt: `${index}:${value};`};
        break;
      case 'lt':
        options = {gt: lowerBound, lt: `${index}:${value};`};
        break;
      case 'lte':
        options = {gt: lowerBound, lte: `${index}:${value};`};
        break;
      case 'gt':
        options = {gt: `${index}:${value}:`, lt: upperBound};
        break;
      case 'gte':
        options = {gte: `${index}:${value}:`, lt: upperBound};
        break;
      case 'between':
        value.sort();
        options = {gte: `${index}:${value[0]}:`, lte: `${index}:${value[1]};`};
        break;
      case 'inq':
        value.sort();
        options = {gte: `${index}:${value[0]}:`, lte: `${index}:${value[value.length - 1]};`};
        break;
      case 'ilike': {
        options = {gt: lowerBound, lt: upperBound};
        const pattern = value.replace(/_/g, '.').replace(/%/g, '.*');
        const regex = new RegExp(`^${pattern}$`, 'i');
        predicate = keyValue => regex.test(keyValue);
        break;
      }
      case 'neq':
        options = {gt: lowerBound, lt: upperBound};
        predicate = keyValue => keyValue !== value;
        break;
      default:
        throw new Error(`Operator "${operator}" not implemented.`);
    }
    return new Promise((resolve, reject) => {
      const keys = new Set();
      this._db.createReadStream(options)
        .on('data', data => {
          if (predicate(data.key.toString().split(':')[1])) {
            keys.add(data.value.toString());
          }
        })
        .on('end', () => resolve(Array.from(keys)))
        .on('error', reject);
    });
  }

  _order(rows, order) {
    const orders = new Order(order).getOrders();
    rows.sort((a, b) => {
      for (const order of orders) {
        const [field, direction] = order;
        if (a[field] < b[field]) {
          return -1 * direction;
        }
        if (a[field] > b[field]) {
          return 1 * direction;
        }
      }
      return 0;
    });
    return rows;
  }
}

export default MapperImpl;