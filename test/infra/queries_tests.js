import {Where} from "../../src/infra/queries";
import assert from "assert";

const whereEq = {"pk":{"eq":"123"}};
const whereShortEq = {"pk":"123"};
const whereBetween = {"pk":{"between":[1,10]}};
const whereInq = {"pk":{"inq":[2,5,7]}};
const whereOr = {"or":[{"pk":123},{"pk":456}]};
const whereAnd = {"and":[{"pk":{"lt":123}},{"other":"value"}]};
const whereMixedOrAnd = {"and":[{"firstname":"mike"},{"or":[{"lastname":"smith"},{"creditscore":{"gt":700}}]}]};

const where$Eq = {"pk":{"$eq":"123"}};
const whereShort$Eq = {"pk":"123"};
const where$Or = {"$or":[{"pk":123},{"pk":456}]};
const where$And = {"$and":[{"pk":{"$lt":123}},{"other":"value"}]};
const whereMixed$Or$And = {"$and":[{"firstname":"mike"},{"$or":[{"lastname":"smith"},{"creditscore":{"$gt":700}}]}]};

const testData = [
  whereEq, whereShortEq, whereBetween, whereInq, whereOr, whereAnd, whereMixedOrAnd,
  where$Eq, whereShort$Eq, where$Or, where$And, whereMixed$Or$And,
];

describe("Where", function() {
  context("When short form eq", function() {
    const $where = new Where({"abc":123});
    it("should be converted to long form", function() {
      const node = $where.rootNode();
      assert.deepStrictEqual(node, {"abc":{"eq":123}});
    });
  });
  context("When using $operator", function() {
    const $where = new Where({"def":{"$lt":456}});
    it("should be converted to operator (without $)", function() {
      const node = $where.rootNode();
      assert.deepStrictEqual(node, {"def":{"lt":456}});
    });
  });
  for (const where of testData) {
    let $where, caught = null;
    context("When new(" + JSON.stringify(where) + ")", function() {
      beforeEach(function() {
        try {
          $where = new Where(where);
        } catch (e) {
          caught = e;
        }
      });
      it("should not throw an error", function() {
        assert.strictEqual(caught, null);
      });
      it("should not be null or empty", function() {
        assert.strictEqual($where.isEmptyOrNull(), false);
      });
    });
  }
});
