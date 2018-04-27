import {defer} from "../utils";
import uuid from "uuid";
import {EventStoreData, EventStore, EventStorePosition} from "../EventStore";
import {UserCredentials} from "node-eventstore-client/index";

export class WrongExpectedVersionError extends Error {
  constructor(message) {
    super();
    this.name = WrongExpectedVersionError.name;
    this.message = message;
    Error.captureStackTrace(this, WrongExpectedVersionError);
  }
}

export class PositionImpl extends EventStorePosition {
  constructor(value) {
    super();
    this.value = value;
    Object.freeze(this);
  }

  /**
   * @param {EventStorePosition} that
   * @return {number}
   */
  compareTo(that) {
    return this.value - that.value;
  }

  toString() {
    return ""+this.value;
  }
}

class RecordedEvent {}

class ResolvedEvent {
  constructor(position, eventId, eventStreamId, eventNumber, data, metadata, eventType) {
    this.event = Object.freeze({ position, eventId, eventStreamId, eventNumber, data, metadata, eventType, createdEpoch: Date.now() });
    this.link = null;
    Object.freeze(this);
  }
  get originalEvent() {
    return this.event;
  }
  get originalPosition() {
    return this.event.position;
  }
  get originalStreamId() {
    return this.event.streamId;
  }
  get originalEventNumber() {
    return this.event.eventNumber;
  }
}

export class Connection {
  constructor(logger) {
    this._all = [];
    this._streams = {};
    this._q = [];
    this._subscriptions = {};
    this._logger = logger;
  }

  readStreamEventsForward(streamName, start, count, resolveLinkTos) {
    const d = defer();
    this._q.push([this._readStreamEventsForward, d, streamName, start, count, resolveLinkTos]);
    setImmediate(() => this._processQueue());
    return d.promise;
  }
  async _readStreamEventsForward(streamName, start, count, resolveLinkTos) {
    const stream = this._streams[streamName] || [];
    const events = stream.slice(start, start + count);
    const nextEventNumber = start + events.length;
    const result = {
      status: 'success',
      stream: streamName,
      fromEventNumber: start,
      readDirection: 'forward',
      events,
      nextEventNumber,
      lastEventNumber: stream.length - 1,
      isEndOfStream: nextEventNumber >= stream.length
    };
    this._logger.debug('readStreamEventsForward', arguments, result);
    return result;
  }
  appendToStream(streamName, expectedVersion, events) {
    const d = defer();
    this._q.push([this._appendToStream, d, streamName, expectedVersion, events]);
    setImmediate(() => this._processQueue());
    return d.promise;
  }
  async _appendToStream(streamName, expectedVersion, events) {
    let stream = this._streams[streamName];
    const streamVersion = stream ? stream.length - 1 : -1;
    if (expectedVersion >= -1 && streamVersion !== expectedVersion) {
      throw new WrongExpectedVersionError(`Expecting ${expectedVersion} got ${streamVersion}`);
    }
    if (!stream) {
      stream = [];
      this._streams[streamName] = stream;
    }
    for (const event of events) {
      const position = this._all.length;
      const eventNumber = stream.length;
      const resolvedEvent = new ResolvedEvent(position, event.eventId, streamName, eventNumber, event.data, event.metadata, event.type);
      stream.push(resolvedEvent);
      await this._pushAll(resolvedEvent);
    }
    this._logger.debug('appendToStream', arguments, this._all.length, stream.length);
  }
  readAllEventsForward(position, maxCount, resolveLinkTos, userCredentials) {
    const start = position ? position.value : 0;
    const count = Math.min(maxCount, this._all.length - start);
    const end = start + count;
    return {
      readDirection: 'forward',
      fromPosition: new PositionImpl(start),
      nextPosition: new PositionImpl(end),
      events: this._all.slice(start, end),
      isEndOfStream: end === this._all.length
    };
  }
  subscribeToAllFrom(lastCheckpoint, resolveLinkTos, onEventAppeared, liveProcessingStarted, subscriptionDropped, credentials, batchSize) {
    liveProcessingStarted = liveProcessingStarted || function() {};
    subscriptionDropped = subscriptionDropped || function() {};
    let subscriptions = this._subscriptions["$all"];
    if (!subscriptions) {
      subscriptions = [];
      this._subscriptions["$all"]  = subscriptions;
    }
    subscriptions.push(onEventAppeared);
    // No persistence so no catch-up to do
    liveProcessingStarted();
  }
  async _pushAll(ev) {
    this._all.push(ev);
    // notifications
    const subscriptions = this._subscriptions["$all"] || [];
    for (const subscription of subscriptions) {
      try {
        await subscription(null, ev);
      } catch (e) {
        this._logger.error("Subscription faulted", e);
      }
    }
  }
  _processQueue() {
    const action = this._q.pop();
    if (!action) return;
    const fn = action[0];
    const defer = action[1];
    const args = action.slice(2);
    fn.apply(this, args)
      .then(x => {
        setImmediate(() => this._processQueue());
        return x;
      })
      .then(defer.resolve, defer.reject);
  }
}

