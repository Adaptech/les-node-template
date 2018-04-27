export class ReadRepository {
  constructor(mapper, logger) {
    this._mapper = mapper;
    this._logger = logger;
  }

  /**
   * Find one entity of a readModel matching where constraints
   * @param {string}  modelName       readModel name
   * @param {Object}  where           find entity matching the where
   * @param {boolean} [noThrowOnNotFound] Set to true if you don't want an error thrown if no result are found
   * @returns {Promise<Object>}
   */
  async findOne(modelName, where, noThrowOnNotFound) {
    if (!modelName) {
      throw new Error(`modelName can't be null.`);
    }
    if (!where) {
      throw new Error(`where can't be null.`);
    }
    const result = await this._mapper.select(modelName, {where, limit: 1});
    if ((!result || !result.results || !result.results[0]) && !noThrowOnNotFound) {
      const notFoundError = new Error(`No result found for ${modelName} with criteria ${JSON.stringify(where)}.`);
      notFoundError.code = 'NotFound';
      throw notFoundError;
    }
    return result.results[0];
  }

  /**
   * Find multiple entities of a readModel
   * @param {string}      modelName   readModel name
   * @param {Object}      where       find entities matching the where constraints
   * @returns {Promise<Object[]>}
   */
  async findWhere(modelName, where) {
    if (!modelName) {
      throw new Error(`modelName can't be null.`);
    }
    if (!where) {
      throw new Error(`where can't be null.`);
    }
    const result = await this._mapper.select(modelName, {where});
    return result.results;
  }

  /**
   * Find by filter
   * @param {string}  modelName
   * @param {Filter|{}}  filter
   * @returns {Promise<ReadResult|Object[]>}
   */
  async findByFilter(modelName, filter) {
    const result = await this._mapper.select(modelName, filter);
    if (filter.paging) {
      return result;
    }
    return result.results;
  }

  /**
   * Find all entities of a readModel
   * @param {string} modelName    readModel name
   * @returns {Promise<Object[]>}
   */
  async findAll(modelName) {
    const result = await this._mapper.select(modelName, {});
    return result.results;
  }

  /**
   * Does an entity exists
   * @param {string} modelName    readModel name
   * @param {Object} where        entity matching the where constraints
   * @returns {Promise<boolean>}
   */
  async exists(modelName, where) {
    const result = await this._mapper.select(modelName, {where, limit: 1});
    return !!(result && result.results && result.results.length > 0);
  }
}
export default ReadRepository;

/**
 * @interface Filter
 * @property {?Object} where
 * @property {?string|string[]} order
 * @property {?number} skip
 * @property {?number} limit
 * @property {?boolean} paging
 */

/**
 * @interface ReadResult
 * @property {Object[]} results
 * @property {?number}  total
 */