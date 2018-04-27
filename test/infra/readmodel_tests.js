import assert from "assert";
import uuid from "uuid";
import setUp from "../setUp/setUpReadModelTests";

class MyEvent {
  constructor(id, text) {
    this.id = id;
    this.text = text;
  }
}

const myModel = {
  name: "myModel",
  config: {
    key: "id",
    schema: {
      id: {type: "string", nullable: false},
      text: {type: "string"}
    }
  },
  handler: function(repo, eventData) {
    const {typeId, event} = eventData;
    if (typeId === 'MyEvent') {
      const {id, text} = event;
      repo.create({id, text});
    }
    return repo;
  }
};

class ParentCreated {
  constructor(id, data) {
    this.id = id;
    this.data = data;
  }
}

class ChildCreated {
  constructor(id, parentId, data) {
    this.id = id;
    this.parentId = parentId;
    this.data = data;
  }
}

const complexModel = {
  name: "complexModel",
  config: {
    key: "id",
    indexes: ["parentId"],
    schema: {
      id: {type: "string", nullable: false},
      parentId: {type: "string"},
      data: {type: "string"},
      dataFromParent: {type: "string"}
    }
  },
  lookups: {
    parent: {
      key: "parentId",
      schema: {
        parentId: {type: "string", nullable: false},
        data: {type: "string"}
      }
    }
  },
  handler: async function(objectRepo, eventData, lookups) {
    const parentLookup = lookups.parent;
    const {typeId, event} = eventData;
    switch (typeId) {
      case 'ParentCreated': {
        const {id: parentId, data} = event;
        parentLookup.create({parentId, data});
        break;
      }
      case 'ChildCreated': {
        const {id, parentId, data} = event;
        const {data: dataFromParent} = await parentLookup.findOne({parentId});
        objectRepo.create({id, parentId, data, dataFromParent});
        break;
      }
    }
    return objectRepo;
  }
};

describe("Read models", () => {
  describe("Simple model tests", () => {
    let results;
    setUp({
      readModels: {myModel},
      events: [
        new MyEvent(uuid.v4(), "Hello World!")
      ],
      resultsSetter: x => results = x
    });

    it("Should have a record", () => {
      assert.equal(results.length, 1);
    });
  });

  describe("Complex model tests", () => {
    let results;
    setUp({
      readModels: {complexModel},
      events: [
        new ParentCreated("1001", "parentData"),
        new ChildCreated("2001", "1001", "childData")
      ],
      resultsSetter: x => results = x
    });

    it("Should have a record", () => {
      assert.equal(results.length, 1);
      assert.deepStrictEqual(results[0], {id: "2001", parentId: "1001", data: "childData", dataFromParent: "parentData"});
    });
  });
});