function createJsonEventData(eventId, event, metadata, eventType) {
  if (!event || typeof event !== 'object') throw new TypeError("data must be an object.");

  return {
    eventId,
    data: new Buffer(JSON.stringify(event)),
    metadata: metadata ? new Buffer(JSON.stringify(metadata)) : new Buffer(0),
    type: eventType || event.constructor.name
  };
}

export class EventStoreImpl extends EventStore {
  constructor(conn, readBatchSize) {
    super();
    this._conn = conn;
    this._readBatchSize = readBatchSize;
  }

  /**
   * @param {string} streamName
   * @param {number} [start]
   * @param {{username, password}} [credentials]
   * @returns {Promise<EventStoreData[]>}
   */
  async read(streamName, start = 0, credentials) {
    /** @type {ResolvedEvent[]} */
    const events = [];
    /** @type {StreamEventsSlice} */
    let result;
    do {
      result = await this._conn.readStreamEventsForward(streamName, start, this._readBatchSize, true);
      events.push(...result.events);
    } while (!result.isEndOfStream);
    return events.map(ev => toEventData(ev.event, ev.originalPosition));
  }

  /**
   * @param {string} streamName
   * @param {number} start
   * @param {number} count
   * @param {{username, password}} [credentials]
   * @return {Promise<{isEndOfStream,nextEventNumber,events}>}
   */
  async readBatch(streamName, start, count, credentials) {
    const result = await this._conn.readStreamEventsForward(streamName, start, count, true);
    return {
      isEndOfStream: result.isEndOfStream,
      nextEventNumber: result.nextEventNumber,
      events: result.events.map(ev => toEventData(ev.event, ev.originalPosition))
    };
  }

  /**
   * @param {EventStorePosition} position
   * @param {number} count
   * @param {{username, password}} [credentials]
   * @return {Promise<{isEndOfStream,nextPosition,events}>}
   */
  async readAllBatch(position, count, credentials) {
    const result = await this._conn.readAllEventsForward(position, count, false);
    return {
      isEndOfStream: result.isEndOfStream,
      nextPosition: result.nextPosition,
      events: result.events.map(ev => toEventData(ev.event, ev.originalPosition))
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
  save(streamName, events, expectedVersion = -2, metadata = null, credentials) {
    const toAppend = events.map(ev => createJsonEventData(uuid.v4(), ev, metadata));
    return this._conn.appendToStream(streamName, expectedVersion, toAppend);
  }

  /**
   * Create a position
   * Returns start position if no arguments
   * @param {Long|number|Position} [pos]
   * @returns {EventStorePosition}
   */
  createPosition(pos) {
    if (!pos) {
      return new PositionImpl(0);
    }
    if (pos instanceof PositionImpl || typeof pos === "object") {
      return new PositionImpl(pos.value);
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
    onLiveProcessingStarted = onLiveProcessingStarted || function() {};
    onSubscriptionDropped = onSubscriptionDropped || function() {};
    const creds = credentials ? new UserCredentials(credentials.username, credentials.password) : null;
    return this._conn.subscribeToAllFrom(lastCheckPoint, false,
      (s, ev) => onEventAppeared(toEventData(ev.originalEvent, ev.originalPosition)),
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
 * @returns {EventStoreData}
 */
function toEventData(ev, position) {
  return new EventStoreData(position, ev.eventId, ev.eventStreamId, ev.eventNumber, ev.createdEpoch, ev.eventType, ev.data, ev.metadata);
}
