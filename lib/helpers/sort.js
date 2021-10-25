/**
 * External packages upon which this implementation relies:
 *  * {@link https://www.npmjs.com/package/fast-sort|fast-sort}
 *  * {@link https://www.npmjs.com/package/lodash.get|lodash.get}
 *
 * @module helpers/sort
 */
const { sort: fs } = require('fast-sort')
const get = require('lodash.get')

/**
 * Converts the sort specification object into the format required
 * by `fast-sort`. For more info, see the docs linked to above. It
 * assumes the `props` object conforms to the FeathersJS common API
 * {@link https://crow.docs.feathersjs.com/api/databases/querying.html#sort|$sort syntax}.
 *
 * @param   {object}   props An object containing sort keys as described below
 * @returns {object[]}       An array of objects of the format { asc|desc: keyname }
 */
const convertProps = props => Object.entries(props).map(
  ([key, order]) => {
    const k = key.includes('.') ? o => get(o, key) : key
    return order === 1 ? { asc: k } : { desc: k }
  }
)

/**
 * Defines a sort function that will sort an array of JavaScript
 * objects by multiple keys. The keys to sort by are specified in
 * an object of the following shape, where 1 === ascending order
 * and -1 === descending order. The order of the keys determines
 * their precedence in the resulting sorted array of objects.
 *
 * {
 *   key1: 1,
 *   key2: -1
 * }
 *
 * Internally it uses the npm `fast-sort` library.
 * It also uses `lodash.get` to create nested property accessors.
 * It will not mutate the input collection.
 *
 * @param   {object[]} collection The array of objects to be sorted
 * @param   {object}   props      The properties on which to sort
 * @returns {object[]}            A sorted copy of the input array
 */
const sort = (collection, props) => fs([...collection]).by(convertProps(props))

module.exports = { sort, convertProps }
