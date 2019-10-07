const jwt = require('jsonwebtoken')
const { GeneralError } = require('@feathersjs/errors')

module.exports = async (context) => {
  // get the app from the context
  const { app } = context
  // check to see if the scopes have already been set
  const scopes = app.get('auth0Scopes')
  // if not
  if (!scopes) {
    // get the Auth0 ManagementClient
    const client = app.get('auth0ManagementClient')
    try {
      // try to get an access token
      const token = await client.tokenProvider.getAccessToken()
      // decode it
      const decoded = jwt.decode(token)
      // store scopes globally in the app configuration
      app.set('auth0Scopes', decoded.scope.split(' '))
    } catch (error) {
      return Promise.reject(new GeneralError('Could not get access token and set scopes.', error))
    }
  }
  // finally let the app know we're done
  return Promise.resolve()
}
