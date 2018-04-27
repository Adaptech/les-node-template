import {Connection, EventStoreImpl} from "../../src/infra/memes";
import {loadEventsMap} from "../../src/infra/initWrite";
import commandHandlerFactory from "../../src/infra/commandHandler";
import NoOpLogger from "../../src/infra/NoOpLogger";
import ReadRepository from "../../src/infra/ReadRepository";
import inMemoryStorageBootstrap from "../../src/infra/memdb/bootstrap";
import {loadReadModels} from "../../src/infra/initRead";
import Subscriber from "../../src/infra/Subscriber";
import createBuilder from "../../src/infra/builder";
import createDefaultEventFactory from "../../src/infra/defaultEventFactory";
import {AggregateCache} from "../../src/infra/aggregateCache";
import {SnapshotStore} from "../../src/infra/snapshot";
import TransactionalRepository from "../../src/infra/TransactionalRepository";
import ModelDefinition from "../../src/infra/ModelDefinition";

const DEFAULT_BATCH_SIZE = 1024;

export default async function setUp({eventsMap, readModels} = {}) {
  const logger = new NoOpLogger();
  const esConnection = new Connection(logger);
  const eventStore = new EventStoreImpl(esConnection, DEFAULT_BATCH_SIZE);
  eventsMap = eventsMap || loadEventsMap(logger);
  const esConfig = {};
  const eventFactory = createDefaultEventFactory(eventsMap);
  const aggregateCache = new AggregateCache();
  const snapshotStore = new SnapshotStore();
  const commandHandler = commandHandlerFactory({}, eventFactory, eventStore, aggregateCache, snapshotStore);
  const readEvents = async(streamName, start = 0, count = DEFAULT_BATCH_SIZE) => {
    const result = await esConnection.readStreamEventsForward(streamName, start, count, true);
    return result.map(ev => {
      const Cls = eventsMap[ev.event.eventType];
      const obj = JSON.parse(ev.event.data);
      obj.__proto__ = Cls.prototype;
      return obj;
    });
  };
  readModels = readModels || loadReadModels(logger);
  // Add read repository
  const modelDefs = readModels.map(x => ModelDefinition.fromReadModel(x));
  const services = {modelDefs, logger};
  await inMemoryStorageBootstrap(services);
  const {mapper, changeProxyFactory} = services;
  const readRepository = new ReadRepository(mapper, logger);
  // Add read model subscription
  const updateLastCheckPoint = function() {};
  const transactionalRepositoryFactory = (modelName, trx) => new TransactionalRepository(mapper, modelName, readRepository, trx, changeProxyFactory, logger);
  const subscriber = new Subscriber(eventStore, updateLastCheckPoint, null, logger);
  const builderInstance = createBuilder({esConnection, readRepository, transactionalRepositoryFactory, config: {eventStore: esConfig}, logger}, eventStore);
  subscriber.addHandler(esData => builderInstance.processEvent(readModels, esData));
  await subscriber.startFrom(null);

  function given(readModelName, data) {
    return mapper.insert(readModelName, data);
  }

  return {
    commandHandler,
    readRepository,
    readEvents,
    given
  };
}
