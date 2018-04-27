import util from 'util';
const VALID_TYPES = ['boolean', 'string', 'number', 'object', 'array'];
const VALID_ARRAY_TYPES = ['boolean', 'string', 'number', 'object'];

/**
 * Instantiate a new ModelValidationError
 * @param {string} message
 * @param {Error[]} errors
 * @constructor
 * @property {string} name
 * @property {string} message
 * @property {Error[]} errors
 */
function ModelValidationError(message, errors) {
  Error.captureStackTrace(this, ModelValidationError);
  this.name = this.constructor.name;
  this.message = `${message}: ${errors.map(x => `"${x.field}" ${x.message}`).join(', ')}.`;
  this.errors = errors;
}
util.inherits(ModelValidationError, Error);

function isValidIndex(index) {
  return Array.isArray(index)
    ? index.every(x => typeof x === 'string' && x !== '')
    : typeof index === 'string' && index !== '';
}

function keyIsInSchema(index, schema) {
  if (!schema) return false;
  return Array.isArray(index)
    ? index.every(x => !!schema[x])
    : !!schema[index];
}

function typeOf(x) {
  const t = typeof x;
  if (t !== 'object') return t;
  if (Array.isArray(x)) return 'array';
  if (x === null) return 'null';
  return t;
}

/**
 * ModelDefinition
 * @class
 * @property {string}     name
 * @property {function}   handler
 * @property {number}     version
 * @property {string}     tableName
 * @property {string[]}   primaryKey
 * @property {string[][]} indexes
 * @property {string[]}   columns
 * @property {object}     columnDefs
 * @property {object}     schema
 */
export default class ModelDefinition {
  static fromReadModel(readModel, requireSchema) {
    return new ModelDefinition(readModel, requireSchema);
  }

  static fromLookup(lookup, requireSchema) {
    return new ModelDefinition(lookup, requireSchema, true);
  }

  static validateConfig(readModel) {
    if (!readModel.config) throw new Error(`Read model ${readModel.name} config is missing.`);
    const validationErrors = [];
    const config = readModel.config;
    if (!config.schema) throw new Error(`Read model ${readModel.name} schema is missing.`);
    if (!isValidIndex(config.key)) {
      validationErrors.push({field: 'key', message: '(primary) key(s) must be an non-empty string or an array of non-empty string.'});
    } else if (!keyIsInSchema(config.key, config.schema)) {
      validationErrors.push({field: 'key', message: '(primary) key(s) is(are) not defined in schema.'});
    }
    if (config.indexes) {
      for (let i = 0; i < config.indexes.length; i++) {
        const index = config.indexes[i];
        if (!isValidIndex(index)) {
          validationErrors.push({
            field: `indexes[${i}]`,
            message: 'index must be an non-empty string or an array of non-empty string.'
          });
        } else if (!keyIsInSchema(index, config.schema)) {
          validationErrors.push({
            field: `indexes[${i}]`,
            message: 'index key(s) is(are) not defined in schema.'
          });
        }
      }
    }

    const pks = Array.isArray(config.key) ? config.key : [config.key];
    for (const propName of Object.keys(config.schema)) {
      const value = config.schema[propName];
      if (typeof value !== 'object') {
        validationErrors.push({field: `schema[${propName}]`, message: 'schema property value must be an object.'});
      } else if (!VALID_TYPES.includes(value.type)) {
        validationErrors.push({field: `schema[${propName}].type`, message: `invalid type: ${value.type}`});
      } else if (value.type === 'array') {
        if (!value.items || typeof value.items !== 'object') {
          validationErrors.push({field: `schema[${propName}].items`, message: `items must be an object.`});
        } else if (!VALID_ARRAY_TYPES.includes(value.items.type)) {
          validationErrors.push({
            field: `schema[${propName}].items.type`,
            message: `invalid type: ${value.items.type}`
          });
        }
      }
      if (pks.includes(propName) && value.nullable !== false) {
        validationErrors.push({field: `schema[${propName}].nullable`, message: `nullable must be set to false for primary key.`});
      }
    }

    if (validationErrors.length) {
      throw new ModelValidationError(`Model "${readModel.name}" validation failed`, validationErrors);
    }
  }

  constructor(model, requireSchema, isLookup) {
    if (!model) throw new Error('Missing "readModel" parameter.');
    if (!model.name) throw new Error('Missing "name" in read model exports.');
    this.name = model.name;
    if (!isLookup) {
      if (!model.handler) throw new Error(`Missing "handler" in read model "${model.name}" exports.`);
      if (typeof model.handler !== 'function') throw new Error(`Read model "${model.name}" handler should be a function.`);
      this.handler = model.handler;
    }
    ModelDefinition.validateConfig(model);
    this.version = parseInt(model.version, 10) || 1;
    this.tableName = `${this.name}_v${this.version}`;
    this.primaryKey = this._parseKey(model.config.key, "primary");
    this.indexes = (model.config.indexes || []).map((k, i) => this._parseKey(k, `index[${i}]`));
    if (requireSchema) {
      const configSchema = model.config.schema;
      this.columns = Object.keys(configSchema);
      this.columnDefs = this.columns.reduce((columnDefs, columnName) => {
        const columnDef = {...configSchema[columnName]};
        if (this.primaryKey.includes(columnName)) columnDef.isPrimaryKey = true;
        if (columnDef.nullable === undefined) columnDef.nullable = true; // Columns are nullable by default
        columnDefs[columnName] = columnDef;
        return columnDefs;
      }, {});
      const indexesColumns = new Set();
      for (const index of this.indexes) {
        for (const columnName of index) {
          indexesColumns.add(columnName);
        }
      }
    }
    this.schema = model.config.schema;
    Object.freeze(this);
  }

  /**
   * @param {string|string[]} key
   * @param {string} description
   * @returns {string[]}
   * @private
   */
  _parseKey(key, description) {
    if (typeof key === 'string') {
      return [key];
    }
    if (Array.isArray(key)) {
      return key;
    }
    throw new Error(`Invalid ${description} key definition for read model ${this.name}.`);
  }

  /**
   * Validate payload with schema
   * @param {object} payload
   * @param {boolean} [requireAll]
   * @throws {ModelValidationError} Throws if payload is not valid
   */
  validatePayload(payload, requireAll = false) {
    const validationErrors = [];
    for (const key of Object.keys(payload)) {
      if (!this.schema[key]) {
        validationErrors.push({field: key, message: 'field is not defined in schema'});
        continue;
      }
      const value = payload[key];
      const schemaType = this.schema[key].type;
      const valueType = typeOf(value);
      if (valueType === "null" && value === null) {
        continue;
      }
      if (valueType !== schemaType) {
        validationErrors.push({field: key, message: `expected type "${schemaType}" got "${valueType}"`});
      }
    }
    if (requireAll) {
      for (const key of Object.keys(this.schema)) {
        if (!payload.hasOwnProperty(key)) {
          validationErrors.push({field: key, message: `field is missing`});
        }
      }
    }
    if (validationErrors.length) {
      throw new ModelValidationError(`Invalid payload for model "${this.name}"`, validationErrors);
    }
  }
}
