import {loadConfig, autoWireUp, logger, shutdown} from "./infra";

(async function() {
  try {
    const config = await loadConfig(process.argv);
    await autoWireUp(config);
  } catch (err) {
    logger.error("An unhandled exception occurred.", err);
    await shutdown(true);
  }
})();
