/**
 * @interface
 */
export default class Logger {
  constructor(level) {
    this._level = level;
  }
  error(fmt, ...args) { throw new Error("Not implemented"); }
  info(fmt, ...args) { throw new Error("Not implemented"); }
  debug(fmt, ...args) { throw new Error("Not implemented"); }
}
