import path from "path";
import ConsoleLogger from "./ConsoleLogger";
import {parseCommandLine} from "./utils";
import serviceRegistryFactory from "./serviceRegistry";
import initRead, {loadReadModels} from "./initRead";
import initWrite, {loadEventsMap} from "./initWrite";
import initWeb, {loadControllersFactories} from "./initWeb";
import createDefaultEventFactory from "./defaultEventFactory";
import * as cfg from "./config";

export let logger = new ConsoleLogger();

export async function loadConfig(args) {
  const optionsDef = {l: 'lastPos'};
  const options = parseCommandLine(optionsDef, args);
  const configName = options.$args[0];
  if (!configName) {
    // eslint-disable-next-line no-console
    console.log('Usage:', args[0], args[1], '[env]');
    process.exit(-1);
  }
  return cfg.loadConfig(`config/${configName}.json`);
}

/**
 * @param {object} options
 * @param {object} options.config
 * @param {ConsoleLogger} options.logger
 * @param {function} options.esBootstrap
 * @param {function} options.storageBootstrap
 * @param {object[]} options.readModels
 * @param {eventFactory} options.eventFactory
 * @param {function[]} options.controllersFactories
 * @param {function} [options.servicesBootstrap]
 * @return {Promise<void>}
 */
export async function wireUp(options) {
  const {config, logger: _logger, esBootstrap, storageBootstrap, readModels, eventFactory, controllersFactories, servicesBootstrap} = options;
  logger = _logger;

  process.on('SIGINT', () => shutdown(false));
  process.on('SIGTERM', () => shutdown(false));
  process.on('unhandledRejection', (reason, p) => {
    const errMsg = reason && (reason.stack || reason);
    logger.error('Unhandled promise rejection', p, errMsg);
    shutdown(true);
  });

  const services = serviceRegistryFactory();
  services.config = config;
  services.logger = logger;

  await esBootstrap(services);
  await initRead(services, storageBootstrap, readModels);
  await initWrite(services, eventFactory);
  if (servicesBootstrap) {
    await servicesBootstrap(services);
  }
  await initWeb(services, controllersFactories);
}

function getESBootstrapFromConfig(config) {
  const {eventStore: esConfig} = config;
  if (!esConfig) {
    throw new Error('Missing "eventStore" config section.');
  }
  try {
    const bootstrap = require(path.resolve(__dirname, esConfig.type, 'bootstrap'));
    return bootstrap.default || bootstrap;
  } catch (err) {
    throw new Error(`Can't find bootstrap for eventStore of type ${esConfig.type}: ${err.message}`);
  }
}

function getStorageBootstrapFromConfig(config) {
  const {readModelStore} = config;
  if (!readModelStore) {
    throw new Error('Missing "readModelStore" config.');
  }
  try {
    const bootstrap = require(path.resolve(__dirname, readModelStore, 'bootstrap'));
    return bootstrap.default || bootstrap;
  } catch (err) {
    throw new Error(`Can't find bootstrap for storage of type ${readModelStore}: ${err.message}`);
  }
}

function getServicesBootstrap() {
  try {
    const servicesBootstrap = require(path.resolve(__dirname, "..", "services", "bootstrap"));
    return servicesBootstrap.default || servicesBootstrap;
  } catch (err) {
    return null;
  }
}

/**
 * Auto wire-up from configuration
 * @param {Object} config
 * @return {Promise<void>}
 */
export async function autoWireUp(config) {
  const logger = new ConsoleLogger(config.logLevel);
  const esBootstrap = getESBootstrapFromConfig(config);
  const storageBootstrap = getStorageBootstrapFromConfig(config);
  const readModels = loadReadModels(logger);
  const eventsMap = loadEventsMap(logger);
  const eventFactory = createDefaultEventFactory(eventsMap);
  const controllersFactories = loadControllersFactories(logger);
  const servicesBootstrap = getServicesBootstrap();
  return wireUp({
    config, logger, esBootstrap, storageBootstrap, readModels, eventFactory, controllersFactories, servicesBootstrap
  });
}

export function shutdown(faulted) {
  logger.info(`Shutting down process${faulted?" because it faulted":""}...`);
  //TODO clean shutdown
  process.exit(faulted ? -1 : 0);
}
