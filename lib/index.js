const errors = require('@feathersjs/errors')
const auth0ManagementClient = require('auth0').ManagementClient
const jwt = require('jsonwebtoken')

// import services
const users = require('./services/users')

module.exports = ({
  auth0Client = auth0ManagementClient
} = {}) => async app => {
  // get the Auth0 creditials from the app config
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

  try {
    // get the access token
    const tok = await client.tokenProvider.getAccessToken()
    // decode it
    const token = jwt.decode(tok)
    // get the available scopes
    const scopes = token.scope.split(' ')
    // store the scopes for use by other modules
    app.set('auth0Scopes', scopes)
  } catch (err) {
    throw new errors.GeneralError('Could not get access token and set scopes.')
  }
}