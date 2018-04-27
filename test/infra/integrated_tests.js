import assert from "assert";
import setUp from "../setUp/setUpIntegratedTests";
import {buildAggregate, handlerFor} from "../../src/infra/aggregate";

class MyEvent {}
class MyCommand {}
const MyAggregate = buildAggregate("MyAggregate", [
  handlerFor(MyCommand, function(state, command) {
    if (state.loaded) throw new Error("Already loaded");
    return [new MyEvent()];
  })
], [
  handlerFor(MyEvent, function(state, event) {
    return {...state, loaded: true};
  })
]);

const helloWorlds = {
  name: "helloWorlds",
  config: {
    key: "testId",
    schema: {
      testId: {type: "number", nullable: false},
      text: {type: "string"}
    }
  },
  handler: function(helloWorlds, eventData) {
    const {typeId, event} = eventData;
    if (typeId === 'MyEvent') {
      helloWorlds.create({testId: 2, text: "Hello World 2"});
    }
  }
};

describe("Integrated Tests", () => {
  let test;
  beforeEach(async() => {
    test = await setUp({
      readModels: [helloWorlds],
      eventsMap: {
        MyEvent
      }
    });
  });

  it("given adds a read model", async() => {
    await test.given("helloWorlds", {testId: 123, text: "Hello World!"});
    const results = await test.readRepository.findAll("helloWorlds");
    assert.equal(results.length, 1);
    assert.equal(results[0].testId, 123);
  });

  it("commandHandler adds a read model", async() => {
    const myCommand = new MyCommand();
    await test.commandHandler(MyAggregate, "123", myCommand);
    const results = await test.readRepository.findAll("helloWorlds");
    assert.equal(results.length, 1);
    assert.equal(results[0].testId, 2);
  });
});
