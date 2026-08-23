const supabase = require('../config/supabase');

const applyFilters = (query, filters = []) => {
  let nextQuery = query;

  filters.forEach((filter) => {
    const { type, column, value } = filter;
    if (value === undefined || value === null) {
      return;
    }

    if (type === 'eq') nextQuery = nextQuery.eq(column, value);
    if (type === 'neq') nextQuery = nextQuery.neq(column, value);
    if (type === 'gt') nextQuery = nextQuery.gt(column, value);
    if (type === 'gte') nextQuery = nextQuery.gte(column, value);
    if (type === 'lt') nextQuery = nextQuery.lt(column, value);
    if (type === 'lte') nextQuery = nextQuery.lte(column, value);
    if (type === 'in') nextQuery = nextQuery.in(column, value);
    if (type === 'ilike') nextQuery = nextQuery.ilike(column, value);
  });

  return nextQuery;
};

const throwIfError = (error, context = '') => {
  if (error) {
    const message = error.message || error.details || error.hint || JSON.stringify(error);
    const err = new Error(`Supabase error${context ? ` (${context})` : ''}: ${message}`);
    err.code = error.code;
    err.details = error.details;
    err.hint = error.hint;
    throw err;
  }
};

const selectMany = async (table, {
  select = '*',
  filters = [],
  order = null,
  limit = null,
  offset = null
} = {}) => {
  let query = applyFilters(supabase.from(table).select(select), filters);

  if (order?.column) {
    query = query.order(order.column, { ascending: order.ascending ?? true });
  }

  if (limit) {
    query = query.limit(limit);
  }

  if (offset) {
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error } = await query;
  throwIfError(error, `selectMany ${table}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`AUDIT selectMany [${table}] returned ${data?.length || 0} rows`, JSON.stringify(data, null, 2));
  }
  return data || [];
};

const selectOne = async (table, options = {}) => {
  const rows = await selectMany(table, { ...options, limit: 1 });
  return rows[0] || null;
};

const countRows = async (table, filters = []) => {
  let query = applyFilters(supabase.from(table).select('*', { count: 'exact', head: true }), filters);
  const { count, error } = await query;
  throwIfError(error, `countRows ${table}`);
  return Number(count || 0);
};

const insertOne = async (table, payload, select = '*') => {
  console.log(`AUDIT insertOne [${table}] payload:`, JSON.stringify(payload, null, 2));
  const { data, error } = await supabase.from(table).insert(payload).select(select).single();
  throwIfError(error, `insertOne ${table}`);
  console.log(`AUDIT insertOne [${table}] result:`, JSON.stringify(data, null, 2));
  return data;
};

const updateRows = async (table, filters, payload, select = '*') => {
  let query = applyFilters(supabase.from(table).update(payload).select(select), filters);
  const { data, error } = await query;
  throwIfError(error, `updateRows ${table}`);
  return data || [];
};

const deleteRows = async (table, filters, select = '*') => {
  let query = applyFilters(supabase.from(table).delete().select(select), filters);
  const { data, error } = await query;
  throwIfError(error, `deleteRows ${table}`);
  return data || [];
};

const upsertOne = async (table, payload, options = {}, select = '*') => {
  const { data, error } = await supabase.from(table).upsert(payload, options).select(select).single();
  throwIfError(error, `upsertOne ${table}`);
  return data;
};

module.exports = {
  supabase,
  selectMany,
  selectOne,
  countRows,
  insertOne,
  updateRows,
  deleteRows,
  upsertOne
};
