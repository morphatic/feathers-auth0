/**
 * Mock Users service for use in testing
 */
const fs = require('fs')
const { inspect } = require('util')
const equal = require('deep-equal')

// return different things based on different query parameters
// start by getting our 'database' of 500 users
const db = JSON.parse(fs.readFileSync(__dirname + '/users.json', 'utf8'))
const overwriteMerge = (destinationArray, sourceArray, options) => sourceArray // eslint-disable-line
module.exports = {
  getUsers: query => {
    /**
     * Default query, i.e. no parameters passed to find()
     */
    if (equal(query, { per_page: 10, page: 0, include_totals: true, search_engine: 'v3' }))
      return Promise.resolve({ total: db.length, limit: 10, start: 0, users: db.slice(0, 10) })

    /**
     * params.paginate === false
     */
    if (equal(query, { per_page: 100, page: 0, include_totals: true, search_engine: 'v3' }))
      return Promise.resolve({ total: db.length, limit: 10, start: 0, users: db.slice(0, 100) })

    /**
     * sort on multiple criteria
     */
    if (equal(query, {
      per_page: 10,
      page: 0,
      include_totals: true,
      search_engine: 'v3',
      sort: 'app_metadata.roles[0]:1'
    }))
      return Promise.resolve({ total: db.length, limit: 10, start: 0, users: db.slice(0, 10) })

    /**
     * find the first page of users who last logged in before 2019-06-10
     */
    if (equal(query, {
      per_page: 100,
      page: 0,
      search_engine: 'v3',
      q: '((last_login:({* TO 2019-06-10T00:00:00.000Z})))'
    })) {
      const users = db
        .filter(u => u.last_login < '2019-06-10T00:00:00.000Z')
        .slice(query.page * query.per_page, (query.page + 1) * query.per_page)
      return Promise.resolve(users)
    }

    /**
     * find the second page of users who last logged in before 2019-06-10
     */
    if (equal(query, {
      per_page: 100,
      page: 1,
      search_engine: 'v3',
      q: '((last_login:({* TO 2019-06-10T00:00:00.000Z})))'
    })) {
      const users = db
        .filter(u => u.last_login < '2019-06-10T00:00:00.000Z')
        .slice(query.page * query.per_page, (query.page + 1) * query.per_page)
      return Promise.resolve(users)
    }

    /**
     * find the users who last logged in before 2019-06-02
     */
    if (equal(query, {
      per_page: 100,
      page: 0,
      search_engine: 'v3',
      q: '((last_login:({* TO 2019-06-03T00:00:00.000Z})))'
    })) {
      const users = db
        .filter(u => u.last_login < '2019-06-03T00:00:00.000Z')
        .slice(query.page * query.per_page, (query.page + 1) * query.per_page)
      return Promise.resolve(JSON.parse(JSON.stringify(users)))
    }

    /**
     * If none of the above conditions applied, throw an error
     */
    console.log(inspect(query, false, null, true)) // eslint-disable-line
    return Promise.reject('None of the test queries matched.')
  },
  getUsersByEmail: email => Promise.resolve(db.filter(u => u.email === email)),
  getUser: id => Promise.resolve(db.filter(u => u.user_id === id.id)[0]),
  createUser: data => {
    delete data.password
    delete data.verify_email
    return Promise.resolve({
      ...data,
      email_verified: false,
      updated_at: '2019-04-21T05:39:32.635Z',
      user_id: 'auth0|d9729feb74992cc3482b350163a1a010',
      identities: [{
        connection: 'Username-Password-Authentication',
        user_id: 'd9729feb74992cc3482b350163a1a010',
        provider: 'auth0',
        isSocial: false
      }],
      created_at: '2019-04-21T05:39:32.635Z',
      blocked_for: [],
      guardian_authenticators: []
    })
  },
  deleteUser: () => Promise.resolve(),
  updateUser: (id, data) => {
    const user = JSON.parse(JSON.stringify(db.filter(u => u.user_id === id.id)[0]))
    Object.keys(data).forEach(key => user[key] = data[key])
    return Promise.resolve(user)
  }
}