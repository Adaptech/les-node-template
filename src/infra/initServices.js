const path = require('path');

function init(services) {
  const {logger} = services;
  let bootstrap = null;
  try {
    const module = require(path.resolve(__dirname, '../services/bootstrap'));
    bootstrap = module.default || module;
  } catch (e) {
    logger.error(e.stack);
    return;
  }
  return bootstrap(services);
}
module.exports = init;