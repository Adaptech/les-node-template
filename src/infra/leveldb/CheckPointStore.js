export default class CheckPointStore {
  constructor(db, keyName) {
    this._db = db;
    this._keyName = `$checkPoints:${keyName}`;
  }
  async get() {
    try {
      const json = await this._db.get(this._keyName);
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }
  async put(checkPoint) {
    return this._db.put(this._keyName, JSON.stringify(checkPoint));
  }
}