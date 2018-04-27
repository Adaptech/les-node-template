import assert from "assert";
import NoOpLogger from "../../src/infra/NoOpLogger";
import Mapper from "../../src/infra/postgres/Mapper";
import SqlBuilder from "../../src/infra/postgres/SqlBuilder";
import {changeProxyFactory} from "../../src/infra/postgres/changeProxy";
import {testSuite, models} from "./mapper_tests";
import ModelDefinition from "../../src/infra/ModelDefinition";
const pgp = require('pg-promise')();
const pgConfig = {
  "host": "localhost",
  "port": 5432,
  "database": "vanillacqrstests",
  "user": "vanillacqrstests",
  "password": "vanillacqrstests"
};

/*
In order to run these tests you must create user/database vanillacqrstests. Here's the SQL:

-- login using a superuser
CREATE ROLE vanillacqrstests WITH LOGIN PASSWORD 'vanillacqrstests';
CREATE DATABASE vanillacqrstests WITH owner = vanillacqrstests;
*/

const logger = new NoOpLogger();

describe.skip('Given a Postgres Mapper', function() {
  const _db = pgp(pgConfig);
  const modelDefs = [];
  async function storeFactory(data) {
    await _db.none('DROP OWNED BY vanillacqrstests;');
    const modelDefsMap = {};
    for (const model of Object.keys(data)) {
      const modelDef = ModelDefinition.fromReadModel(models.find(x => x.name === model), true);
      modelDefs.push(modelDef);
      modelDefsMap[model] = modelDef;
      const createTableSql = SqlBuilder.createTable(modelDef);
      await _db.none(createTableSql);
      for (const value of data[model]) {
        const insertSql = SqlBuilder.upsert(Object.keys(value), modelDef);
        await _db.none(insertSql, value);
      }
    }
    return {
      get: async function(model) {
        const modelDef = modelDefsMap[model];
        const sql = `SELECT * FROM ${model}_v1 ORDER BY ${modelDef.primaryKey.map(x => `"${x}"`)}`;
        return (await _db.any(sql))
          .map(x => Object.assign({}, x));
      },
      _db
    };
  }
  function mapperFactory(store) {
    return new Mapper(modelDefs, store._db, logger);
  }
  testSuite(storeFactory, mapperFactory);
});

describe("Postgres changeProxy", function() {
  const orig = {a: 1, b: "str", c: true, d: null, e: {a: 1, b: 2, c: 3}, f: [1,2,3]};
  it("with changes should not change original object", function() {
    const {proxy} = changeProxyFactory(orig);
    proxy.a = 2;
    proxy.d = {a: 1, b: 2, c: 3};
    proxy.e.a = 2;
    proxy.f.push(4);
    proxy.f[0] = 2;
    assert.deepStrictEqual(orig, {a: 1, b: "str", c: true, d: null, e: {a: 1, b: 2, c: 3}, f: [1,2,3]});
  });
  it("with changes should only return changed fields", function() {
    const {proxy, handler} = changeProxyFactory(orig);
    proxy.a = 2;
    proxy.c = false;
    assert.deepStrictEqual(handler.getChanges(), {a: 2, c: false});
  });
  it("with null ref changes should only return changed fields", function() {
    const {proxy, handler} = changeProxyFactory(orig);
    proxy.d = {a: 1};
    assert.deepStrictEqual(handler.getChanges(), {d: {a: 1}});
  });
  it("with object ref changes should return complete object in changes", function() {
    const {proxy, handler} = changeProxyFactory(orig);
    proxy.e.a = 2;
    assert.deepStrictEqual(handler.getChanges(), {e: {a: 2, b: 2, c: 3}});
  });
  it("with object ref access should return no changes", function() {
    const {proxy, handler} = changeProxyFactory(orig);
    assert.deepStrictEqual(proxy.e, {a: 1, b: 2, c: 3});
    assert.deepStrictEqual(handler.getChanges(), {});
  });
  it("with array ref changes should return complete array in changes", function() {
    const {proxy, handler} = changeProxyFactory(orig);
    proxy.f.push(4);
    proxy.f[0] = 2;
    assert.deepStrictEqual(handler.getChanges(), {f: [2,2,3,4]});
  });
  it("with array ref access should return no changes", function() {
    const {proxy, handler} = changeProxyFactory(orig);
    assert.deepStrictEqual(proxy.f, [1,2,3]);
    assert.deepStrictEqual(handler.getChanges(), {});
  });
});