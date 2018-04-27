import assert from "assert";
import {filter} from "../../src/infra/utils";

function testFilter(where, list, expectedResultIndexes) {
  const rows = list.map(x => Object.freeze(x));
  describe('where ' + JSON.stringify(where), function() {
    const results = filter(rows, where);
    it(`should return ${expectedResultIndexes.length} results`, function() {
      assert.strictEqual(results.length, expectedResultIndexes.length);
    });
    expectedResultIndexes.forEach((expectedIndex, index) => {
      it(`should have item ${expectedIndex} in results`, function() {
        assert.strictEqual(results[index], rows[expectedIndex]);
      });
    });
  });
}

/*
where={
    $and:[
        $or:[{firstName: 'Roger', lastName: 'Roger', phone: 'Roger'}],
        $or:[{firstName: 'Bob', lastName: 'Bob', phone: 'Bob']
    ]
}
 */

function testSearch(fields, values, list, expectedResultIndexes) {
  const where = {
    $and: values.map(value => {
      return {
        $or: fields.map(field => {
          const constraint = {};
          constraint[field] = {$ilike: `%${value}%`};
          return constraint;
        })
      };
    })
  };
  return testFilter(where, list, expectedResultIndexes);
}

describe('Filter', () => {
  const items = [
    {firstName: 'Roger', lastName: 'Bob', n: 1, phone: '5556041234'},
    {firstName: 'Bob', lastName: 'Roger', n: 2, phone: '5556052255'},
    {firstName: 'Roger', lastName: 'Roger', n: 3, phone: '5556011122'},
    {firstName: 'Bob', lastName: 'Bob', n: 4, phone: '5556078866'},
  ];
    // EQ
  testFilter({firstName: 'Roger'}, items, [0,2]);
  testFilter({firstName: {$eq: 'Roger'}}, items, [0,2]);
  // NEQ
  testFilter({firstName: {$neq: 'Roger'}}, items, [1,3]);
  // LT
  testFilter({n: {$lt: 3}}, items, [0,1]);
  // LTE
  testFilter({n: {$lte: 3}}, items, [0,1,2]);
  // GT
  testFilter({n: {$gt: 2}}, items, [2,3]);
  // GTE
  testFilter({n: {$gte: 2}}, items, [1,2,3]);
  // BETWEEN
  testFilter({n: {$between: [1,3]}}, items, [0,1,2]);
  // IN
  testFilter({n: {$inq: [1,3]}}, items, [0,2]);
  // AND
  testFilter({firstName: 'Roger', lastName: 'Bob'}, items, [0]);
  testFilter({$and: [{firstName: 'Roger'}, {lastName: 'Bob'}]}, items, [0]);
  // OR
  testFilter({$or: [{firstName: 'Bob'}, {n: 1}]}, items, [0,1,3]);
  // ILIKE
  testFilter({firstName: {$ilike: '%roger%'}}, items, [0,2]);
  // SEARCH
  testSearch(['firstName', 'lastName', 'phone'], ['roger', 'bob'], items, [0,1]);
});