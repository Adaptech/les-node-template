const GoesClient = require('goes-client').client;
const ESWrapper = require('./ESWrapper');

export default async function(services) {
  const {logger, config: {eventStore: esConfig}} = services;
  if (!logger) {
    throw new Error('Missing logger in services registry.');
  }
  if (!esConfig) {
    throw new Error('Missing "eventStore" section in config.');
  }
  logger.info(`Initializing GoES Client with endPoint "${esConfig.endPoint}"...`);
  const goesClient = new GoesClient(esConfig.endPoint);
  services.esConnection = new ESWrapper(goesClient, logger);
  services.goesClient = goesClient;
}