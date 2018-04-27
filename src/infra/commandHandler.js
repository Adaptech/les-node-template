import {Snapshot, DEFAULT_SNAPSHOT_THRESHOLD} from "./snapshot";
import {CachedAggregate} from "./aggregateCache";

class InvalidRequest extends Error {
  constructor(message) {
    super();
    Error.captureStackTrace(this, InvalidRequest);
    this.name = InvalidRequest.name;
    this.message = message;
  }
}

/**
 * @param {object} config
 * @param {eventFactory} eventFactory
 * @param {EventStore} eventStore
 * @param {AggregateCache} aggregateCache
 * @param {SnapshotStore} snapshotStore
 * @return {commandHandler}
 */
export default function factory(config, eventFactory, eventStore, aggregateCache, snapshotStore) {
  const snapshotThreshold = config.snapshotThreshold || DEFAULT_SNAPSHOT_THRESHOLD;
  return async function commandHandler(TAggregate, aggregateId, command) {
    if (typeof TAggregate !== 'function') throw new TypeError("TAggregate must be a function.");
    if (typeof aggregateId !== 'string' || aggregateId === "") throw new InvalidRequest("aggregateId must be a non-empty string.");
    if (typeof command !== 'object' || command === null) throw new TypeError("command must be a non-null object.");

    // load
    const streamName = TAggregate.name + "-" + aggregateId;
    const cached = await aggregateCache.get(streamName);
    /** @type {Aggregate} */
    let aggregate;
    /** @type {EventStoreData[]} */
    let events;
    let expectedVersion, lastSnapshotVersion;
    if (cached) {
      aggregate = cached.aggregate;
      events = await eventStore.read(streamName, cached.streamRevision + 1);
      expectedVersion = cached.streamRevision;
      lastSnapshotVersion = cached.lastSnapshotRevision;
    } else {
      aggregate = new TAggregate();
      const snapshot = await snapshotStore.get(streamName);
      if (snapshot) {
        aggregate.restoreFromMemento(snapshot.memento);
        events = await eventStore.read(streamName, snapshot.streamRevision + 1);
        expectedVersion = cached.streamRevision;
        lastSnapshotVersion = snapshot.streamRevision;
      } else {
        events = await eventStore.read(streamName);
        expectedVersion = -1;
        lastSnapshotVersion = -1;
      }
    }
    // hydrate
    for (const event of events) {
      const ev = eventFactory(event.eventType, event.data.toString());
      aggregate.hydrate(ev);
      expectedVersion++;
    }
    // execute
    const uncommittedEvents = aggregate.execute(command);
    // save
    const currentVersion = await eventStore.save(streamName, uncommittedEvents, expectedVersion);
    // TODO: this is wrong it's creating a memento and caching aggregate in it's previous state since uncommitted events are not hydrated
    if ((currentVersion - lastSnapshotVersion) >= snapshotThreshold) {
      await snapshotStore.add(new Snapshot(streamName, currentVersion, aggregate.createMemento()));
      lastSnapshotVersion = currentVersion;
    }
    await aggregateCache.set(new CachedAggregate(streamName, currentVersion, lastSnapshotVersion, aggregate));
    return command;
  };
}

/**
 * @callback commandHandler
 * @param {Function} TAggregate
 * @param {string} aggregateId
 * @param {object} command
 * @returns Promise<void>
 */
