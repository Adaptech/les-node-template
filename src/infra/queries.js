const ValidOperators = ['eq', 'lt', 'lte', 'gt', 'gte', 'between', 'inq', 'ilike', 'neq'];

/*
Where filter Loopback API compatible (https://loopback.io/doc/en/lb2/Where-filter.html)

field    => {key: {operator: value}}
eq short => {key: value}
and/or   => {operator: [{filter1},{filter2},...]}

In addition Where filter support legacy
"and" short => {field1: value, field2: {operator: value}}
*/
export class Where {
  constructor(where) {
    this._root = Where._normalize(where);
  }

  static fromFilter(filter) {
    return new Where(filter.where);
  }

  static _normalize(node) {
    if (!node) return node;
    const keys = Object.keys(node);
    if (keys.length === 0) return node;
    if (keys.length > 1) {
      return Where._normalizeAnd(node, keys);
    }
    const key = keys[0];
    const value = node[key];
    if (['$or','$and','or','and'].includes(key) && Array.isArray(value)) {
      const op = Where._normalizeOp(key);
      return {[op]: value.map(Where._normalize)};
    }
    return Where._normalizeEq(key, node[key]);
  }

  static _normalizeEq(key, value) {
    if (!value || typeof value !== 'object') {
      return {
        [key]: {'eq': value}
      };
    }
    const originalOp = Object.keys(value)[0];
    const op = Where._normalizeOp(originalOp);
    if (!ValidOperators.includes(op)) {
      throw new Error(`Invalid operator ${originalOp}.`);
    }
    const v = value[originalOp];
    return {[key]: {[op]: v}};
  }

  static _normalizeAnd(node, keys) {
    const nodes = keys.map(key => Where._normalizeEq(key, node[key]));
    return {
      'and': nodes
    };
  }

  static _normalizeOp(originalOp) {
    if (!originalOp) return null;
    let op = originalOp.toLowerCase();
    if (op[0] === '$') op = op.substr(1);
    return op;
  }

  isEmptyOrNull() {
    return (!this._root || Object.keys(this._root).length === 0);
  }

  rootNode() {
    return this._root;
  }

  /**
   * Get constraint for Index
   * @param {string|string[]} index
   * @returns {?ConstraintNode}
   */
  getIndexConstraint(index) {
    let pkNode = this._readFirstNode();
    if (!pkNode) return pkNode;
    if (Array.isArray(index)) {
      if (pkNode.key) return null;
      const pkNodes = index.map(x => this.getIndexConstraint(x));
      //TODO: support operator other than "eq" for composite keys
      if (pkNodes.some(x => x === null || x.operator !== 'eq')) return null;
      //TODO: This has LevelDB key knowledge, doesn't belong here
      return new ConstraintNode(
        pkNodes.map(x => x.key).join('_'),
        'eq',
        pkNodes.map(x => x.value).join(':')
      );
    }
    if (!pkNode.key) {
      //TODO: fix me - this will never work as value does not contains {key,operator,value} object
      //TODO: fix me #2 - should only look in value if operator === "and"
      pkNode = pkNode.value.find(x => x.key === index);
    }
    if (!pkNode || pkNode.key !== index) return null;
    return pkNode;
  }

  _readFirstNode() {
    if (!this._root) {
      return null;
    }
    const keys = Object.keys(this._root);
    if (keys.length === 0) {
      return null;
    }
    const key = keys[0];
    const value = this._root[key];
    if (Array.isArray(value)) {
      return new ConstraintNode(null, key, value);
    }
    const operator = Object.keys(value)[0];
    return new ConstraintNode(key, operator, value[operator]);
  }
}

class ConstraintNode {
  /**
   * @param {?string} key
   * @param {string} operator
   * @param value
   */
  constructor(key, operator, value) {
    this.key = key;
    this.operator = operator;
    this.value = value;
    Object.freeze(this);
  }
}

const Directions = {
  'ASC': 1,
  'DESC': -1
};

export class Order {
  static fromFilter(filter) {
    return new Order(filter.order);
  }

  constructor(order) {
    this._order = order;
  }

  static _parseOrderValue(order) {
    const [propertyName, direction] = order.split(' ');
    const dir = direction && Directions[direction.toUpperCase()];
    return [propertyName, dir || Directions.ASC];
  }

  getOrders() {
    if (!this._order) {
      return [];
    }
    if (typeof this._order === 'string') {
      return [Order._parseOrderValue(this._order)];
    }
    if (Array.isArray(this._order)) {
      return this._order.map(Order._parseOrderValue);
    }
    throw new Error(`Invalid type for order.`);
  }
}