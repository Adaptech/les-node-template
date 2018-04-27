export default class NullLastCheckPointStore {
  constructor(logger) {
    this._logger = logger;
  }

  async get() {
    return null;
  }

  async put(pos) {
  }
}