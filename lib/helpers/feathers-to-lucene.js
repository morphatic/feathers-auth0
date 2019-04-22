/**
 * Helper functions for converting queries from FeathersJS
 * syntax into the Lucene syntax used by Auth0
 */
const errors = require('@feathersjs/errors')
/**
 * Pipe function for composing a series of functions where the output
 * from the previous becomes the input the subsequent throughout the whole
 * chain of functions. From {@link https://medium.com/javascript-scene/javascript-factory-functions-with-es6-4d224591a8b1|Eric Elliott}.
 *
 * @param  {...function} fns A collection of functions to be piped together
 */
const pipe = (...fns) => x => fns.reduce((y, f) => f(y), x)

/**
 * Parses the paging-related parts of the query.
 *
 * @param   {object} obj            An object containing query parameters and defaults
 * @param   {object} obj.pagination REQUIRED: The default pagination settings for the app
 * @param   {object} [obj.params]   The params that were passed to the FeathersJS query
 * @param   {object} [obj.query]    The default Auth0 query object
 * @returns {object}                The `params` and mutated `query` objects
 */
const paging = ({
  pagination,
  params = {
    paginate: pagination
  },
  query = {
    per_page: 50, // Auth0 default page size
    page: 0,
    include_totals: true,
    search_engine: 'v3'
  }
} = {}) => {
  // make sure that params has a paginate property
  if (typeof params.paginate === 'undefined') params.paginate = pagination
  // extract the `paginate` property from the `params`, if available
  const paginate = typeof params.paginate === 'undefined' ? pagination : params.paginate
  // throw an error if paginate.default > paginate.max
  if (paginate !== false && paginate.default > paginate.max)
    throw new errors.BadRequest('Max results per page should not be greater than default.', paginate)
  // get `$limit` and `$skip` params, if available
  const { $limit, $skip } = params.query || {}
  if (paginate === false) {
    // pagination was explicitly turned off for this query
    // set page size to `$limit` if it exists and is < 100,
    // otherwise set to Auth0 max == 100
    query.per_page = $limit !== undefined && $limit < 100 ? $limit : 100
  } else {
    // console.log('paginate', paginate) // eslint-disable-line
    // specific pagination settings were passed; use them, but
    // don't let page size exceed 100, the max Auth0 will allow
    query.per_page = paginate.default > 100 ? 100 : paginate.default
    // allow `$limit` to override `paginate.default`
    if ($limit !== undefined) {
      // don't allow `$limit` to exceed the explicitly set max
      const per_page = paginate.max && $limit > paginate.max ? paginate.max : $limit
      // in any case, don't allow number of results to exceed Auth0 max of 100
      query.per_page = per_page > 100 ? 100 : per_page
    }
  }
  // throw an error if $skip is defined but is not an integer >= 0
  if ($skip !== undefined && (!Number.isInteger(+$skip) || +$skip < 0))
    throw new errors.BadRequest('$skip must be an integer value >= 0')
  // set which page we want returned, if necessary
  query.page = $skip || 0
  // return the params and the query so far
  return { params, query }
}

/**
 * Parses the part of the `params` related to sorting and mutates `query`
 * before passing it to the next function in the pipe. Note that Auth0 only
 * supports sorting on one field. If sorting on multiple fields is required
 * this will have to be done after the query result is acquired.
 *
 * @param   {object} obj            An object containing query parameters and defaults
 * @param   {object} [obj.params]   The params that were passed to the FeathersJS query
 * @param   {object} [obj.query]    The Auth0 version of the query as mutated so far
 * @returns {object}                The `params` and mutated `query` objects
 */
const sorting = ({ params, query }) => {
  // extract the $sort object from the query, if available
  const { $sort } = params.query || {}
  if ($sort !== undefined) {
    // get the sort fields
    const entries = Object.entries($sort)
    // throw an error if the first one is malformed
    if (!/-?1/.test(entries[0][1]))
      throw new errors.BadRequest('The value for the $sort field must be either 1 or -1.')
    query.sort = entries[0][0] + ':' + entries[0][1]
  }
  return { params, query }
}

/**
 * Parses the part of the `params` related to field selection and mutates `query`
 * before passing it to the next function in the pipe.
 *
 * @param   {object} obj            An object containing query parameters and defaults
 * @param   {object} [obj.params]   The params that were passed to the FeathersJS query
 * @param   {object} [obj.query]    The Auth0 version of the query as mutated so far
 * @returns {object}                The `params` and mutated `query` objects
 */

const selecting = ({ params, query }) => {
  // extract the $sort object from the query, if available
  const { $select } = params.query || {}
  if ($select !== undefined && $select.length > 0) {
    query.fields = $select.join(',')
  }
  // console.log('select', query) // eslint-disable-line
  return { params, query }
}

/**
 * Determines whether a thing is a JavaScript Object or not
 *
 * @param   {*}       thing The thing we want to examine
 * @returns {boolean}       Returns `true` if the thing is an Object
 */
const isObject = thing => thing === Object(thing)

/**
 * A reducer function that receives `pieces`, the accumulator, which is
 * an array of strings that will eventually be joined using ' AND ' to construct
 * the full query in Lucene syntax. It also receives a destructured array
 * containing a key/value pair of a single object property.
 *
 * @param   {string[]}      pieces Accumulator containing an array of strings representing query segments
 * @param   {string}        key    The key of an object property
 * @param   {string|object} val    The value of the object property; either a string or a sub-object
 * @returns {string[]}             Returns `pieces` after pushing a new query segment
 */
