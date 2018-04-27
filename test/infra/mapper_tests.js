import assert from "assert";
import {deepClone, deepFreeze, filter} from "../../src/infra/utils";

/*
things to consider:
- updating primary key field(s)
- leveldb is ordered by primary key by default
- postgres/sql primary key can't be null
- postgres/sql values are null if missing and field is nullable
*/

/* TODO - more tests
Inserts
-

Update
-

Select
- with skip
- with limit
- with filtering
  - filtering on pk
  - filtering on secondary index
  - filtering on non-indexed field
  - complex filtering
- with ordering
  - ordering on pk
  - ordering on secondary index
  - ordering on non-indexed field
  - ordering on 2 fields
*/
export const models = [
  {
    name: 'simpletests',
    config: {
      key: 'testId',
      indexes: [['idx1'], ['idx21', 'idx22']],
      schema: {
        testId: {type: 'number', nullable: false},
        str: {type: 'string'},
        num: {type: 'number'},
        b: {type: 'boolean'},
        idx1: {type: 'number'},
        idx21: {type: 'string'},
        idx22: {type: 'number'},
        obj: {type: 'object'},
        a: {type: 'array', items: {type: 'string'}}
      }
    },
    lookups: {
      test: {
        key: 'testId',
        schema: {
          testId: {type: 'number', nullable: false},
          text: {type: 'string'}
        }
      }
    },
    handler: function() {
    }
  },
  {
    name: 'compositetests',
    config: {
      key: ['testId', 'str'],
      indexes: [['idx1'], ['idx21', 'idx22']],
      schema: {
        testId: {type: 'number', nullable: false},
        str: {type: 'string', nullable: false},
        num: {type: 'number'},
        b: {type: 'boolean'},
        idx1: {type: 'number'},
        idx21: {type: 'string'},
        idx22: {type: 'number'},
        obj: {type: 'object'},
        a: {type: 'array', items: {type: 'string'}}
      }
    },
    handler: function() {
    }
  },
  {
    name: 'tests',
    config: {
      key: ['testId'],
      indexes: [],
      schema: {
        testId: {type: 'number', nullable: false}
      }
    },
    handler: function() {
    }
  }
];

const testData = deepFreeze({
  simpletests: [
    {
      testId: 123,
      str: "Apple",
      num: 101,
      b: true,
      idx1: 1001,
      idx21: "abc",
      idx22: 1,
      obj: {a: 1, b: 2, c: 3},
      a: ["Hello", "World"]
    },
    {
      testId: 124,
      str: "Apple",
      num: 201,
      b: false,
      idx1: 1001,
      idx21: "def",
      idx22: 2,
      obj: {a: 2, b: 3, c: 4},
      a: ["Hello", "Universe"]
    },
    {
      testId: 125,
      str: "Cherry",
      num: 301,
      b: true,
      idx1: 1002,
      idx21: "def",
      idx22: 3,
      obj: {a: 3, b: 4, c: 5},
      a: ["Bye", "Bye"]
    }
  ],
  compositetests: [
    {
      testId: 123,
      str: "Apple",
      num: 101,
      b: true,
      idx1: 1001,
      idx21: "abc",
      idx22: 1,
      obj: {a: 1, b: 2, c: 3},
      a: ["Hello", "World"]
    },
    {
      testId: 124,
      str: "Apple",
      num: 201,
      b: false,
      idx1: 1001,
      idx21: "def",
      idx22: 2,
      obj: {a: 2, b: 3, c: 4},
      a: ["Hello", "Universe"]
    },
    {
      testId: 125,
      str: "Cherry",
      num: 301,
      b: true,
      idx1: 1002,
      idx21: "def",
      idx22: 3,
      obj: {a: 3, b: 4, c: 5},
      a: ["Bye", "Bye"]
    }
  ]
});

export function testSuite(storeFactory, mapperFactory) {
  testModel('simpletests', storeFactory, mapperFactory);
  testModel('compositetests', storeFactory, mapperFactory);
}

