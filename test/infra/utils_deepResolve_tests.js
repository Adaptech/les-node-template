import assert from "assert";
import {deepResolve} from "../../src/infra/utils";

describe("deepResolve", function() {

  context("with thenables", function() {
    const aValue = '123';
    const anObject = {a:'1',b:2,c:false};
    const original = {
      a: (async() => aValue)(),
      b: (async() => anObject)()
    };
    let resolved;
    beforeEach(async function() {
      resolved = await deepResolve(original);
    });
    it("should have resolved value", function() {
      assert.equal(resolved.a, aValue);
    });
    it("should have resolved reference", function() {
      assert.deepStrictEqual(resolved.b, anObject);
      assert.notEqual(resolved.b, anObject);
    });
  });

  context("without thenables", function() {
    const original = {
      a: 1,
      b: "2",
      c: true,
      d: new Date(2017,8,1),
      e: new RegExp(/^abc$/),
      f: Number(6),
      g: String("7"),
      h: Boolean(false),
      i: [1,2,{"abc":123}],
      j: {"def":456}
    };
    let resolved;
    beforeEach(async function() {
      resolved = await deepResolve(original);
    });
    it("should have equal values", function() {
      assert.deepStrictEqual(resolved, original);
    });
    it("should not have same refs", function() {
      assert.notEqual(resolved.d, original.d);
      assert.notEqual(resolved.e, original.e);
      assert.notEqual(resolved.i, original.i);
      assert.notEqual(resolved.j, original.j);
    });
  });

});