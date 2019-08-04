const errors = require('@feathersjs/errors')
const { ManagementClient } = require('auth0')
const jwt = require('jsonwebtoken')

// import services
const users = require('./services/users')
const tickets = require('./services/tickets')

module.exports = ({
  auth0Client = ManagementClient
} = {}) => app => {
  // get the Auth0 credentials from the app config
  const creds = app.get('auth0options')

  // throw an error if the credentials have not been set
  if (!creds || !creds.domain || !creds.clientId || !creds.clientSecret)
    throw new errors.NotImplemented('Auth0 Management Client credentials have not been set correctly.')

  // create a new Auth0 Management Client
  let client
  try {
    client = new auth0Client(creds)
  } catch (err) {
    throw new errors.GeneralError('Could not create Auth0 Management client.', err)
  }

  // store the client for use by other modules
  app.set('auth0ManagementClient', client)

  // instantiate services
  app.configure(users)
  app.configure(tickets)

  // get an access token from Auth0 and store scopes
  client.tokenProvider.getAccessToken()
    // then when we receive the token
    .then(token => {
      // decode it
      token = jwt.decode(token)
      // store the available scopes in settings
      app.set('auth0Scopes', token.scope.split(' '))
    })
    // throw an error if there's a problem
    .catch(() => {
      throw new errors.GeneralError('Could not get access token and set scopes.')
    })
}