const parse = (pieces, [key, val]) => {
  // if the key is $or
  if (key === '$or') {
    // val should be an array of parseable objects; recurse
    const subs = val.map(v => Object.entries(v).reduce(parse, []).join(' AND '))
    pieces.push('(' + subs.join(') OR (') + ')')
  } else if (!['$limit', '$skip', '$sort', '$select'].includes(key)) {
    // we've got a parseable object
    let exp
    // check to see if val is scalar or an object
    if (isObject(val)) {
      // initialize an empty array to hold sub-expressions
      const subs = []
      // it's an object, so grab properties and convert them into expressions
      const keys = Object.keys(val)
      if (keys.includes('$ne')) {
        subs.push(`(NOT "${val.$ne}")`)
      }
      if (keys.includes('$in')) {
        subs.push('("' + val.$in.join('" OR "') + '")')
      }
      if (keys.includes('$nin')) {
        subs.push('(NOT "' + val.$nin.join('" AND NOT "') + '")')
      }
      if (keys.includes('$gt') && !(keys.includes('$lt') || keys.includes('$lte'))) {
        subs.push(`({${val.$gt} TO *})`)
      }
      if (keys.includes('$gte') && !(keys.includes('$lt') || keys.includes('$lte'))) {
        subs.push(`([${val.$gte} TO *])`)
      }
      if (keys.includes('$lt') && !(keys.includes('$gt') || keys.includes('$gte'))) {
        subs.push(`({* TO ${val.$lt}})`)
      }
      if (keys.includes('$lte') && !(keys.includes('$gt') || keys.includes('$gte'))) {
        subs.push(`([* TO ${val.$lte}])`)
      }
      if (keys.includes('$gt') && keys.includes('$lt')) {
        subs.push(val.$gt < val.$lt ? `({${val.$gt} TO ${val.$lt}})` : `({* TO ${val.$lt}} OR {${val.$gt} TO *})`)
      }
      if (keys.includes('$gt') && keys.includes('$lte')) {
        subs.push(val.$gt < val.$lte ? `({${val.$gt} TO ${val.$lte}])` : `([* TO ${val.$lte}] OR {${val.$gt} TO *})`)
      }
      if (keys.includes('$gte') && keys.includes('$lt')) {
        subs.push(val.$gte < val.$lt ? `([${val.$gte} TO ${val.$lt}})` : `({* TO ${val.$lt}} OR [${val.$gte} TO *])`)
      }
      if (keys.includes('$gte') && keys.includes('$lte')) {
        subs.push(val.$gte < val.$lte ? `([${val.$gte} TO ${val.$lte}])` : `([* TO ${val.$lte}] OR [${val.$gte} TO *])`)
      }
      // now join the subs into an expression
      exp = '(' + key + ':' + (subs.length > 1 ? '(' + subs.join(' AND ') + ')' : subs[0]) + ')'
    } else {
      // it's scalar so create an equality expression, or
      // if it has a * in it, then it should be treated as a wildcard expression
      exp = val.includes('*') ? `(${key}:${val})` : `(${key}:"${val}")`
    }
    pieces.push(exp)
  }
  return pieces
}

/**
 * Parses the actual fields used to search the database and constructs
 * a query in Lucene query syntax. See {@link https://lucene.apache.org/core/2_9_4/queryparsersyntax.html|this page}
 * for more details on options related to querying.
 *
 * @param   {object} obj            An object containing query parameters and defaults
 * @param   {object} [obj.params]   The params that were passed to the FeathersJS query
 * @param   {object} [obj.query]    The Auth0 version of the query as mutated so far
 * @returns {object}                The `params` and mutated `query` objects
 */
const parsing = ({ params, query }) => {
  if (typeof params.query !== 'undefined') {
    const q = '(' + Object.entries(params.query).reduce(parse, []).join(' AND ') + ')'
    if (q !== '()') query.q = q
  }
  return { params, query }
}

/**
 * Parses the actual fields used to search the database and constructs
 * a query in Lucene query syntax. See {@link https://lucene.apache.org/core/2_9_4/queryparsersyntax.html|this page}
 * for more details on options related to querying.
 *
 * @param   {object} obj            An object containing query parameters and defaults
 * @param   {object} [obj.params]   The params that were passed to the FeathersJS query
 * @param   {object} [obj.query]    The Auth0 version of the query as mutated so far
 * @returns {object}                The mutated `query` object extracted from its context
 */
const extracting = ({ query }) => query

/**
 * Converts a FeathersJS-style `params` object into an Auth0-style Management API
 * request object.
 *
 * @param   {object} obj            An object containing query parameters and defaults
 * @param   {object} obj.pagination REQUIRED: The default pagination settings for the app
 * @param   {object} [obj.params]   The params that were passed to the FeathersJS query
 * @param   {object} [obj.query]    The default Auth0 query object
 * @returns {object}                The `params` and mutated `query` objects
 */
const convert = pipe(paging, sorting, selecting, parsing, extracting)

module.exports = {
  paging,
  sorting,
  selecting,
  parse,
  parsing,
  convert
}