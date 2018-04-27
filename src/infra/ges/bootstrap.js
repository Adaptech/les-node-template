import esClient from "node-eventstore-client";
import { connectTo } from "./utils";
import StreamReader from "../StreamReader";
import EventStoreImpl from "./EventStoreImpl";
import Subscriber from "../Subscriber";

const DEFAULT_READ_BATCH_SIZE = 1024;

export default async function(services) {
  const { logger, config: { eventStore: esConfig } } = services;
  if (!logger) {
    throw new Error('Missing logger in services registry.');
  }
  if (!esConfig) {
    throw new Error('Missing "eventStore" section in config.');
  }
  const { credentials, namespace } = esConfig;
  let { readBatchSize } = esConfig;
  readBatchSize = readBatchSize || DEFAULT_READ_BATCH_SIZE;
  const settings = Object.assign({ log: logger }, esConfig.settings);
  const esConnection = esClient.createConnection(settings, esConfig.endPoint);
  const eventStoreFactory = () => new EventStoreImpl(esConnection, readBatchSize, namespace);
  const eventStore = eventStoreFactory();
  services.eventStoreFactory = eventStoreFactory;
  services.esStreamReaderFactory = (streamName, startForm, batchSize) => new StreamReader(eventStore, streamName, startForm, credentials, batchSize);
  services.subscriberFactory = (eventStore, updateLastCheckPoint) => new Subscriber(eventStore, updateLastCheckPoint, credentials, logger);
  services.eventStore = eventStore;

  await connectTo(esConnection, "", logger);
  esConnection.on('closed', () => {
    logger.info("Connection to GES lost. Terminating this process.");
    //TODO: clean shutdown
    process.exit(-1);
  });
}
