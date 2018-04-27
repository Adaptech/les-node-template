import path from "path";
import express from "express";
import morgan from "morgan";
import cors from "cors";
import {json as jsonParser} from "body-parser";
import glob from "glob";
import {newInject} from "./utils";
import {registerSecureRoutes, registerNonSecureRoutes} from "./staticRoutes";
import ReadModelGenericController from "./ReadModelGenericController";

export function loadControllersFactories(logger) {
  return glob.sync(path.resolve(__dirname, '../controllers/**/*.js'))
    .map(filePath => {
      const module = require(filePath);
      const T = module.default ? module.default : module;
      const name = path.basename(filePath, '.js');
      logger.info('Registering controller:', name);
      return function factory(services) {
        newInject(T, services, true);
      };
    });
}

function htmlStatus(status) {
  return `<!DOCTYPE html><html><head><title>App is ${status}</title></head></html>`;
}

/**
 * Initialize Web
 * @param {Object} services Services registry
 * @param {Array} controllerFactories
 */
export async function initWeb(services, controllerFactories) {
  const {config, readRepository, subscriber, logger} = services;
  const {http: httpConfig} = config;
  if (!httpConfig) {
    throw new Error('Missing "httpConfig" config section.');
  }
  const authentication = httpConfig.authStrategy
    ? require(`./${httpConfig.authStrategy}`).default
    : null;

  const app = express();
  app.use(morgan(httpConfig.accessLogFormat || 'common'));
  app.use(cors({origin: true, credentials: true}));
  app.use(jsonParser());

  services.app = app;

  //TODO: this doesn't belong here but will do for now
  let ready = subscriber.isLive();
  subscriber.once('catchUpCompleted', () => ready = true);
  app.get('/readyz', (req, res) => {
    res.header('Content-Type', 'text/html')
      .status(ready ? 200 : 503)
      .end(htmlStatus(`${ready ? '': 'not '}ready`));
  });
  app.get('/livez', (req, res) => {
    res.header('Content-Type', 'text/html')
      .status(200)
      .end(htmlStatus('live'));
  });
  app.use((req, res, next) => {
    if (!ready) return res.status(503).end('App is not ready.');
    next();
  });

  registerNonSecureRoutes(app, httpConfig.staticRoutes, logger);
  if (typeof authentication === 'function') authentication(services);
  registerSecureRoutes(app, httpConfig.staticRoutes, logger);

  for (const controllerFactory of controllerFactories) {
    controllerFactory(services);
  }
  new ReadModelGenericController(app, config, readRepository, logger);

  function listening() {
    logger.info('App ready and listening on port', httpConfig.httpPort);
  }

  if (httpConfig.useHttps) {
    const https = require('https');
    const fs = require('fs');
    const key = fs.readFileSync(httpConfig.keyFile);
    const cert = fs.readFileSync(httpConfig.certFile);
    https.createServer({
      key: key,
      cert: cert
    }, app).listen(httpConfig.httpPort, listening);
  } else {
    app.listen(httpConfig.httpPort, listening);
  }
}

export default initWeb;