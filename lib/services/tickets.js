const { Forbidden, BadRequest, NotImplemented } = require('@feathersjs/errors')

module.exports = app => {
  const ticketsService = ({
    id = 'user_id',
    events = [],
    paginate = {},
    multi = false,
    path = '/auth0/tickets'
  } = {}) => ({
    id,
    events,
    paginate,
    multi,
    path,
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
    async setup (app, path) {
      // store a reference to the app
      this.app = app

      // get a reference to the Auth0 client
      this.client = app.get('auth0ManagementClient')

      // get the default pagination settings
      this.paginate = app.get('paginate')

      // get the scopes available to the token
      this.scopes = app.get('auth0Scopes')

      // set the path, if not undefined
      if (path) this.path = path
    },
    async find () {
      throw new NotImplemented(
        'The `auth0/tickets` service has no find() method. Use create(data, { type: \'email_verification|password_reset\' instead.'
      )
    },
    async get () {
      throw new NotImplemented(
        'The `auth0/tickets` service has no get() method. Use create(data, { type: \'email_verification|password_reset\' instead.'
      )
    },
    async create (data, params) {
      // throw an error if the token doesn't have the appropriate scope
      if (!this._checkScope('create:user_tickets'))
        throw new Forbidden('The token must have `create:user_tickets` scope to call this endpoint')

      // throw an error if the request type was not specified
      if (!params.type) throw new BadRequest('You must specify what kind of ticket to create (email_verification or password_reset).')

      // throw an error if the user_id was not set
      if (!data.user_id) throw new BadRequest('You must provide a valid user_id.')
      
      // if we're requesting a password change
      if (params.type === 'password_reset') {
        // make the request and return the result
        return this.client.createPasswordChangeTicket(data).then(() => 'ok')
      } else {
        // this is an email verification request
        // attempt to (re)send the email verification
        return this.client.createEmailVerificationTicket(data).then(() => 'ok')
      }
    },
    async patch () {
      throw new NotImplemented(
        'The `auth0/tickets` service has no patch() method. Use create(data, { type: \'email_verification|password_reset\' instead.'
      )
    },
    async update () {
      throw new NotImplemented(
        'The `auth0/tickets` service has no update() method. Use create(data, { type: \'email_verification|password_reset\' instead.'
      )
    },
    async remove () {
      throw new NotImplemented(
        'The `auth0/tickets` service has no remove() method. Use create(data, { type: \'email_verification|password_reset\' instead.'
      )
    }
  })

  app.use('/auth0/tickets', ticketsService())
}