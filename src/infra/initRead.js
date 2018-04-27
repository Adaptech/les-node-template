import path from "path";
import glob from "glob";
import builderFactory from "./builder";
import ReadRepository from "./ReadRepository";
import TransactionalRepository from "./TransactionalRepository";
import {buildModelDefs, getModelsFor} from "./readModels";

export function loadReadModels(logger) {
  return glob
    .sync(path.resolve(__dirname, '../readModels/*.js'))
    .map(filePath => {
      const model = require(filePath);
      const name = path.basename(filePath, '.js');
      logger.info('Registering read model:', name);
      if (!model.config || !model.handler) {
        throw new Error(`ReadModel '${name}' module MUST have 'config' and 'handler' exports.`);
      }
      return {
        name,
        config: model.config,
        lookups: model.lookups,
        handler: model.handler
      };
    });
}

/**
 * Initialize CQRS read side
 * @param {Object} services Services registry
 * @param {Function} storageBootstrap
 * @param {Array} readModels
 * @returns {Promise}
 */
export default async function initRead(services, storageBootstrap, readModels) {
  const { logger, eventStore } = services;
  services.readModels = readModels;
  services.modelDefs = buildModelDefs(readModels);
  await storageBootstrap(services);
  const { mapper, changeProxyFactory } = services;
  const readRepository = new ReadRepository(services.mapper, logger);
  const lastCheckPointStore = services.checkPointStoreFactory('lastCheckPoint');
  const transactionalRepositoryFactory = (modelName, trx) => new TransactionalRepository(mapper, modelName, readRepository, trx, changeProxyFactory, logger);
  Object.assign(services, { readRepository, lastCheckPointStore, transactionalRepositoryFactory });
  services.builder = builderFactory(services, eventStore);
  await updateReadModels(services, eventStore);
  await subscribeFromLastCheckPoint(services, eventStore);
}

async function updateReadModels(services, eventStore) {
  try {
    // TODO this should not rely on esClient
    const { builder, checkPointStoreFactory, esStreamReaderFactory, lastCheckPointStore, logger, mapper, readModels } = services;
    const readModelsToUpdate = await getReadModelsToUpdate(readModels, mapper);
    if (!readModelsToUpdate.length) return;
    logger.info(`Rebuilding ReadModels: ${readModelsToUpdate.map(x => x.name).join(', ')}...`);

    const lastCheckPoint = eventStore.createPosition(await lastCheckPointStore.get());
    const checkPointStore = checkPointStoreFactory('readModelUpdater');
    const startFrom = eventStore.createPosition(await checkPointStore.get());
    const START = eventStore.createPosition();
    const createTable = startFrom.compareTo(START) === 0;

    if (createTable) {
      logger.info(`Creating tables...`);
      for (const readModelToUpdate of readModelsToUpdate) {
        const models = getModelsFor(readModelToUpdate);
        for (const model of models) {
          await mapper.tryDropModel(model);
          await mapper.tryCreateModel(model);
        }
      }
    }

    if (lastCheckPoint) {
      logger.info(`Processing events starting from ${lastCheckPoint}...`);
      //TODO: this is incompatible with GoES
      const allStreamReader = esStreamReaderFactory("$all", startFrom);
      let ev;
      while ((ev = await allStreamReader.readNext())) {
        if (ev.position.compareTo(lastCheckPoint) > 0) break;
        await builder.processEvent(readModelsToUpdate, ev);
        await checkPointStore.put(ev.position);
      }
    }

    logger.info(`Done rebuilding read models...`);
    await checkPointStore.put(null);
    for (const readModelToUpdate of readModelsToUpdate) {
      const models = getModelsFor(readModelToUpdate);
      for (const model of models) {
        await mapper.setModelVersion(model);
      }
    }
  } catch (e) {
    const error = new Error(`Failed to update read models: ${e.message}`);
    error.inner = e;
    throw error;
  }
}

async function getReadModelsToUpdate(readModels, mapper) {
  const readModelsToUpdate = [];
  for (const k in readModels) {
    const readModel = readModels[k];
    const currentVersion = readModel.config.version || 1;
    const version = await mapper.getModelVersion(readModel.name);
    if (currentVersion !== version) {
      readModelsToUpdate.push(readModel);
    }
  }
  return readModelsToUpdate;
}

async function subscribeFromLastCheckPoint(services, eventStore) {
  const { builder, subscriberFactory, lastCheckPointStore, readModels } = services;
  const lastCheckPoint = eventStore.createPosition(await lastCheckPointStore.get());
  const updateLastCheckPoint = lastCheckPoint => lastCheckPointStore.put(lastCheckPoint);
  const subscriber = subscriberFactory(eventStore, updateLastCheckPoint);
  subscriber.addHandler(esData => builder.processEvent(readModels, esData));
  Object.assign(services, {subscriber});
  return subscriber.startFrom(lastCheckPoint || null);
}
