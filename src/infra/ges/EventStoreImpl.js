import uuid from "uuid";
import esClient, {Position, UserCredentials} from "node-eventstore-client";
import {EventStoreData, EventStore, EventStorePosition} from "../EventStore";

/**
 * @callback EventFactory
 * @param {string} eventType
 * @param {string} json
 * @returns {object}
 */
export default class EventStoreImpl extends EventStore {
  /**
   * @param {EventStoreNodeConnection} conn
   * @param {number} readBatchSize
   * @param {string} namespace
   */
  constructor(conn, readBatchSize, namespace) {
    super();
    this.conn = conn;
    this.readBatchSize = readBatchSize;
    this.prefix = namespace ? `${namespace}.` : "";
  }

  /**
   * @param {string} streamName
   * @param {number} [start]
   * @param {{username, password}} [credentials]
   * @returns {Promise<EventStoreData[]>}
   */
  async read(streamName, start = 0, credentials) {
    const creds = credentials ? new UserCredentials(credentials.username, credentials.password) : null;
    /** @type {ResolvedEvent[]} */
    const events = [];
    /** @type {StreamEventsSlice} */
    let result;
    do {
      result = await this.conn.readStreamEventsForward(streamName, start, this.readBatchSize, true, creds);
      events.push(...result.events);
    } while (!result.isEndOfStream);
    return events.map(ev => toEventData(ev.event, ev.originalPosition, this.prefix));
  }

  /**
   * @param {string} streamName
   * @param {number} start
   * @param {number} count
   * @param {{username, password}} [credentials]
   * @return {Promise<{isEndOfStream,nextEventNumber,events}>}
   */
  async readBatch(streamName, start, count, credentials) {
    const creds = credentials ? new UserCredentials(credentials.username, credentials.password) : null;
    const result = await this.conn.readStreamEventsForward(streamName, start, count, true, creds);
    return {
      isEndOfStream: result.isEndOfStream,
      nextEventNumber: result.nextEventNumber,
      events: result.events.map(ev => toEventData(ev.event, ev.originalPosition, this.prefix))
    };
  }

  /**
   * @param {EventStorePosition} position
   * @param {number} count
   * @param {{username, password}} [credentials]
   * @return {Promise<{isEndOfStream,nextPosition,events}>}
   */
  async readAllBatch(position, count, credentials) {
    const creds = credentials ? new UserCredentials(credentials.username, credentials.password) : null;
    const result = await this.conn.readAllEventsForward(position, count, false, creds);
    return {
      isEndOfStream: result.isEndOfStream,
      nextPosition: result.nextPosition,
      events: result.events.map(ev => toEventData(ev.event, ev.originalPosition, this.prefix))
    };
  }

  /**
   * @param {string} streamName
   * @param {object[]} events
   * @param {number} [expectedVersion]
   * @param {object} [metadata]
   * @param {{username, password}} [credentials]
   * @returns {Promise<number>}
   */
  async save(streamName, events, expectedVersion = esClient.expectedVersion.any, metadata = null, credentials) {
    const toAppend = events.map(ev => esClient.createJsonEventData(uuid.v4(), ev, metadata, `${this.prefix}${ev.constructor.name}`));
    const creds = credentials ? new UserCredentials(credentials.username, credentials.password) : null;
    return this.conn.appendToStream(streamName, expectedVersion, toAppend, creds);
  }

  /**
   * Create a position
   * Returns start position if no arguments
   * @param {Long|number|Position} [pos]
   * @returns {EventStorePosition}
   */
  createPosition(pos) {
    if (!pos) {
      return esClient.positions.start;
    }
    if (pos instanceof Position || typeof pos === "object") {
      return new Position(pos.preparePosition, pos.commitPosition);
    }
    throw new Error("Invalid position");
  }

  /**
   * @param {Position|null} lastCheckPoint
   * @param {EventStore~onEventAppeared} onEventAppeared
   * @param {EventStore~onLiveProcessingStarted} onLiveProcessingStarted
   * @param {EventStore~onSubscriptionDropped} onSubscriptionDropped
   * @param {{username, password}} credentials
   * @param {number} batchSize
   * @return {Subscription}
   */
  subscribeToAllFrom(lastCheckPoint, onEventAppeared, onLiveProcessingStarted, onSubscriptionDropped, credentials, batchSize) {
    const creds = credentials ? new UserCredentials(credentials.username, credentials.password) : null;
    return this.conn.subscribeToAllFrom(lastCheckPoint, false,
      (s, ev) => onEventAppeared(toEventData(ev.originalEvent, ev.originalPosition, this.prefix)),
      onLiveProcessingStarted,
      (c, r, e) => onSubscriptionDropped(this, r, e),
      creds,
      batchSize
    );
  }
}

/**
 * @param {RecordedEvent} ev
 * @param {EventStorePosition} position
 * @param {string} prefix
 * @returns {EventStoreData}
 */
function toEventData(ev, position, prefix) {
  let eventType = ev.eventType;
  if (eventType.indexOf(prefix) === 0) {
    eventType = eventType.substr(prefix.length);
  }
  return new EventStoreData(position, ev.eventId, ev.eventStreamId, ev.eventNumber.toNumber(), ev.createdEpoch, eventType, ev.data, ev.metadata);
}
