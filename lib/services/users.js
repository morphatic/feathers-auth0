/* eslint-disable no-unused-vars */
const { Forbidden, BadRequest, NotImplemented } = require('@feathersjs/errors')
const merge = require('deepmerge')
const owasp = require('owasp-password-strength-test')
const { convert } = require('../helpers/feathers-to-lucene')
const { sort } = require('../helpers/sort')
const isEmail = require('../helpers/is-email')

module.exports = app => {
  const usersService = ({
    id = 'user_id',
    events = [],
    paginate = {},
    multi = false,
    path = '/auth0/users'
  } = {}) => ({
    id,
    events,
    paginate,
    multi,
    path,
    owasp,
    setup(app, path) {
      // store a reference to the app
      this.app = app

      // get a reference to the Auth0 client
      this.client = app.get('auth0ManagementClient')

      // get the default pagination settings
      this.paginate = app.get('paginate')

      // get the scopes available to the token
      this.scopes = app.get('auth0Scopes')

      // get the owasp config and configure owasp
      this.owasp.config(app.get('owasp'))

      // set the path, if not undefined
      if (path) this.path = path
    },
    async _getAll(params) {
      let users = []
      const options = { pagination: false, params, query: { per_page: 100, page: 0, search_engine: 'v3' } }
      const query = convert(options)
      while (users.length % 100 === 0) {
        users = users.concat(await this.client.getUsers(query))
        query.page += 1
      }
      return users
    },
    /**
     * TODO: Think about the merge strategy! Default is to concatenate
     *       array fields, but this obviously is not always going to
     *       be the correct approach, e.g. changing roles of a user.
     *
     * Deep merges metadata fields for users being updated
     *
     * @param {object} user A user whose metadata may need merging
     * @param {object} data An object maybe containing metadata to update
     */
    _mergeMetadata(user, data) {
      // if we have to merge app_metadata or user_metadata
      let merged = JSON.parse(JSON.stringify(data))
      if (data.app_metadata || data.user_metadata) {
        // deep merge the app_metadata, if necessary
        if (data.app_metadata) {
          merged.app_metadata = merge(user.app_metadata, data.app_metadata)
        }
        // deep merge the user_metadata, if necessary
        if (data.user_metadata) {
          merged.user_metadata = merge(user.user_metadata, data.user_metadata)
        }
      }
      return merged
    },
    _checkScope(scope) {
      // if the appropriate scope does not already exist
      if (!this.scopes || !this.scopes.includes(scope)) {
        // check to see if perhaps the scopes have been updated since
        // the service was initialized
        this.scopes = this.app.get('auth0Scopes')
        // now check again and return the result
        return (this.scopes && this.scopes.includes(scope))
      }
      // if all is OK
      return true
    },
    async find(params) {
      // throw an error if the token doesn't have the appropriate scopes
      if (!(this._checkScope('read:users') || this._checkScope('read:user_idp_tokens')))
        throw new Forbidden('The token must have `read:users` or `read:user_idp_tokens` scope to call this endpoint')
      // convert Feathers-style params into Auth0-style query
      const query = convert({ pagination: this.paginate, params })
      // then make the request to the Auth0 API
      return this.client.getUsers(query).then(
        result => {
          let users = result.users
          // if more than one `sort` field was specified, sort the results
          if (params.query && params.query.$sort && Object.keys(params.query.$sort).length > 1) {
            users = sort(users, params.query.$sort)
          }
          // cast the result back to FeathersJS result format
          // taking pagination into account
          return params.paginate === false || !this.paginate ? users : {
            total: result.total,
            limit: result.limit,
            skip: result.start,
            data: users
          }
        }
      )
    },
    async get(id, params) {
      // throw an error if the token doesn't have the appropriate scopes
      if (!(this._checkScope('read:users') || this._checkScope('read:user_idp_tokens')))
        throw new Forbidden('The token must have `read:users` or `read:user_idp_tokens` scope to call this endpoint')

      if (Object.keys(params).length > 0) {
        console.warn( // eslint-disable-line
          `WARNING: Although the Auth0 Management API allows a 'fields' property to accompany
           getUsersByEmail() and getUser() endpoint requests, the extra parameters are not
           implemented in the node-auth0 library. Unless and until the node-auth0 library is
           updated, users of this method will not be able to restrict the list of fields that
           are returned to the client.`
        )
      }

      // get the user from the Auth0 users endpoint by email or user_id
      if (isEmail(id)) {
        return this.client.getUsersByEmail(id).then(users => Promise.resolve(users[0] || {}))
      } else {
        return this.client.getUser({ id }).then(user => Promise.resolve(user || {}))
      }
    },
    async create(data, params) {
      /**
       * NOTE: This ONLY works for Username-Password-Authentication (i.e. stored within Auth0, not SSO)
       *       A valid password MUST be passed along with a confirmation
       */
      // throw an error if the token doesn't have the appropriate scopes
      if (!this._checkScope('create:users'))
        throw new Forbidden('The token must have `create:users` scope to call this endpoint')

      if (Object.keys(params).length > 0) {
        console.warn( // eslint-disable-line
          `WARNING: Although the Auth0 Management API allows a 'fields' property to accompany
           getUsersByEmail() and getUser() endpoint requests, the extra parameters are not
           implemented in the node-auth0 library. Unless and until the node-auth0 library is
           updated, users of this method will not be able to restrict the list of fields that
           are returned to the client.`
        )
      }

      // throw an error if a valid email and confirmation was not passed in
      if (!data.email || !isEmail(data.email) || !data.email_confirmed || data.email !== data.email_confirmed)
        throw new BadRequest('Email address was missing, malformed, or did not match confirmation')

      // throw an error if there are problems with the password
      if (!data.pw) throw new BadRequest('You must provide a valid password.')
      const quality = this.owasp.test(data.pw)
      if (!quality.strong) throw new BadRequest('Password is not strong enough', quality.errors)
      if (!data.pw_confirmed || data.pw !== data.pw_confirmed)
        throw new BadRequest('The password and confirmation did not match.')

      // set up the minimal data necessary to create a new user
      const newUser = {
        email: data.email,
        password: data.pw,
        connection: 'Username-Password-Authentication',
        verify_email: true
      }

      /**
       * TODO: Are there any metadata properties we want to explicitly disallow?
       */
      // validate 'extra' data sent along with the required user data
      if (data.extra && Object.keys(data.extra).length > 0) {
        // we have additional fields to add
        Object.keys(data.extra).forEach(key => {
          if (!['user_metadata', 'app_metadata', 'given_name', 'family_name', 'name', 'nickname', 'picture'].includes(key)) {
            throw new BadRequest('The extra data passed is malformed or not permitted.')
          } else {
            newUser[key] = data.extra[key]
          }
        })
      }

      // attempt to create the user
      return this.client.createUser(newUser)
    },
    async update() { throw new NotImplemented() }, // Auth0 doesn't support replacing user records
    async patch(id, data, params) {
      // throw an error if the token doesn't have the appropriate scopes
      if (!(this._checkScope('update:users') || this._checkScope('update:users_app_metadata')))
        throw new Forbidden('The token must have `update:users` or `update:users_app_metadata` scope to call this endpoint')

      // create a list of updatable keys
      const updatable = [
        'connection',
        'client_id',
        'email',
        'email_confirmed',
        'email_verified',
        'verify_email',
        'password',
        'password_confirmed',
        'phone_number',
        'phone_number_confirmed',
        'verify_phone_number',
        'phone_verified',
        'user_metadata',
        'app_metadata',
        'username'
      ]
      // loop through the keys to be updated
      Object.keys(data).forEach(
        key => {
          // throw an error if we find a key that is not updatable
          if (!updatable.includes(key)) {
            if (key === 'blocked') {
              throw new BadRequest('Use the /auth0/blocks service to block/unblock a user.')
            } else {
              throw new BadRequest(`The ${key} cannot be updated.`)
            }
          }
          // now handle specific keys
          if (key === 'password') {
            // don't allow bulk password updates
            if (id === null) throw new Forbidden('Bulk password updates not allowed.')
            const quality = this.owasp.test(data.password)
            if (!quality.strong) throw new BadRequest('Password is not strong enough', quality.errors)
            if (!data.password_confirmed || data.password !== data.password_confirmed)
              throw new BadRequest('The password and confirmation did not match.')
            // remove the confirmation from the data to be updated
            delete data.password_confirmed
          }
          if (key === 'email') {
            // don't allow bulk email updates
            if (id === null) throw new Forbidden('Bulk email updates not allowed.')
            // throw an error if a valid email and confirmation was not passed in
            if (!isEmail(data.email) || !data.email_confirmed || data.email !== data.email_confirmed)
              throw new BadRequest('Email address was malformed, or did not match confirmation')
            // remove the confirmation from the data to be updated
            delete data.email_confirmed
            // possibly mark the email for re-verification if not explicitly included already
            if (!data.verify_email) data.verify_email = true
          }
          if (key === 'phone_number') {
            // don't allow bulk phone number updates
            if (id === null) throw new Forbidden('Bulk phone number updates not allowed.')
            // throw an error if a valid phone_number and confirmation was not passed in
            if (!data.phone_number_confirmed || data.phone_number !== data.phone_number_confirmed)
              throw new BadRequest('Phone number confirmation was missing, or did not match')
            // remove the confirmation from the data to be updated
            delete data.phone_number_confirmed
            // possibly mark the phone number for re-verification if not explicitly included already
            if (!data.verify_phone_number) data.verify_phone_number = true
          }
          if (key === 'username') {
            // don't allow bulk username updates
            if (id === null) throw new Forbidden('Bulk username updates not allowed.')
          }
        }
      )

      // patch() multiple users if id === null
      // and service.multi === true || service.multi.includes( 'patch' )
      if (id === null) {
        // throw an error if this is not allowed
        if (this.multi !== true || (Array.isArray(this.multi) && !this.multi.includes('patch')))
          throw new Forbidden('Patching multiple users is not permitted.')

        // get an array of all of the users to be patched
        const users = await this._getAll(params)

        // loop through all of them and call the Auth0 patch users endpoint
        return Promise.all(
          users.map(
            function (u) {
              const newData = this._mergeMetadata(u, data)
              return this.client.updateUser({ id: u.user_id }, newData)
            }.bind(this)
          )
        )
      } else {
        // attempt to patch an individual user
        const user = await this.get(id)
        data = this._mergeMetadata(user, data)
        return this.client.updateUser({ id }, data)
      }
    },
    async remove(id, params) {
      // throw an error if the token doesn't have the appropriate scopes
      if (!this._checkScope('delete:users'))
        throw new Forbidden('The token must have `delete:users` scope to call this endpoint')

      // delete ALL users that meet certain criteria
      // this will only work if service.multi === true || [ 'remove' ]
      if (id === null && params.query) {
        // throw an error if this is not allowed
        if (this.multi !== true || (Array.isArray(this.multi) && !this.multi.includes('remove')))
          throw new Forbidden('Removing multiple users is not permitted.')

        // get an array of all of the users to be removed
        const users = await this._getAll(params)

        // loop through all of them and call the Auth0 delete users endpoint
        return Promise.all(
          users.map(
            function (u) {
              return this.client.deleteUser({ id: u.user_id })
            }.bind(this)
          )
        ).then(() => users)
      } else {
        // attempt to delete an individual user
        const user = await this.get(id)
        return this.client.deleteUser({ id: user.user_id }).then(() => user)
      }
    },
    async raw(method, query) {
      // this will run a raw query against a specified method of the Auth0 Management API
    }
  })

  app.use('/auth0/users', usersService())
}