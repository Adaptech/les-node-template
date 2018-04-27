import StreamReader from "../StreamReader";
import {Connection, EventStoreImpl} from "./index";
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
  const esConnection = new Connection(logger);
  const eventStoreFactory = () => new EventStoreImpl(esConnection, esConfig.readBatchSize || DEFAULT_READ_BATCH_SIZE);
  const eventStore = eventStoreFactory();
  services.eventStoreFactory = eventStoreFactory;
  services.esStreamReaderFactory = (streamName, startFrom, batchSize) => new StreamReader(eventStore, streamName, startFrom, null, batchSize);
  services.subscriberFactory = (eventStore, updateLastCheckPoint) => new Subscriber(eventStore, updateLastCheckPoint, null, logger);
  services.eventStore = eventStore;
}
