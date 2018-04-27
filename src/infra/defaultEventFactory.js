/**
 * @param {Object} eventsMap
 * @return {eventFactory}
 */
export default function create(eventsMap) {
  return function eventFactory(eventType, json) {
    const eventCls = eventsMap[eventType];
    if (!eventCls) {
      throw new Error(`No event class registered for eventType "${eventType}".`);
    }
    const eventObject = JSON.parse(json);
    // This is a total hack that assumes that the anonymous json object matches the target prototype
    eventObject.__proto__ = eventCls.prototype;
    return eventObject;
  };
}

/**
 * @callback eventFactory
 * @param {string} eventType
 * @param {string} json
 * @returns {object} event
 * @throws {Error} Throws if an event can't be created from the data provided
 */
