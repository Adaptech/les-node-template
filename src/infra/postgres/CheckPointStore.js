
const CREATE_CHECKPOINT_SQL = 'CREATE TABLE "$checkpoints" (name VARCHAR(50), value JSON, CONSTRAINT pk_checkpoints PRIMARY KEY (name));';
const DROP_CHECKPOINT_SQL = 'DROP TABLE IF EXISTS "$checkpoints";';
export const GET_CHECKPOINT_SQL = 'SELECT value FROM "$checkpoints" WHERE name = $1;';
export const PUT_CHECKPOINT_SQL = `INSERT INTO "$checkpoints" (name, value) VALUES ($1, $2)
ON CONFLICT (name) DO UPDATE SET value = $2;`;

export default class CheckPointStore {
  static async createTable(db) {
    return db.none(CREATE_CHECKPOINT_SQL);
  }

  static async dropTable(db) {
    return db.none(DROP_CHECKPOINT_SQL);
  }

  constructor(db, name) {
    this._db = db;
    this._name = name;
  }

  async get() {
    try {
      const result = await this._db.one(GET_CHECKPOINT_SQL, this._name);
      return result.value;
    } catch (e) {
      return null;
    }
  }

  async put(checkPoint) {
    return this._db.none(PUT_CHECKPOINT_SQL, [this._name, checkPoint]);
  }
}