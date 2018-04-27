import {EventEmitter} from 'events';

const BATCH_SIZE = 250;
const MIN_QUEUE_SIZE = 1000;
const MAX_QUEUE_SIZE = 10000;

export default class Subscriber extends EventEmitter {
  constructor(eventStore, updateLastCheckPoint, credentials, logger) {
    super();
    this._eventStore = eventStore;
    this._updateLastCheckPoint = updateLastCheckPoint;
    this._credentials = credentials;
    this._logger = logger;
    this._isLive = false;
    this._lastCheckpoint = null;
    this._promise = Promise.resolve();
    this._queueSize = 0;
    this._pauseRequested = false;
    this._paused = false;
    this._queueWatchInterval = null;
    this._handlers = [];
  }

  /**
   * @param {Object} lastCheckpoint
   * @return Promise
   */
  startFrom(lastCheckpoint) {
    if (this._subscription || this._paused) throw new Error('Subscriber is already started.');

    this._subscribe(this._eventStore.createPosition(lastCheckpoint));

    return Promise.resolve();
  }

  isLive() {
    return this._isLive;
  }

  addHandler(handler) {
    if (this._subscription || this._paused) throw new Error('Subscriber is already started.');
    this._handlers.push(handler);
  }

  _subscribe(lastCheckpoint) {
    const action = this._paused ? 'Restarting' : 'Starting';
    this._logger.info(`${action} subscription from`, (lastCheckpoint || "beginning").toString());

    const liveProcessingStarted = () => {
      this._logger.info('Live processing started.');
      this._promise = this._promise.then(() => {
        this._isLive = true;
        this.emit('catchUpCompleted');
      });
    };
    const subscriptionDropped = (conn, reason, error) => {
      if (reason === 'userInitiated' && this._pauseRequested) {
        this._paused = true;
        this._logger.info('Subscriber paused.');
      } else {
        //Persistent subscription automatically reconnect and continue so nothing to do here than logging
        this._logger.info('Subscription dropped:', reason, error);
      }
    };

    this._subscription = this._eventStore.subscribeToAllFrom(
      lastCheckpoint,
      (event) => this._onEventAppeared(event),
      liveProcessingStarted,
      subscriptionDropped,
      this._credentials,
      BATCH_SIZE);
  }

  _pause() {
    if (this._pauseRequested) return;
    this._pauseRequested = true;
    this._logger.debug('Subscriber pause requested...');
    this._subscription.stop();
    this._subscription = null;
    this._queueWatchInterval = setInterval(() => this._watchQueue(), 500);
  }

  _watchQueue() {
    if (!this._paused) return;
    if (this._queueSize > MIN_QUEUE_SIZE) return;
    this._subscribe(this._lastCheckpoint);
    this._paused = false;
    this._pauseRequested = false;
    clearInterval(this._queueWatchInterval);
    this._queueWatchInterval = null;
  }

  /**
   * @param {EventStoreData} eventData
   * @private
   */
  _onEventAppeared(eventData) {
    if (this._paused) return;
    if (this._queueSize > MAX_QUEUE_SIZE) this._pause();
    this._lastCheckpoint = eventData.position;

    const eventType = eventData.eventType;
    this._logger.debug('Event Appeared', eventType);
    if (eventType[0] === '$') return;
    this._promise = this._promise
      .then(() => this._processEvent(eventData))
      .then(() => this._updateLastCheckPoint(eventData.position))
      .then(() => this._queueSize--, () => this._queueSize--);
    this._queueSize++;
  }

  async _processEvent(esData) {
    for (const handler of this._handlers) {
      //Note: handler must not throw
      await handler(esData);
    }
  }
}
