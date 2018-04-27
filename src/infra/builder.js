import Long from "long";
import Transaction from "./Transaction";

/**
 * @param {!Buffer} buf
 * @returns {object|null}
 */
function safeParseData(buf) {
  try {
    return JSON.parse(buf.toString());
  } catch (e) {
    return null;
  }
}

/**
 * @param {!string} esEventType
 * @param {string} prefix
 * @returns {string}
 */
function getLocalEventType(esEventType, prefix) {
  if (!prefix) {
    return esEventType;
  }
  if (esEventType.indexOf(prefix) === 0) {
    return esEventType.substr(prefix.length);
  }
  return esEventType;
}

/**
 * @class BuilderEventData
 * @property {string} eventId
 * @property {string} typeId
 * @property {object} event
 * @property {object} metadata
 * @property {number} creationTime
 * @property {EventStorePosition} position
 */
class BuilderEventData {
  /**
   * @param {string} eventId
   * @param {string} typeId
   * @param {object} event
   * @param {object} metadata
   * @param {number} creationTime
   * @param {EventStorePosition} position
   */
  constructor(eventId, typeId, event, metadata, creationTime, position) {
    this.eventId = eventId;
    this.typeId = typeId;
    this.event = event;
    this.metadata = metadata;
    this.creationTime = creationTime;
    this.position = position;
  }
}

/**
 * @param {!EventStoreData} esData
 * @returns {BuilderEventData}
 */
function toEventData(esData) {
  const {
    position,
    eventId,
    createdEpoch,
    eventType,
    data,
    metadata
  } = esData;
  return new BuilderEventData(
    eventId,
    eventType,
    safeParseData(data),
    safeParseData(metadata),
    createdEpoch,
    position
  );
}

/**
 * Process a ResolvedEvent for a set of readModels
 * @param {ReadRepository} readRepository
 * @param {TransactionalRepositoryFactory} transactionalRepositoryFactory
 * @param {string} prefix
 * @param {ConsoleLogger} logger
 * @param {ReadModel[]} readModels
 * @param {EventStoreData} esData
 * @returns {Promise<void>}
 */
async function processEvent(readRepository, transactionalRepositoryFactory, prefix, logger, readModels, esData) {
  if (esData.streamId[0] === '$') {
    return;
  }
  for (const readModel of readModels) {
    try {
      const eventData = toEventData(esData);
      eventData.typeId = getLocalEventType(eventData.typeId, prefix);
      const trx = new Transaction();
      const repository = transactionalRepositoryFactory(readModel.name, trx);
      const lookups = {};
      for (const k in readModel.lookups) {
        lookups[k] = transactionalRepositoryFactory(`${readModel.name}_${k}_lookup`, trx);
      }
      await readModel.handler(repository, eventData, lookups);
      await trx.commit();
    } catch (err) {
      logger.error("readModel handler failed (", `readModel=${readModel.name}`,
        `eventType=${esData.eventType}`,
        `logPos=${esData.eventNumber}@${esData.streamId}`,
        `)\n`, err);
    }
  }
}

/**
 * Rebuild a set of readModels from $all
 * @async
 * @param {EventStore} eventStore
 * @param {ReadRepository} readRepository
 * @param {TransactionalRepositoryFactory} repositoryFactory
 * @param {!string} prefix
 * @param {ConsoleLogger} logger
 * @param {ReadModel[]} readModels
 * @param {EventStorePosition} startPosition
 * @returns {Promise<EventStorePosition>}
 */
async function rebuildFromAllStream(eventStore, readRepository, repositoryFactory, prefix, logger, readModels, startPosition) {
  const batchSize = 250;
  let position = startPosition || null, readResult;
  do {
    readResult = await eventStore.readAllBatch(position, batchSize);
    position = readResult.nextPosition;
    for (const esData of readResult.events) {
      await processEvent(readRepository, repositoryFactory, prefix, logger, readModels, esData);
    }
  } while (!readResult.isEndOfStream);
  return position;
}

/**
 * @callback TransactionalRepositoryFactory
 * @param {string} modelName
 * @param {Transaction} Transaction
 * @return {TransactionalRepository}
 */

/**
 * Rebuild a set of readModels from $all
 * @async
 * @param {EventStore} eventStore
 * @param {ReadRepository} readRepository
 * @param {TransactionalRepositoryFactory} repositoryFactory
 * @param {!string} prefix
 * @param {ConsoleLogger} logger
 * @param {!string} streamName
 * @param {ReadModel[]} readModels
 * @param {Long} fromEventNumber
 * @returns {Promise<Long>}
 */
async function rebuildFromStream(eventStore, readRepository, repositoryFactory, prefix, logger, streamName, readModels, fromEventNumber) {
  const batchSize = 250;
  let eventNumber = Long.fromValue(fromEventNumber || 0), readResult;
  do {
    readResult = await eventStore.readBatch(streamName, eventNumber, batchSize);
    eventNumber = readResult.nextEventNumber;
    for (const esData of readResult.events) {
      await processEvent(readRepository, repositoryFactory, prefix, logger, readModels, esData);
    }
  } while (!readResult.isEndOfStream);
  return eventNumber;
}

/**
 * @class
 */
class Builder {
  constructor(eventStore, readRepository, transactionalRepositoryFactory, prefix, logger) {
    this._eventStore = eventStore;
    this._readRepository = readRepository;
    this._transactionalRepositoryFactory = transactionalRepositoryFactory;
    this._prefix = prefix;
    this._logger = logger;
  }

  /**
   * @param {ReadModel[]} readModels
   * @param {EventStoreData} esData
   * @return {Promise<void>}
   */
  processEvent(readModels, esData) {
    return processEvent(this._readRepository, this._transactionalRepositoryFactory, this._prefix, this._logger, readModels, esData);
  }

  /**
   * @param {string} streamName
   * @param {ReadModel[]} readModels
   * @param {number} fromEventNumber
   * @return {Promise<Long>} nextEventNumber
   */
  rebuildFromStream(streamName, readModels, fromEventNumber) {
    return rebuildFromStream(this._eventStore, this._readRepository, this._transactionalRepositoryFactory, this._prefix, this._logger, streamName, readModels, fromEventNumber);
  }

  /**
   * @param {ReadModel[]} readModels
   * @param {EventStorePosition} fromPosition
   * @return {Promise<EventStorePosition>} nextPosition
   */
  rebuildFromAllStream(readModels, fromPosition) {
    return rebuildFromAllStream(this._eventStore, this._readRepository, this._transactionalRepositoryFactory, this._prefix, this._logger, readModels, fromPosition);
  }

  /**
   * @param {EventStoreData} esData
   * @return {BuilderEventData}
   */
  toEventData(esData) {
    return toEventData(esData);
  }

  /**
   * @param {string} esEventType
   * @return {string}
   */
  getLocalEventType(esEventType) {
    return getLocalEventType(esEventType, this._prefix);
  }
}

/**
 * Builder Factory
 * @param {object} services
 * @param {EventStore} eventStore
 * @returns {Builder}
 */
export function factory(services, eventStore) {
  const {readRepository, transactionalRepositoryFactory, config: {eventStore: {namespace}}, logger} = services;
  const prefix = namespace ? `${namespace}.` : '';
  return new Builder(eventStore, readRepository, transactionalRepositoryFactory, prefix, logger);
}

export default factory;
