import os from "os";
import uuid from "uuid";
import leveldown from "leveldown";
import levelup from "levelup";
import assert from "assert";
import Mapper from "../../src/infra/leveldb/Mapper";
import Indexes from "../../src/infra/leveldb/Indexes";
import NoopLogger from "../../src/infra/NoOpLogger";
import {models, testSuite} from "./mapper_tests";
import ModelDefinition from "../../src/infra/ModelDefinition";

const logger = new NoopLogger();

describe('Given a LevelDB Mapper', function() {
  const modelDefs = [];
  async function storeFactory(data) {
    const tmpDbDir = os.tmpdir() + '/vanilla-cqrs-tests-' + uuid.v4();
    const db = levelup(leveldown(tmpDbDir));
    const batch = [];
    for (const model of Object.keys(data)) {
      const modelDef = ModelDefinition.fromReadModel(models.find(x => x.name === model));
      modelDefs.push(modelDef);
      for (const value of data[model]) {
        const pkValue = Indexes.getPrimaryKeyValue(modelDef, value);
        batch.push({type: 'put', key: pkValue, value: JSON.stringify(value)});
        Array.prototype.push.apply(batch,
          Indexes.getSecondaryKeys(modelDef, value)
            .map(sk => ({type: 'put', key: sk, value: pkValue})));
      }
      batch.push({type: 'put', key: `${model}$total`, value: data[model].length.toString()});
    }
    await db.batch(batch);
    return {
      get: function(model) {
        return new Promise((resolve, reject) => {
          const values = [];
          this._db.createReadStream({gt: `${model}:`, lt: `${model};`})
            .on('data', data => values.push(JSON.parse(data.value)))
            .on('end', () => resolve(values))
            .on('error', reject);
        });
      },
      _db: db
    };
  }
  function mapperFactory(store) {
    return new Mapper(modelDefs, store._db, logger);
  }
  testSuite(storeFactory, mapperFactory);

  describe('When insert records in parallel', function() {
    let store, mapper, caught;
    beforeEach(async function() {
      caught = null;
      store = await storeFactory({tests: []});
      mapper = await mapperFactory(store);
      const promises = [
        mapper.insert('tests', {testId: 123}).catch(err => caught = err),
        mapper.insert('tests', {testId: 124}).catch(err => caught = err)
      ];
      await Promise.all(promises);
    });
    it('should throw an error', function() {
      assert.notEqual(caught, null);
    });
    it('should have only inserted first record', async function() {
      const data = await store.get('tests');
      assert.equal(data.length, 1);
      assert.equal(data[0].testId, 123);
    });
  });
});