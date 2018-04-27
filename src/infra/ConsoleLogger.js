/* eslint no-console: 0 */
import util from "util";
import Logger from "./Logger";

const Levels = {
  DEBUG: 3,
  INFO: 2,
  ERROR: 1,
  OFF: 0
};

export default class ConsoleLogger extends Logger {
  constructor(level) {
    if (typeof level === 'string') {
      level = Levels[level.toUpperCase()];
    }
    super(level || Levels.DEBUG);
  }

  error(fmt, ...args) {
    if (this._level < Levels.ERROR) {
      return;
    }
    const isoDate = new Date().toISOString();
    const result = util.format(fmt, ...args);
    console.log(isoDate, 'ERROR', result);
  }

  info(fmt, ...args) {
    if (this._level < Levels.INFO) {
      return;
    }
    const isoDate = new Date().toISOString();
    const result = util.format(fmt, ...args);
    console.log(isoDate, 'INFO', result);
  }

  debug(fmt, ...args) {
    if (this._level < Levels.DEBUG) {
      return;
    }
    const isoDate = new Date().toISOString();
    const result = util.format(fmt, ...args);
    console.log(isoDate, 'DEBUG', result);
  }
}
