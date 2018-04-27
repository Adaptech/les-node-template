export class Indexes {
  static isCompleteKey(key) {
    const parts = key.split(':');
    return (parts.length > 1 && parts.every(x => !!x));
  }

  static getNormalizedKeyData(modelName, key, payload) {
    if (typeof key === 'string') {
      const value = payload[key];
      return value === undefined ? '' : value;
    }
    if (Array.isArray(key)) {
      return key.map(p => Indexes.getNormalizedKeyData(modelName, p, payload)).join(':');
    }
    throw new Error(`Invalid key descriptor for model ${modelName}.`);
  }

  // modelName:values...
  static getPrimaryKeyValue(model, payload) {
    return [model.name, Indexes.getNormalizedKeyData(model.name, model.primaryKey, payload)].join(':');
  }

  // modelName!index_name:values...
  static getSecondaryKeyValue(modelName, key, payload, pk) {
    const k = Array.isArray(key) ? key.join('_') : key;
    return [`${modelName}!${k}`, Indexes.getNormalizedKeyData(modelName, key, payload), pk].join(':');
  }

  static getSecondaryKeys(model, payload) {
    if (!model.indexes || model.indexes.length === 0) {
      return [];
    }
    const pkValue = Indexes.getNormalizedKeyData(model.name, model.primaryKey, payload);
    return model.indexes
      .map(key => Indexes.getSecondaryKeyValue(model.name, key, payload, pkValue));
  }
}

export default Indexes;