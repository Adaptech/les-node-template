import MapperImpl from "./Mapper";
import CheckPointStore from "./CheckPointStore";
import {changeProxyFactory} from "./changeProxy";
const pgp = require('pg-promise')();

export default async function bootstrap(services) {
  const {logger, modelDefs, config} = services;
  const {postgres: pgConfig} = config;

  const db = pgp(pgConfig);

  const mapper = new MapperImpl(modelDefs, db, logger);
  const checkPointStoreFactory = keyName => new CheckPointStore(db, keyName);

  Object.assign(services, {
    mapper,
    changeProxyFactory,
    checkPointStoreFactory
  });
}