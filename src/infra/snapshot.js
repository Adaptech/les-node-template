export const DEFAULT_SNAPSHOT_THRESHOLD = 1024;

export class Snapshot {
  /**
   * @param {string} streamName
   * @param {number} streamRevision
   * @param {object} memento
   */
  constructor(streamName, streamRevision, memento) {
    this.streamName = streamName;
    this.streamRevision = streamRevision;
    this.memento = memento;
    Object.freeze(this);
  }
}

export class SnapshotStore {
  /**
   * @param {string} streamName
   * @returns {Promise<Snapshot>}
   */
  async get(streamName) {
    return null;
  }

  /**
   * @param {Snapshot} snapshot
   * @returns {Promise<void>}
   */
  async add(snapshot) {}
}