function testModel(model, storeFactory, mapperFactory) {
  const whereByPk = model === 'simpletests'
    ? {testId: 123} : {testId: 123, str: "Apple"};
  const whereByIndex = {idx1: 1002};
  const whereByNonPk = {num: 201};

  let store, mapper, caught;
  describe(`With no ${model} records`, function() {
    beforeEach(async function() {
      caught = null;
      store = await storeFactory({
        simpletests: [], compositetests: []
      });
      mapper = mapperFactory(store);
    });

    describe('When insert happy path', function() {
      const payload = deepFreeze({
        testId: 1001,
        str: "String",
        num: 111,
        b: true,
        idx1: 10001,
        idx21: "hello",
        idx22: 11,
        obj: {a: 1, b: 2, c: 3},
        a: ["Hello", "World"]
      });
      beforeEach(async function() {
        try {
          caught = null;
          await mapper.insert(model, payload);
        } catch (err) {
          caught = err;
        }
      });
      it('should not throw an error', function() {
        assert.equal(caught, null);
      });
      it('should have inserted a new record', async function() {
        const data = await store.get(model);
        assert.equal(data.length, 1);
        assert.deepStrictEqual(data[0], payload);
      });
    });

    describe('When insert with missing fields', function() {
      const payload = deepFreeze({
        str: "String",
        num: 111,
        b: true,
        idx1: 10002,
        idx22: 13,
        obj: {a: 1, b: 2, c: 3},
        a: ["Hello", "World"]
      });
      beforeEach(async function() {
        try {
          caught = null;
          await mapper.insert(model, payload);
        } catch (err) {
          caught = err;
        }
      });
      it('should throw an error', function() {
        assert.ok(caught instanceof Error);
        assert.equal(caught.message, `Invalid payload for model "${model}": "testId" field is missing, "idx21" field is missing.`);
      });
    });

    describe('When insert with fields with wrong type', function() {
      const payload = deepFreeze({
        testId: "1001",
        str: "test",
        num: 111,
        b: null,
        idx1: 123,
        idx21: "soup",
        idx22: 22,
        obj: {a: 1, b: 2, c: 3},
        a: ["Hello", "World"]
      });
      beforeEach(async function() {
        try {
          caught = null;
          await mapper.insert(model, payload);
        } catch (err) {
          caught = err;
        }
      });
      it('should throw an error', function() {
        assert.ok(caught instanceof Error);
        assert.equal(caught.message, `Invalid payload for model "${model}": "testId" expected type "number" got "string".`);
      });
    });

    describe('When update by pk', function() {
      const payload = deepFreeze({b: false});
      let count;
      beforeEach(async function() {
        try {
          caught = null;
          count = await mapper.update(model, payload, whereByPk);
        } catch (err) {
          caught = err;
        }
      });
      it('should not throw an error', function() {
        assert.equal(caught, null);
      });
      it('should return a count of 0', function() {
        assert.equal(count, 0);
      });
      it('should not insert a record', async function() {
        const data = await store.get(model);
        assert.equal(data.length, 0);
      });
    });

    describe('When update by non pk', function() {
      const payload = deepFreeze({b: false});
      let count;
      beforeEach(async function() {
        try {
          caught = null;
          count = await mapper.update(model, payload, whereByNonPk);
        } catch (err) {
          caught = err;
        }
      });
      it('should not throw an error', function() {
        assert.equal(caught, null);
      });
      it('should return a count of 0', function() {
        assert.equal(count, 0);
      });
      it('should not insert a record', async function() {
        const data = await store.get(model);
        assert.equal(data.length, 0);
      });
    });

    describe('When select all', function() {
      let results;
      beforeEach(async function() {
        try {
          caught = null;
          results = await mapper.select(model, {});
        } catch (err) {
          caught = err;
        }
      });
      it('should not throw an error', function() {
        assert.equal(caught, null);
      });
      it('should return empty results', function() {
        assert.equal(results.total, 0);
        assert.equal(results.results.length, 0);
      });
    });
  });

  describe(`With ${model} records`, function() {
    beforeEach(async function() {
      store = await storeFactory(testData);
      mapper = mapperFactory(store);
    });

    describe('When insert happy path', function() {
      const payload = deepFreeze({
        testId: 1001,
        str: "String",
        num: 111,
        b: true,
        idx1: 10002,
        idx21: "coconut",
        idx22: 2001,
        obj: {a: 1, b: 2, c: 3},
        a: ["Hello", "World"]
      });
      beforeEach(async function() {
        try {
          caught = null;
          await mapper.insert(model, payload);
        } catch (err) {
          caught = err;
        }
      });
      it('should not throw an error', function() {
        assert.equal(caught, null);
      });
      it('should have inserted a new record', async function() {
        const data = await store.get(model);
        assert.equal(data.length, testData[model].length + 1);
        assert.deepStrictEqual(data.find(x => x.testId === payload.testId), payload);
      });
    });

    describe('When insert existing', function() {
      const payload = deepFreeze({
        testId: 123,
        str: "Apple",
        num: 111,
        b: true,
        idx1: 1001,
        idx21: "happy",
        idx22: 101,
        obj: {a: 1, b: 2, c: 3},
        a: ["Hello", "World"]
      });
      beforeEach(async function() {
        try {
          caught = null;
          await mapper.insert(model, payload);
        } catch (err) {
          caught = err;
        }
      });
      it('should not throw an error', function() {
        assert.equal(caught, null);
      });
      it('should not insert a new record', async function() {
        const data = await store.get(model);
        assert.equal(data.length, testData[model].length);
      });
      it('should update existing record', async function() {
        const data = await store.get(model);
        assert.deepStrictEqual(data[0], payload);
      });
    });

    describe('When update by pk', function() {
      const payload = deepFreeze({b: false, num: 100});
      let count;
      beforeEach(async function() {
        try {
          caught = null;
          count = await mapper.update(model, payload, whereByPk);
        } catch (err) {
          caught = err;
        }
      });
      it('should not throw an error', function() {
        assert.equal(caught, null);
      });
      it('should return a count of 1', function() {
        assert.equal(count, 1);
      });
      it('should not insert a new record', async function() {
        const data = await store.get(model);
        assert.equal(data.length, testData[model].length);
      });
      it('should update existing record', async function() {
        const expected = Object.assign({}, testData[model][0], payload);
        const data = await store.get(model);
        assert.deepStrictEqual(data[0], expected);
      });
    });

    describe('When update pk field by pk', function() {
      const payload = deepFreeze({testId: 126, b: true});
      let count;
      beforeEach(async function() {
        try {
          caught = null;
          count = await mapper.update(model, payload, whereByPk);
        } catch (err) {
          caught = err;
        }
      });
      it('should not throw an error', function() {
        assert.equal(caught, null);
      });
      it('should return a count of 1', function() {
        assert.equal(count, 1);
      });
      it('should not insert a new record', async function() {
        const data = await store.get(model);
        assert.equal(data.length, testData[model].length);
      });
      it('should update existing record', async function() {
        const data = await store.get(model);
        const expected = Object.assign({}, testData[model][0], payload);
        assert.deepStrictEqual(data[2], expected);
      });
    });

    describe('When update pk field to existing by pk', function() {
      const payload = deepFreeze({testId: 124});
      beforeEach(async function() {
        try {
          caught = null;
          await mapper.update(model, payload, whereByPk);
        } catch (err) {
          caught = err;
        }
      });
      it('should throw an error', function() {
        assert.notEqual(caught, null);
      });
      it('should not insert a new record', async function() {
        const data = await store.get(model);
        assert.equal(data.length, testData[model].length);
      });
      it('should not update any existing record', async function() {
        const data = await store.get(model);
        for (let i = 0; i < testData[model].length; i++) {
          assert.deepStrictEqual(data[i], testData[model][i]);
        }
      });
    });

    describe('When update by non pk', function() {
      const payload = deepFreeze({b: false, num: 100});
      let count;
      beforeEach(async function() {
        try {
          caught = null;
          count = await mapper.update(model, payload, whereByNonPk);
        } catch (err) {
          caught = err;
        }
      });
      it('should not throw an error', function() {
        assert.equal(caught, null);
      });
      it('should return a count of 1', function() {
        assert.equal(count, 1);
      });
      it('should not insert a new record', async function() {
        const data = await store.get(model);
        assert.equal(data.length, testData[model].length);
      });
      it('should update existing record', async function() {
        const expected = Object.assign({}, testData[model][1], payload);
        const data = await store.get(model);
        assert.deepStrictEqual(data[1], expected);
      });
    });

    describe('When update pk field by non pk', function() {
      const payload = deepFreeze({testId: 126, num: 100});
      let count;
      beforeEach(async function() {
        try {
          caught = null;
          count = await mapper.update(model, payload, whereByNonPk);
        } catch (err) {
          caught = err;
        }
      });
      it('should not throw an error', function() {
        assert.equal(caught, null);
      });
      it('should return a count of 1', function() {
        assert.equal(count, 1);
      });
      it('should not insert a new record', async function() {
        const data = await store.get(model);
        assert.equal(data.length, testData[model].length);
      });
      it('should update existing record', async function() {
        const data = await store.get(model);
        const expected = Object.assign({}, testData[model][1], payload);
        assert.deepStrictEqual(data[2], expected);
      });
    });

    describe('When remove by pk', function() {
      let count;
      beforeEach(async function() {
        try {
          caught = null;
          count = await mapper.remove(model, whereByPk);
        } catch (e) {
          caught = e;
        }
      });
      it('should not throw an error', function() {
        assert.equal(caught, null);
      });
      it('should return a count of 1', function() {
        assert.equal(count, 1);
      });
      it('should have removed one record', async function() {
        const data = await store.get(model);
        assert.equal(data.length, testData[model].length - 1);
      });
      it('should have removed pk record', async function() {
        const data = await store.get(model);
        const recordsMatchingPk = filter(data, whereByPk);
        assert.equal(recordsMatchingPk.length, 0);
      });
    });

    describe('When remove by index', function() {
      let count;
      beforeEach(async function() {
        try {
          caught = null;
          count = await mapper.remove(model, whereByIndex);
        } catch (e) {
          caught = e;
        }
      });
      it('should not throw an error', function() {
        assert.equal(caught, null);
      });
      it('should return a count of 1', function() {
        assert.equal(count, 1);
      });
      it('should have removed one record', async function() {
        const data = await store.get(model);
        assert.equal(data.length, testData[model].length - 1);
      });
      it('should have removed index record', async function() {
        const data = await store.get(model);
        const recordsMatchingIndex = filter(data, whereByIndex);
        assert.equal(recordsMatchingIndex.length, 0);
      });
    });

    describe('When remove by non pk/index', function() {
      let count;
      beforeEach(async function() {
        try {
          caught = null;
          count = await mapper.remove(model, whereByNonPk);
        } catch (e) {
          caught = e;
        }
      });
      it('should not throw an error', function() {
        assert.equal(caught, null);
      });
      it('should return a count of 1', function() {
        assert.equal(count, 1);
      });
      it('should have removed one record', async function() {
        const data = await store.get(model);
        assert.equal(data.length, testData[model].length - 1);
      });
      it('should have removed non pk/index record', async function() {
        const data = await store.get(model);
        const recordsMatchingNonPkIndex = filter(data, whereByNonPk);
        assert.equal(recordsMatchingNonPkIndex.length, 0);
      });
    });

    const expectedData = deepClone(testData[model]);
    const reverseExpectedData = deepClone(testData[model]).reverse();

    testSelect('all', {}, expectedData);
    testSelect('skip', {skip: 1}, [expectedData[1], expectedData[2]]);
    testSelect('limit', {limit: 2}, [expectedData[0], expectedData[1]]);
    testSelect('skip & limit', {skip: 1, limit: 1}, [expectedData[1]]);
    testSelect('where by pk', {where: whereByPk}, [expectedData[0]]);
    testSelect('where by secondary index', {where: whereByIndex}, [expectedData[2]]);
    testSelect('where by non index', {where: whereByNonPk}, [expectedData[1]]);
    testSelect('ordering 1', {order: 'testId DESC'}, reverseExpectedData);
    testSelect('ordering 2', {order: ['b ASC', 'num DESC']}, [expectedData[1], expectedData[2], expectedData[0]]);
    testSelect('gt', {where: {testId: {gt: 123}}}, [expectedData[1], expectedData[2]]);
    testSelect('gte', {where: {testId: {gte: 124}}}, [expectedData[1], expectedData[2]]);
    testSelect('lt', {where: {testId: {lt: 125}}}, [expectedData[0], expectedData[1]]);
    testSelect('lte', {where: {testId: {lte: 124}}}, [expectedData[0], expectedData[1]]);
    testSelect('inq', {where: {testId: {inq: [123, 125]}}}, [expectedData[0], expectedData[2]]);
    testSelect('between', {where: {testId: {between: [123, 124]}}}, [expectedData[0], expectedData[1]]);
    testSelect('ilike', {where: {str: {ilike: '%app%'}}}, [expectedData[0], expectedData[1]]);
    testSelect('neq', {where: {testId: {neq: 124}}}, [expectedData[0], expectedData[2]]);
    testSelect('and', {where: {and: [{b: true}, {num: 101}]}}, [expectedData[0]]);
    testSelect('or', {where: {or: [{testId: 123}, {testId: 125}]}}, [expectedData[0], expectedData[2]]);
  });

  function testSelect(contextDesc, filter, expected) {
    describe('When select ' + contextDesc, function() {
      let results;
      beforeEach(async function() {
        try {
          caught = null;
          results = await mapper.select(model, filter);
        } catch (err) {
          caught = err;
        }
      });
      it('should not throw an error', function() {
        assert.equal(caught, null);
      });
      it('should return expected total', function() {
        assert.equal(results.total, (filter.skip || filter.limit) ? testData[model].length : expected.length);
      });
      it('should return expected results', function() {
        assert.equal(results.results.length, expected.length);
        for (let i = 0; i < expected.length; i++) {
          assert.deepStrictEqual(results.results[i], expected[i]);
        }
      });
    });
  }
}
