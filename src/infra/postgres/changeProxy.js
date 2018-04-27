// undefined, null, number, boolean, string, object, array
import {deepClone} from "../utils";

function deepStrictEqual(left, right) {
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') {
    return left === right;
  }
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  for (const k in left) {
    if (!deepStrictEqual(left[k], right[k])) return false;
  }
  return true;
}

class ObjectChangeProxyHandler {
  constructor() {
    this._changes = {};
    this._refChanges = {};
  }
  get(target, property, receiver) {
    if (this._changes.hasOwnProperty(property)) {
      return this._changes[property];
    }
    if (target[property] === null || typeof target[property] !== 'object') {
      return target[property];
    }
    if (this._refChanges.hasOwnProperty(property)) {
      return this._refChanges[property].new;
    }
    this._refChanges[property] = {
      orig: target[property],
      new: deepClone(target[property])
    };
    return this._refChanges[property].new;
  }
  set(target, property, value, receiver) {
    this._changes[property] = value;
    return true;
  }
  getChanges() {
    for (const k in this._refChanges) {
      if (!deepStrictEqual(this._refChanges[k].new, this._refChanges[k].orig)) {
        this._changes[k] = this._refChanges[k].new;
      }
    }
    return this._changes;
  }
}

export function changeProxyFactory(obj) {
  const handler = new ObjectChangeProxyHandler();
  const proxy = new Proxy(obj, handler);
  return {proxy, handler};
}