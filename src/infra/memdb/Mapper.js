/* eslint no-unused-vars: 0 */
import {Order, Where} from "../queries";
import {deepClone, filter} from "../utils";
import {Mapper, MapperReadResult} from "../Mapper";

function normalizeValue(value) {
  if (value === undefined || value === null) return '';
  return value;
}

function hashRecord(type, payload, fields) {
  return type + ':' + fields.map(f => normalizeValue(payload[f])).join(':');
}

export class MapperImpl extends Mapper {
  /**
   * @param {ModelDefinition[]} modelsDefs
   * @param {object} initialState
   * @param {Logger} logger
   */
  constructor(modelsDefs, initialState, logger) {
    super(modelsDefs);
    this._logger = logger;
    this._dataStore = {};
    this._primaryKeys = {};
    for (const modelDef of modelsDefs) {
      this._dataStore[modelDef.name] = initialState[modelDef.name] || [];
      for (const record of this._dataStore[modelDef.name]) {
        const pkHash = hashRecord(modelDef.name, record, modelDef.primaryKey);
        this._primaryKeys[pkHash] = record;
      }
    }
  }

  addModel(modelDef) {
    super.addModel(modelDef);
    this._dataStore[modelDef.name] = [];
  }

  /**
   * Insert payload into readModel's identified by modelName
   * If an object with the same key exists it is updated
   * Note: The mapper doesn't clone the payload, you should pass a clone if you don't want to hold a reference to the stored object
   * @async
   * @param {string} modelName
   * @param {Object} payload
   * @returns {Promise<void>}
   */
  async insert(modelName, payload) {
    const modelDef = this._getModelDefByName(modelName);
    modelDef.validatePayload(payload, true);

    const pk = hashRecord(modelDef.name, payload, modelDef.primaryKey);
    const existing = this._primaryKeys[pk];
    if (existing) {
      this._logger.debug('Found one with identical key, updating', modelName, payload);
      Object.assign(existing, payload);
      return;
    }
    // this._logger.debug('InMemory.insert', modelName, payload);
    this._dataStore[modelName].push(payload);
    this._primaryKeys[pk] = payload;
  }

  /**
   * Update readModel(s) identified by modelName and filtered by constraints
   * Note: The mapper doesn't clone the changes, you should pass a clone if you don't want to hold a reference to the stored object properties
   * @async
   * @param {string} modelName
   * @param {Object} changes
   * @param {Object} where
   * @returns {Promise<number>}
   */
  async update(modelName, changes, where) {
    const modelDef = this._getModelDefByName(modelName);
    modelDef.validatePayload(changes);

    const $where = new Where(where);
    const constraints = $where.rootNode();

    const rows = this._find(modelName, constraints);
    for (const row of rows) {
      const tmp = Object.assign(deepClone(row), changes);
      const pkHash = hashRecord(modelDef.name, tmp, modelDef.primaryKey);
      const found = this._primaryKeys[pkHash];
      if (found && found !== row) {
        throw new Error(`Can't update ${modelName}. Would create duplicate primary key entries.`);
      }
    }

    let count = 0;
    rows.forEach(row => {
      this._logger.debug('InMemory.update', row, changes, constraints);
      const pkHashBefore = hashRecord(modelDef.name, row, modelDef.primaryKey);
      delete this._primaryKeys[pkHashBefore];
      Object.assign(row, changes);
      const pkHashAfter = hashRecord(modelDef.name, row, modelDef.primaryKey);
      this._primaryKeys[pkHashAfter] = row;
      count++;
    });
    return count;
  }

  /**
   * Fetch readModel(s) identified by modelName and filtered by constraints
   * @async
   * @param {string} modelName
   * @param {Filter|{}} filter
   * @returns {Promise<MapperReadResult>}
   */
  async select(modelName, filter) {
    const modelDef = this._getModelDefByName(modelName);
    const $where = Where.fromFilter(filter);
    const constraints = $where.rootNode();
    const results = deepClone(this._find(modelDef.name, constraints));
    const $order = Order.fromFilter(filter);
    const orders = $order.getOrders();
    this._order(results, orders);
    const total = results.length;
    if (!filter.skip && !filter.limit) {
      return new MapperReadResult(results, total);
    }

    const skip = parseInt(filter.skip) || 0;
    const limit = parseInt(filter.limit) || (total - skip);
    const pagedResults = results.slice(skip, skip + limit);
    return new MapperReadResult(pagedResults, total);
  }

  /**
   * Remove readModel's entry/ies that matches the where constraints
   * @param {string} modelName
   * @param {Object} where
   * @returns {Promise<number>}
   */
  async remove(modelName, where) {
    const modelDef = this._getModelDefByName(modelName);
    const modelData = this._dataStore[modelDef.name];
    let count = 0;
    this._dataStore[modelDef.name] = modelData.filter(row => {
      const rowShouldBeDeleted = filter([row], where).length === 1;
      if (rowShouldBeDeleted) {
        count++;
        const pkHash = hashRecord(modelDef.name, row, modelDef.primaryKey);
        delete this._primaryKeys[pkHash];
      }
      return !rowShouldBeDeleted;
    });
    return count;
  }

  async tryDropModel(modelName, version) {
    const modelDef = this._getModelDefByName(modelName);
    const modelData = this._dataStore[modelDef.name];
    for (const entry of modelData) {
      const pkHash = hashRecord(modelDef.name, entry, modelDef.primaryKey);
      delete this._primaryKeys[pkHash];
    }
    this._dataStore[modelDef.name] = [];
  }

  async tryCreateModel(modelName, version) {
    this._getModelDefByName(modelName);
    // In memory nothing to do
  }

  async getModelVersion(modelName) {
    const modelDef = this._getModelDefByName(modelName);
    // In memory always has the last model since we rebuild at each start
    return modelDef.version;
  }

  async setModelVersion(modelName, version) {
    this._getModelDefByName(modelName);
    // In memory model, nothing to do
  }

  _find(modelName, constraints) {
    const rows = this._dataStore[modelName];
    if (constraints) {
      return filter(rows, constraints);
    }
    return rows;
  }

  _order(rows, orders) {
    if (!orders || !orders.length) return;
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
  }
}

export default MapperImpl;