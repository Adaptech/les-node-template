export class CachedAggregate {
  /**
   * @param {string} streamName
   * @param {number} streamRevision
   * @param {number} lastSnapshotRevision
   * @param {Aggregate} aggregate
   */
  constructor(streamName, streamRevision, lastSnapshotRevision, aggregate) {
    this.streamName = streamName;
    this.streamRevision = streamRevision;
    this.lastSnapshotRevision = lastSnapshotRevision;
    this.aggregate = aggregate;
    Object.freeze(this);
  }
}

export class AggregateCache {
  /**
   * @param {string} streamName
   * @returns {Promise<CachedAggregate>}
   */
  async get(streamName) {
    return null;
  }

  /**
   * @param {CachedAggregate} cachedAggregate
   * @returns {Promise<void>}
   */
  async set(cachedAggregate) {}
}
