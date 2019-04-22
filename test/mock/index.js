/**
 * Mock Auth0 Management Client
 * for use in testing
 */
const fs = require('fs')
const userService = require('./services/users')
const mockToken = fs.readFileSync(__dirname + '/jwts/all_scopes.jwt', 'utf8')

module.exports = function (creds) {
  if (!creds || !creds.domain || !creds.clientId || !creds.clientSecret)
    throw 'Management API SDK options must be an object'

  if (creds.domain === 'bad.domain.com') throw 'Must provide a valid domain'

  return {
    tokenProvider: {
      getAccessToken: () => Promise.resolve(mockToken)
    },
    ...userService
  }
}