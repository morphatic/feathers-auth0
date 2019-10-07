const fs = require('fs')
const { expect } = require('chai')
const feathers = require('@feathersjs/feathers')
const config = require('@feathersjs/configuration')
const adapter = require('../../lib')
const mockAuth0Client = require('../mock')
const allScopesJWT = JSON.parse(fs.readFileSync(__dirname + '/../mock/jwts/all_scopes.json', 'utf8'))

// import the function to be tested
const setupScopes = require('../../lib/helpers/setup-scopes')

describe('setupScopes() helper function', () => {
  let app
  before(() => {
    // create a new feathers app
    app = feathers()
    // read in the default config
    app.configure(config())
  })

  it('gets an access token from Auth0 and sets up global scopes', async () => {
    // initialize the adapter for this plugin
    app.configure(adapter({ auth0Client: mockAuth0Client }))
    // parse the mocked scopes we're using for the test
    const scopes = allScopesJWT.payload.scope.split(' ')
    // call the function we're testing
    await setupScopes({ app })
    // then get the scopes set in the app config
    const auth0Scopes = app.get('auth0Scopes')
    // and check to see that they are what we expect
    expect(scopes).to.deep.equal(auth0Scopes)
  })

  it('throws an error if token cannot be retrieved', async () => {
    // create an Auth0 ManagementClient that will fail
    const client = mockAuth0Client({
      domain: 'example.auth0.com',
      clientId: 'your_client_id',
      clientSecret: 'scope_error'
    })
    // console.log(client.tokenProvider.getAccessToken())
    // set this as the client for the app
    app.set('auth0ManagementClient', client)
    app.set('auth0Scopes', undefined)
    try {
      // call the function we're testing
      await setupScopes({ app })
      expect.fail('Should never get here')
    } catch (error) {
      expect(error.message).to.equal('Could not get access token and set scopes.')
    }
  })
})
