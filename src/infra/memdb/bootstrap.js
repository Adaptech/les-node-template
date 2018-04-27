import MapperImpl from "./Mapper";
import NullCheckPointStore from "./NullCheckPointStore";
import changeProxyFactory from "./changeProxy";

export default async function(services) {
  const {modelDefs, logger} = services;

  logger.info(`Initializing InMemory Storage...`);

  const mapper = new MapperImpl(modelDefs, {}, logger);
  const checkPointStoreFactory = () => new NullCheckPointStore();

  Object.assign(services, {
    mapper,
    changeProxyFactory,
    checkPointStoreFactory
  });
}
