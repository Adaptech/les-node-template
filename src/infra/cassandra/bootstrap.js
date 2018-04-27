const cassandra = require('cassandra-driver');
const ReadRepository = require('../ReadRepository');
const TransactionalRepository = require('../TransactionalRepository');
const Mapper = require('./Mapper');
const objectChangeProxyFactory = require('./ObjectChangeProxy');

module.exports = function(services) {
  throw new Error("Needs rewrite.");
  /*
  const {readModels, logger, options, config} = services;
  const client = new cassandra.Client({contactPoints: config.cassandra.contactPoints});
  const mapper = new Mapper(client, config.cassandra.keySpace, readModels.filter(x => x.config), logger);
  const readRepository = new ReadRepository(mapper, logger);

  function transactionalRepositoryFactory(modelName) {
    return new TransactionalRepository(mapper, modelName, objectChangeProxyFactory, logger);
  }

  const subscriber = null;
  Object.assign(services, {
    readRepository,
    subscriber
  });
  return client.connect()
    .then(() => subscriber.startFrom(options.lastPos));
  */
};
