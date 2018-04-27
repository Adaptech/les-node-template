/**
 * @abstract
 */
export class Mapper {
  /**
   * @param {ModelDefinition[]} modelsDefs
   */
  constructor(modelsDefs) {
    this._modelsDefs = {};
    for (const modelDef of modelsDefs) {
      this._modelsDefs[modelDef.name] = modelDef;
    }
  }

  /**
   * @param {string} modelName
   * @returns {ModelDefinition}
   */
  _getModelDefByName(modelName) {
    const modelDef = this._modelsDefs[modelName];
    if (!modelDef) throw new Error(`Read model "${modelName}" is not registered.`);
    return modelDef;
  }

  /**
   * @public
   * @param {ModelDefinition} modelDef
   */
  addModel(modelDef) {
    this._modelsDefs[modelDef.name] = modelDef;
  }

  /**
   * Insert payload into readModel's identified by modelName
   * If an object with the same key exists it is updated
   * @async
   * @param {string} modelName
   * @param {object} payload
   * @returns {Promise<void>}
   */
  insert(modelName, payload) {
    throw new Error("Not implemented!");
  }

  /**
   * Update readModel's entry/ies identified by modelName and filtered by constraints
   * @async
   * @param {string} modelName
   * @param {Object} changes
   * @param {Object} where
   * @returns {Promise<number>} number of entry/ies updated
   */
  update(modelName, changes, where) {
    throw new Error("Not implemented");
  }

  /**
   * Fetch readModel(s) identified by modelName and filtered by constraints
   * @async
   * @param {string} modelName
   * @param {Filter|{}} filter
   * @returns {Promise<MapperReadResult>}
   */
  select(modelName, filter) {
    throw new Error("Not implemented");
  }

  /**
   * Remove readModel's entry/ies that matches the where constraints
   * @param {string} modelName
   * @param {Object} where
   * @returns {Promise<number>} number of entries removed
   */
  remove(modelName, where) {
    throw new Error("Not implemented");
  }

  /**
   * Drop read model if it exists
   * @param {string} modelName
   * @param {number} [version]
   * @returns {Promise}
   */
  tryDropModel(modelName, version) {
    throw new Error("Not implemented");
  }

  /**
   * Create read model if it doesn't exists
   * @param {string} modelName
   * @param {number} [version]
   * @returns {Promise<void>}
   */
  tryCreateModel(modelName, version) {
    throw new Error("Not implemented");
  }

  /**
   * Get read model version
   * @param {string} modelName
   * @returns {Promise<number>}
   */
  getModelVersion(modelName) {
    throw new Error("Not implemented");
  }

  /**
   * Set read model version
   * @param {string} modelName
   * @param {number} version
   * @returns {Promise<void>}
   */
  setModelVersion(modelName, version) {
    throw new Error("Not implemented");
  }
}

/**
 * @class
 * @property {Object[]} results
 * @property {?number} total
 */
export class MapperReadResult {
  /**
   * @param {Object[]} results
   * @param {number} [total]
   */
  constructor(results, total) {
    this.results = results;
    this.total = total;
  }
}

export default Mapper;