/**
 * @param {ReadModel[]} readModels
 * @return {ModelDefinition[]}
 */
import ModelDefinition from "./ModelDefinition";

export function buildModelDefs(readModels) {
  const modelDefs = [];
  for (const readModel of readModels) {
    modelDefs.push(ModelDefinition.fromReadModel(readModel, true));
    for (const k in readModel.lookups) {
      const lookup = readModel.lookups[k];
      const lookupName = `${readModel.name}_${k}_lookup`;
      modelDefs.push(ModelDefinition.fromLookup({name: lookupName, config: lookup}, true));
    }
  }
  return modelDefs;
}

export function buildModelDefsForLookups(prefix, lookups) {
  const modelDefs = [];
  for (const k in lookups) {
    const lookup = lookups[k];
    const lookupName = `${prefix}_${k}_lookup`;
    modelDefs.push(ModelDefinition.fromLookup({name: lookupName, config: lookup}, true));
  }
  return modelDefs;
}

/**
 * @param {ReadModel} readModel
 * @returns {string[]}
 */
export function getModelsFor(readModel) {
  const models = [];
  models.push(readModel.name);
  for (const k in readModel.lookups) {
    models.push(`${readModel.name}_${k}_lookup`);
  }
  return models;
}

/**
 * @interface ReadModel
 * @property {string}   name
 * @property {object}   config
 * @property {?object}  lookups
 * @property {function} handler
 */
