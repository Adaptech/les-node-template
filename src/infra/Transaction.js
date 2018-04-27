//TODO real transaction
export class Transaction {
  constructor() {
    this._actions = [];
  }
  add(action) {
    this._actions.push(action);
  }
  async commit() {
    for (const action of this._actions) {
      await action();
    }
  }
}

export default Transaction;

/*
Real Transaction will require more than just accumulating actions

Postgres needs to build a real SQL transaction
  - begin: BEGIN TRANSACTION
  - add: sql statement
  - commit: COMMIT
LevelDB
  - begin: create empty batch
  - add: enqueue operations in batch
  - commit: execute batch
InMemory
  - begin: lock on the read model
  - add: enqueue actions
  - commit: executes actions and release lock
*/
