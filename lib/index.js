const errors = require('@feathersjs/errors')
const { ManagementClient } = require('auth0')

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
}