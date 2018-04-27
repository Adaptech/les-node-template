export default class SqlError extends Error {
  constructor(inner, sql, values) {
    super("Sql query failed: " + inner.message);
    Error.captureStackTrace(this, SqlError);
    this.name = "SqlError";
    this.inner = inner;
    this.sql = sql;
    this.values = values;
  }
}
