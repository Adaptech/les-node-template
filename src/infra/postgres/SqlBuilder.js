const SqlOperators = {
  'eq': { operator: '=' },
  'neq': { operator: '!=' },
  'gt': { operator: '>' },
  'gte': { operator: '>=' },
  'lt': { operator: '<' },
  'lte': { operator: '<=' },
  'between': { operator: 'BETWEEN', values: true, rhs: pos => `$${pos} AND $${pos + 1}` },
  'inq': { operator: 'IN', values: true, rhs: (pos, nb) => `(${genNumbers(pos, nb).map(n => '$'+n)})` },
  'ilike': { operator: 'ILIKE', value: d => `%${d}%` } ,
  'and': { operator: 'AND' },
  'or': { operator: 'OR' },
};

function genNumbers(from, count) {
  const numbers = [];
  for (let n = from; n < from + count; n++) {
    numbers.push(n);
  }
  return numbers;
}

const TypeToDbTypeMap = {
  'boolean': 'BOOLEAN',
  'string': 'TEXT',
  'number': 'FLOAT(53)',
  'object': 'JSON'
};
const FormatToDbTypeMap = {
  'uuid': 'UUID'
};

const defaultRHS = pos => `$${pos}`;

export default class SqlBuilder {
  /**
   * Generate UPSERT sql
   * @param {string[]} insertColumns
   * @param {string} tableName
   * @param {object} columnDefs
   * @returns {string}
   */
  static upsert(insertColumns, { tableName, columnDefs }) {
    const sets = insertColumns.filter(x => !columnDefs[x].isPrimaryKey)
      .map(c => `"${c}" = ${SqlBuilder._namedPlaceHolder(c, columnDefs[c])}`);
    return `INSERT INTO ${tableName} (${insertColumns.map(SqlBuilder._quote).join(", ")})` +
      ` VALUES (${insertColumns.map(x => SqlBuilder._namedPlaceHolder(x, columnDefs[x])).join(", ")})` +
      ` ON CONFLICT ON CONSTRAINT pk_${tableName}` +
      (sets.length ? ` DO UPDATE SET ${sets.join(", ")}` : ' DO NOTHING');
  }

  /**
   * Generate SELECT sql
   * @param {string} whereSql
   * @param {Order} orderBy
   * @param {string} tableName
   * @param {string[]} columns
   * @returns {string}
   */
  static select(whereSql, orderBy, { tableName, columns }) {
    const orderByList = orderBy.getOrders().map(SqlBuilder._toOrderSql);
    const orderBySql = (orderByList && orderByList.length) ? ` ORDER BY ${orderByList.join(", ")}` : '';
    return `SELECT ${columns.map(SqlBuilder._quote).join(", ")}, COUNT(*) OVER() AS "$full_count" FROM ${tableName}${whereSql}${orderBySql}`;
  }

  /**
   * Generate UPDATE sql
   * @param {string[]} setColumns
   * @param {string} whereSql
   * @param {object} columnDefs
   * @param {string} tableName
   * @returns {string}
   */
  static update(setColumns, whereSql, { columnDefs, tableName }) {
    const sets = setColumns.map((c, i) => `"${c}" = ${SqlBuilder._numberedPlaceHolder(i, columnDefs[c])}`);
    return `UPDATE ${tableName} SET ${sets.join(", ")}${whereSql}`;
  }

  /**
   * Generate DELETE sql
   * @param {string} whereSql
   * @param {object} columnDefs
   * @param {string} tableName
   */
  static delete(whereSql, { tableName }) {
    return `DELETE FROM ${tableName} ${whereSql}`;
  }

  /**
   * Transform Where to SQL
   * @param {Where} where
   * @param {object[]} values
   * @return {{sql: '', values: []}}
   */
  static toWhereSql(where, values = []) {
    if (where.isEmptyOrNull()) return { sql: '', values };
    const sql = SqlBuilder._visitNode(where.rootNode(), values);
    return { sql: ` WHERE ${sql}`, values };
  }

  static createTable({ tableName, columns, columnDefs, primaryKey }) {
    const pkSql = `CONSTRAINT pk_${tableName} PRIMARY KEY (${primaryKey.map(SqlBuilder._quote).join(', ')})`;
    const columnTypes = columns.reduce((colTypes, col) => {
      return {
        ...colTypes,
        [col]: SqlBuilder._toColumnType(columnDefs[col], true)
      };
    }, {});
    const columnsSql = columns.map(col => `"${col}" ${columnTypes[col]}`).join(',');
    return `CREATE TABLE IF NOT EXISTS ${tableName} (${columnsSql}, ${pkSql})`;
  }

  static createIndex(indexColumns, { tableName }) {
    return `CREATE INDEX IF NOT EXISTS ${tableName}_${indexColumns.join('_')} ON ${tableName} (${indexColumns.map(SqlBuilder._quote).join(',')})`;
  }

  static _toColumnType(columnDef, forCreate) {
    let dbType;
    switch (columnDef.type) {
      case 'string': {
        dbType = FormatToDbTypeMap[columnDef.format];
        if (!dbType) dbType = TypeToDbTypeMap[columnDef.type];
        break;
      }
      case 'array': {
        dbType = TypeToDbTypeMap[columnDef.items.type] + '[]';
        break;
      }
      default: {
        dbType = TypeToDbTypeMap[columnDef.type];
      }
    }
    if (forCreate && columnDef.nullable === false) dbType += ' NOT NULL';
    return dbType;
  }

  static _toOrderSql(order) {
    if (order[1] === 1) {
      return `${SqlBuilder._quote(order[0])} ASC`;
    }
    if (order[1] === -1) {
      return `${SqlBuilder._quote(order[0])} DESC`;
    }
    throw new Error("Invalid direction.");
  }

  static _visitNode(node, values) {
    let sql = '';
    const key = Object.keys(node)[0];
    const value = node[key];
    if (['or', 'and'].includes(key)) {
      const innerSqls = [];
      for (const child of value) {
        innerSqls.push(SqlBuilder._visitNode(child, values));
      }
      const sqlOperator = SqlOperators[key];
      sql += `(${innerSqls.join(` ${sqlOperator.operator} `)})`;
    } else {
      const operator = Object.keys(value)[0];
      const sqlOperator = SqlOperators[operator];
      const sqlValue = (sqlOperator.rhs || defaultRHS)(values.length + 1, sqlOperator.values ? value[operator].length : 1);
      sql += `${SqlBuilder._quote(key)} ${sqlOperator.operator} ${sqlValue}`;
      if (sqlOperator.values) {
        values.push(...value[operator]);
      } else if (sqlOperator.value) {
        values.push(sqlOperator.value(value[operator]));
      } else {
        values.push(value[operator]);
      }
    }
    return sql;
  }

  static _quote(col) {
    return `"${col}"`;
  }

  static _numberedPlaceHolder(index, colDef) {
    const forceType = colDef.isPrimaryKey ? '' : `::${SqlBuilder._toColumnType(colDef)}`;
    return `$${index + 1}${forceType}`;
  }

  static _namedPlaceHolder(x, colDef) {
    const forceType = colDef.isPrimaryKey ? '' : `::${SqlBuilder._toColumnType(colDef)}`;
    return `$/${x}/${forceType}`;
  }
}