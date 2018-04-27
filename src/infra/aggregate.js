import {deepClone, getTypeName} from "./utils";

/**
 * @interface
 */
class Aggregate {
  /**
   * @param {object} event
   */
  hydrate(event) {}

  /**
   * @param {object} command
   * @returns {object[]}
   */
  execute(command) {}

  /**
   * @param {object} memento
   */
  restoreFromMemento(memento) {}

  /**
   * @returns {object}
   */
  createMemento() {}
}

/**
 * Build an Aggregate object from a set of command and event handlers
 * @param {string} name
 * @param {AggregateHandler[]} commandHandlers
 * @param {AggregateHandler[]} eventHandlers
 * @returns {Aggregate}
 */
export function buildAggregate(name, commandHandlers, eventHandlers) {
  //TODO validations
  // ES6 hack so that the anonymous constructor function is named with the content of name parameter
  return {
    [name]: function() {
      let state = {};
      this.hydrate = function(event) {
        const handler = eventHandlers.find(eh => event instanceof eh.messageConstructor);
        if (handler) {
          state = handler.handle(Object.freeze(state), event);
        }
      };
      this.execute = function(command) {
        const handler = commandHandlers.find(ch => command instanceof ch.messageConstructor);
        if (handler) {
          return handler.handle(Object.freeze(state), command);
        }
        throw new Error(`Unknown command "${getTypeName(command)}" for ${name}.`);
      };
      this.createMemento = function() {
        return deepClone(state);
      };
      this.restoreFromMemento = function(memento) {
        for (const k in memento) {
          state[k] = deepClone(memento[k]);
        }
      };
    }
  }[name];
}

/**
 * @class
 */
class AggregateHandler {
  /**
   * @param {function} messageConstructor
   * @param {function} handler
   */
  constructor(messageConstructor, handler) {
    this.messageConstructor = messageConstructor;
    this.handle = handler;
  }
}

/**
 * @param {function} messageConstructor
 * @param {function} handler
 * @returns {AggregateHandler}
 */
export function handlerFor(messageConstructor, handler) {
  return new AggregateHandler(messageConstructor, handler);
}
