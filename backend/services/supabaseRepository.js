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

const throwIfError = (error) => {
  if (error) {
    throw error;
  }
};

const selectMany = async (table, {
  select = '*',
  filters = [],
  order = null,
  limit = null
} = {}) => {
  let query = applyFilters(supabase.from(table).select(select), filters);

  if (order?.column) {
    query = query.order(order.column, { ascending: order.ascending ?? true });
  }

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  throwIfError(error);
  return data || [];
};

const selectOne = async (table, options = {}) => {
  const rows = await selectMany(table, { ...options, limit: 1 });
  return rows[0] || null;
};

const countRows = async (table, filters = []) => {
  let query = applyFilters(supabase.from(table).select('*', { count: 'exact', head: true }), filters);
  const { count, error } = await query;
  throwIfError(error);
  return Number(count || 0);
};

const insertOne = async (table, payload, select = '*') => {
  const { data, error } = await supabase.from(table).insert(payload).select(select).single();
  throwIfError(error);
  return data;
};

const updateRows = async (table, filters, payload, select = '*') => {
  let query = applyFilters(supabase.from(table).update(payload).select(select), filters);
  const { data, error } = await query;
  throwIfError(error);
  return data || [];
};

const deleteRows = async (table, filters, select = '*') => {
  let query = applyFilters(supabase.from(table).delete().select(select), filters);
  const { data, error } = await query;
  throwIfError(error);
  return data || [];
};

const upsertOne = async (table, payload, options = {}, select = '*') => {
  const { data, error } = await supabase.from(table).upsert(payload, options).select(select).single();
  throwIfError(error);
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
