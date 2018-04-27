import url from "url";
import esClient from "node-eventstore-client";

export async function connectTo(connection, name, logger) {
  logger.info(`Connecting to ${name} GES...`);
  const connectionPromise = new Promise((resolve, reject) => {
    connection.once('closed', reject);
    connection.once('connected', endPoint => {
      connection.removeListener('error', reject);
      logger.info("Connected to", name, "GES at", endPoint);
      resolve();
    });
  });
  await connection.connect();
  return connectionPromise;
}

export function toESCredentials(urlObject) {
  if (typeof urlObject === 'string') {
    urlObject = url.parse(urlObject);
  }
  if (urlObject === null || typeof urlObject !== 'object') {
    throw new Error('Invalid "urlObject" argument');
  }
  if (!urlObject.auth) {
    throw new Error(`"urlObject" doesn't have auth data.`);
  }
  const [username, password] = urlObject.auth.split(':');
  return new esClient.UserCredentials(username, password);
}

export function toESUri(urlObject) {
  if (typeof urlObject === 'string') {
    urlObject = url.parse(urlObject);
  }
  if (urlObject === null || typeof urlObject !== 'object') {
    throw new Error('Invalid "urlObject" argument');
  }
  if (!urlObject.protocol) {
    throw new Error(`"urlObject" doesn't have protocol.`);
  }
  if (!urlObject.hostname) {
    throw new Error(`"urlObject" doesn't have hostname.`);
  }
  return `${urlObject.protocol}//${urlObject.hostname}:${urlObject.port || 1113}`;
}
