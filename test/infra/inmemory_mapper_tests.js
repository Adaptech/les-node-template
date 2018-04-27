import {deepClone} from "../../src/infra/utils";
import Mapper from "../../src/infra/memdb/Mapper";
import NoOpLogger from "../../src/infra/NoOpLogger";
import {models, testSuite} from "./mapper_tests";
import ModelDefinition from "../../src/infra/ModelDefinition";

const logger = new NoOpLogger();

function orderByPrimaryKey(data, modelDef) {
  return data.sort((a,b) => {
    for (const pk of modelDef.primaryKey) {
      if (a[pk] < b[pk]) {
        return -1;
      }
      if (a[pk] > b[pk]) {
        return 1;
      }
    }
    return 0;
  });
}

describe('Given an InMemory Mapper', function() {
  const modelDefs = [];
  let mapper;
  function storeFactory(data) {
    const modelDefsMap = {};
    for (const model of models) {
      const modelDef = ModelDefinition.fromReadModel(model);
      modelDefs.push(modelDef);
      modelDefsMap[model.name] = modelDef;
    }
    const initialData = deepClone(data);
    return {
      get: function(model) {
        return orderByPrimaryKey(deepClone(mapper._dataStore[model]), modelDefsMap[model]);
      },
      initialData
    };
  }
  function mapperFactory(store) {
    mapper = new Mapper(modelDefs, store.initialData, logger);
    return mapper;
  }
  testSuite(storeFactory, mapperFactory);
});
