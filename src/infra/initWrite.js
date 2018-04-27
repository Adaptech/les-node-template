import path from "path";
import glob from "glob";
import commandHandlerFactory from "./commandHandler";
import {AggregateCache} from "./aggregateCache";
import {SnapshotStore} from "./snapshot";
import CommandActionHelper from "./CommandActionHelper";

export function loadEventsMap(logger) {
  return glob
    .sync(path.resolve(__dirname, '../events/**/*.js'))
    .reduce((eventsMap, filePath) => {
      const module = require(filePath);
      const T = module.default ? module.default : module;
      logger.info('Registering event:', T.name);
      eventsMap[T.name] = T;
      return eventsMap;
    }, {});
}

/**
 * Initialize CQRS write side
 * @param {Object} services Services registry
 * @param {eventFactory} eventFactory
 * @returns {Promise}
 */
export default async function initWrite(services, eventFactory) {
  const {config, eventStore, readRepository, logger} = services;
  const aggregateCache = new AggregateCache();
  const snapshotStore = new SnapshotStore();
  const commandHandler = commandHandlerFactory(config, eventFactory, eventStore, aggregateCache, snapshotStore);
  const commandActionHelper = new CommandActionHelper(commandHandler, readRepository, logger);
  Object.assign(services, {eventFactory, commandHandler, commandHandlerFactory, commandActionHelper});
}
