import MapperImpl from "./Mapper";
import CheckPointStore from "./CheckPointStore";
import {openDb} from "./db";

function changeProxyFactory(obj) {
  const handler = {
    getChanges: function() {
      return obj;
    }
  };
  const proxy = new Proxy(obj, handler);
  return { proxy, handler };
}

export default async function(services) {
  const { modelDefs, logger, config } = services;
  const { eventStore: esConfig, levelDb: levelDbConfig } = config;
  if (!esConfig) {
    throw new Error('Missing "eventStore" section in config.');
  }
  if (!levelDbConfig) {
    throw new Error('Missing "levelDb" section in config.');
  }

  const { credentials: esCredentials } = esConfig;
  if (!esCredentials) {
    throw new Error('Missing "credentials" config in "eventStore" section.');
  }

  logger.info(`Initializing LevelDB Storage...`);

  const db = await openDb(levelDbConfig.dbDir);
  const mapper = new MapperImpl(modelDefs, db, logger);
  const checkPointStoreFactory = keyName => new CheckPointStore(db, keyName);

  Object.assign(services, {
    mapper,
    changeProxyFactory,
    checkPointStoreFactory
  });
}