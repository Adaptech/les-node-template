/**
 * @interface
 */
export class EventStore {
  /**
   * @param {string} streamName
   * @param {number} [start]
   * @param {{username, password}} [credentials]
   * @returns {Promise<EventStoreData[]>}
   */
  read(streamName, start, credentials) {
    throw new Error("Not implemented");
  }

  /**
   * @param {string} streamName
   * @param {number} start
   * @param {number} count
   * @param {{username, password}} [credentials]
   * @return {Promise<{isEndOfStream,nextEventNumber,events}>}
   */
  readBatch(streamName, start, count, credentials) {
    throw new Error("Not Implemented");
  }

  /**
   * @param {EventStorePosition} position
   * @param {number} count
   * @param {{username, password}} [credentials]
   * @return {Promise<{isEndOfStream,nextPosition,events}>}
   */
  readAllBatch(position, count, credentials) {
    throw new Error("Not implemented");
  }

  /**
   * @param {string} streamName
   * @param {object[]} events
   * @param {number} [expectedVersion]
   * @param {object} [metadata]
   * @param {{username, password}} [credentials]
   * @returns {Promise<number>}
   */
  save(streamName, events, expectedVersion, metadata, credentials) {
    throw new Error("Not implemented");
  }

  /**
   * Create a position
   * Returns start position if no arguments
   * @param {Long|number|Position} [pos]
   * @returns {EventStorePosition}
   */
  createPosition(pos) {
    throw new Error("Not implemented");
  }

  /**
   * @param {Position|null} lastCheckPoint
   * @param {EventStore~onEventAppeared} onEventAppeared
   * @param {EventStore~onLiveProcessingStarted} liveProcessingStarted
   * @param {EventStore~onSubscriptionDropped} subscriptionDropped
   * @param {{username, password}} credentials
   * @param {number} batchSize
   * @return {Subscription}
   */
  subscribeToAllFrom(lastCheckPoint, onEventAppeared, liveProcessingStarted, subscriptionDropped, credentials, batchSize) {
    throw new Error("Not implemented");
  }
}

/**
 * @callback EventStore~onEventAppeared
 * @param {EventStoreData} event
 * @returns {Promise|*}
 */

/**
 * @callback EventStore~onSubscriptionDropped
 * @param {EventStore} eventStore
 * @param {string} reason
 * @param {Error} error
 */

/**
 * @callback EventStore~onLiveProcessingStarted
 */

/**
 * @interface
 */
export class EventStorePosition {
  /**
   * @param {EventStorePosition} other
   * @returns {number}
   */
  compareTo(other) {
    throw new Error("Not implemented");
  }
}

export class EventStoreData {
  /**
   * @param {EventStorePosition} position
   * @param {string} eventId
   * @param {string} streamId
   * @param {number} eventNumber
   * @param {number} createdEpoch
   * @param {string} eventType
   * @param {Buffer} data
   * @param {Buffer} metadata
   */
  constructor(position, eventId, streamId, eventNumber, createdEpoch, eventType, data, metadata) {
    this.position = position;
    this.eventId = eventId;
    this.streamId = streamId;
    this.eventNumber = eventNumber;
    this.createdEpoch = createdEpoch;
    this.eventType = eventType;
    this.data = data;
    this.metadata = metadata;
  }
}

/**
 * @interface
 */
export class Subscription {
  stop() {
    throw new Error("Not implemented");
  }
}

export default EventStore;