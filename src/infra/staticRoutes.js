import path from "path";
import express from "express";

function registeStaticRoute(app, routeDesc, logger) {
  const route = routeDesc.regexRoute
    ? new RegExp(routeDesc.regexRoute)
    : routeDesc.route;
  if (routeDesc.path) {
    const resolvedPath = path.resolve(routeDesc.path);
    logger.info(`Registering static route: ${route} => ${resolvedPath}`);
    app.use(route, express.static(resolvedPath));
    return;
  }
  if (routeDesc.content) {
    logger.info(`Registering static route: ${route} => <static content>`);
    app.get(route, (req, res) => {
      res.set('Content-Type', routeDesc.contentType || 'text/plain');
      res.status(200).send(routeDesc.content);
    });
  }
}

export function registerNonSecureRoutes(app, staticRoutes, logger) {
  if (!Array.isArray(staticRoutes)) return;
  staticRoutes
    .filter(route => !route.secure)
    .forEach(route => registeStaticRoute(app, route, logger));
}

export function registerSecureRoutes(app, staticRoutes, logger) {
  if (!Array.isArray(staticRoutes)) return;
  staticRoutes
    .filter(route => route.secure)
    .forEach(route => registeStaticRoute(app, route, logger));
}