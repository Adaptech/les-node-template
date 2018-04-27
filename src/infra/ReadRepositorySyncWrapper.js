class ObjectPromiseProxyHandler {
  get(target, property) {
    if (property === 'then') {
      return Promise.prototype.then.bind(target);
    }
    if (property === 'catch') {
      return Promise.prototype.catch.bind(target);
    }
    return Promise.resolve(target)
      .then(obj => {
        return obj[property];
      });
  }
}

class ReadRepositorySyncWrapper {
  constructor(inner) {
    this._inner = inner;
    this._promises = [];
  }

  findOne(modelName, where, noThrowOnNotFound) {
    const promise = this._inner.findOne(modelName, where, noThrowOnNotFound);
    return new Proxy(promise, new ObjectPromiseProxyHandler());
  }

  findWhere(modelName, where) {
    const promise = this._inner.findWhere(modelName, where);
    this._promises.push(['findWhere', promise]);
    return promise;
  }

  findAll(modelName) {
    const promise = this._inner.findAll(modelName);
    this._promises.push(['findAll', promise]);
    return promise;
  }

  exists(modelName, where) {
    const promise = this._inner.exists(modelName, where);
    this._promises.push(['exists', promise]);
    return promise;
  }

  hasPromises() {
    return this._promises.length > 0;
  }
}
module.exports = ReadRepositorySyncWrapper;