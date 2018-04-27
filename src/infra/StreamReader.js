const DefaultBatchSize = 50;

export default class StreamReader {
  constructor(eventStore, streamName, startFrom, credentials, batchSize = DefaultBatchSize) {
    this._eventStore = eventStore;
    this._streamName = streamName;
    this._nextPos = startFrom;
    this._eos = false;
    this._batchSize = batchSize;
    this._credentials = credentials;
    this._q = [];
  }

  /**
   * Read next event from stream. Returns null if EOS
   * @returns {Promise<EventStoreData|null>}
   */
  async readNext() {
    if (this._q.length === 0 && !this._eos) await this._readNextBatch();
    return this._q.shift() || null;
  }

  async _readNextBatch() {
    if (this._streamName === '$all') {
      const result = await this._eventStore.readAllBatch(this._nextPos, this._batchSize, this._credentials);
      this._eos = result.isEndOfStream;
      this._nextPos = result.nextPosition;
      for (const event of result.events) {
        this._q.push(event);
      }
    } else {
      const result = await this._eventStore.readBatch(this._streamName, this._nextPos, this._batchSize, this._credentials);
      this._eos = result.isEndOfStream;
      this._nextPos = result.nextEventNumber;
      for (const event of result.events) {
        this._q.push(event);
      }
    }
  }
}
