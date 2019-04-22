const fs = require('fs')
const { inspect } = require('util') // eslint-disable-line
const { expect } = require('chai')
const feathers = require('@feathersjs/feathers')
const config = require('@feathersjs/configuration')
const merge = require('deepmerge')
const mockAuth0Client = require('./mock')
const allScopesJWT = JSON.parse(fs.readFileSync(__dirname + '/mock/jwts/all_scopes.json', 'utf8'))
// import the adapter
const adapter = require('../lib')

describe('The FeathersJS Auth0 Management API Service', () => {
  let app
  before(() => {
    // create a new feathers app
    app = feathers()
    // read in the default config
    app.configure(config())

    // set default pagination
    app.set('paginate', { default: 10, max: 50 })
  })

  it('throws an error if the credentials are missing', async () => {
    app.set('auth0options', undefined)
    try {
      // initialize the Auth0 Management client
      await app.configure(adapter({ auth0Client: mockAuth0Client }))
    } catch (err) {
      expect(err.message).to.equal('Auth0 Management Client credentials have not been set correctly.')
    }
  })

  it('throws an error if the credentials are not correct', async () => {
    app.set('auth0options', {
      domain: 'bad.domain.com',
      clientId: 'your_client_id',
      clientSecret: 'your_client_secret'
    })
    try {
      // initialize the Auth0 Management client
      await app.configure(adapter({ auth0Client: mockAuth0Client }))
    } catch (err) {
      expect(err.message).to.equal('Could not create Auth0 Management client.')
    }
  })

  it('sets the Auth0 scopes correctly', async () => {
    app.set('auth0options', {
      domain: 'example.auth0.com',
      clientId: 'your_client_id',
      clientSecret: 'your_client_secret'
    })
    await app.configure(adapter({ auth0Client: mockAuth0Client }))
    const scopes = allScopesJWT.payload.scope.split(' ')
    expect(scopes).to.deep.equal(app.get('auth0Scopes'))
  })

  describe('User Manager', () => {
    let userService
    before(() => {
      // configure the users service
      userService = app.service('/auth0/users')
    })

    describe('find()', () => {
      it('will throw an error if the appropriate scopes do not exist', async () => {
        // set app-wide scopes configuration to []
        const scopes = app.get('auth0Scopes')
        app.set('auth0Scopes', [])
        app.setup()

        // run a query
        let message
        try {
          await userService.find()
        } catch (err) { message = err.message }
        expect(message).to.equal('The token must have `read:users` or `read:user_idp_tokens` scope to call this endpoint')

        // reset the app-wide scopes back to what they were
        app.set('auth0Scopes', scopes)
        app.setup()
      })

      it('can find users in the standard way', async () => {
        const users = await userService.find()
        expect(users.data).to.be.an('array')
        expect(users.data.length).to.equal(10)
      })

      it('will return just an array of users if default pagination === false', async () => {
        // set app-wide paginate configuration to false
        app.set('paginate', false)
        app.setup()

        // run the query
        const users = await userService.find()

        // reset the app-wide pagination back to normal default
        app.set('paginate', { default: 10, max: 50 })
        app.setup()

        // verify our expectations
        expect(users).to.be.an('array')
        expect(users.length).to.equal(100)
      })

      it('will return just an array of users if params.paginate === false', async () => {
        const users = await userService.find({ paginate: false })
        expect(users).to.be.an('array')
        expect(users.length).to.equal(100)
      })

      it('will sort on multiple criteria', async () => {
        // NOTE: the expected results apply multisort ONLY to the first 10
        // records in the users.json mock data file. In an actual use, the
        // full list of 500 users would be sorted by role first, and then
        // the 2nd (and subsequent) criteria would be applied within each
        // page of results that came back. This is not ideal, but it's not
        // clear that a more robust client-side solution to this problem is
        // really warranted. We might just want to list sorting as a limitation.
        const expected = JSON.parse(fs.readFileSync(__dirname + '/mock/services/users/multisort.users.json', 'utf8'))
        const users = await userService.find({
          query: {
            $sort: {
              'app_metadata.roles[0]': 1,
              'logins_count': -1
            }
          }
        })
        expect(users.data).to.deep.equal(expected)
      })
    })

    describe('get()', () => {
      it('will throw an error if the appropriate scopes do not exist', async () => {
        // set app-wide scopes configuration to []
        const scopes = app.get('auth0Scopes')
        app.set('auth0Scopes', [])
        app.setup()

        // run a query
        let message
        try { await userService.get('someId') } catch (err) { message = err.message }
        expect(message).to.equal(
          'The token must have `read:users` or `read:user_idp_tokens` scope to call this endpoint'
        )

        // reset the app-wide scopes back to what they were
        app.set('auth0Scopes', scopes)
        app.setup()
      })

      it('will get a user by email', async () => {
        const user = await userService.get('Rodrigo81@gmail.com')
        expect(user.given_name).to.equal('Rodrigo')
        expect(user.family_name).to.equal('Hirthe')
      })

      it('will get a user by user_id', async () => {
        const user = await userService.get('google-oauth2|19dc9c8570a2012d2ccdb5e7')
        expect(user.given_name).to.equal('Deion')
        expect(user.family_name).to.equal('Schaefer')
      })

      it('will return an empty object for a non-existent email address', async () => {
        const user = await userService.get('does.not.exist@example.com')
        expect(user).to.be.an('object').that.is.empty
      })

      it('will return an empty object for a non-existent user_id', async () => {
        const user = await userService.get('auth0|doesnotexist')
        expect(user).to.be.an('object').that.is.empty
      })
    })

    describe('create()', () => {
      it('will throw an error if the appropriate scopes do not exist', async () => {
        // set app-wide scopes configuration to []
        const scopes = app.get('auth0Scopes')
        app.set('auth0Scopes', [])
        app.setup()

        // run a query
        let msg
        try { await userService.create({}) } catch (err) { msg = err.message }
        expect(msg).to.equal('The token must have `create:users` scope to call this endpoint')

        // reset the app-wide scopes back to what they were
        app.set('auth0Scopes', scopes)
        app.setup()
      })

      it('will throw an error if the email is not passed', async () => {
        let msg
        try { await userService.create({}) } catch (err) { msg = err.message }
        expect(msg).to.equal('Email address was missing, malformed, or did not match confirmation')
      })

      it('will throw an error if the email is malformed', async () => {
        let message
        try {
          await userService.create({ email: 'somebody@example', email_confirmed: 'somebody@example' })
        } catch (err) { message = err.message }
        expect(message).to.equal('Email address was missing, malformed, or did not match confirmation')
      })

      it('will throw an error if the email confirmation is not passed', async () => {
        let message
        try {
          await userService.create({ email: 'somebody@example.com' })
        } catch (err) { message = err.message }
        expect(message).to.equal('Email address was missing, malformed, or did not match confirmation')
      })

      it('will throw an error if the email confirmation does not match', async () => {
        let message
        try {
          await userService.create({ email: 'somebody@example.com', email_confirmed: 'somebody@example' })
        } catch (err) { message = err.message }
        expect(message).to.equal('Email address was missing, malformed, or did not match confirmation')
      })

      it('will throw an error if no password is passed', async () => {
        let message
        try {
          await userService.create({
            email: 'somebody@example.com',
            email_confirmed: 'somebody@example.com'
          })
        } catch (err) { message = err.message }
        expect(message).to.equal('You must provide a valid password.')
      })

      it('will throw an error if the password is not strong enough', async () => {
        let message, errors
        try {
          await userService.create({
            email: 'somebody@example.com',
            email_confirmed: 'somebody@example.com',
            pw: 'iamweak'
          })
        } catch (err) {
          message = err.message
          errors = err.data
        }
        expect(message).to.equal('Password is not strong enough')
        expect(errors.length).to.equal(4)
        // console.log(err.data) // eslint-disable-line
      })

      it('will throw an error if the password confirmation is not passed', async () => {
        let message
        try {
          await userService.create({
            email: 'somebody@example.com',
            email_confirmed: 'somebody@example.com',
            pw: 'Iam1$trongPassword'
          })
        } catch (err) { message = err.message }
        expect(message).to.equal('The password and confirmation did not match.')
      })

      it('will throw an error if the password confirmation does not match', async () => {
        let message
        try {
          await userService.create({
            email: 'somebody@example.com',
            email_confirmed: 'somebody@example.com',
            pw: 'Iam1$trongPassword',
            pw_confirmed: 'idonotmatch'
          })
        } catch (err) { message = err.message }
        expect(message).to.equal('The password and confirmation did not match.')
      })

      it('will create a new user if all required data is present and valid', async () => {
        const newUser = await userService.create({
          email: 'somebody@example.com',
          email_confirmed: 'somebody@example.com',
          pw: 'Iam1$trongPassword',
          pw_confirmed: 'Iam1$trongPassword'
        })
        expect(newUser.email).to.equal('somebody@example.com')
        expect(newUser.user_id).to.equal('auth0|d9729feb74992cc3482b350163a1a010')
      })

      it('will throw an error if additional data is passed that does not conform to the spec', async () => {
        let message
        try {
          await userService.create({
            email: 'somebody@example.com',
            email_confirmed: 'somebody@example.com',
            pw: 'Iam1$trongPassword',
            pw_confirmed: 'Iam1$trongPassword',
            extra: {
              invalid: 'I am not a valid extra field'
            }
          })
        } catch (err) { message = err.message }
        expect(message).to.equal('The extra data passed is malformed or not permitted.')
      })

      it('will create a new user if all required and extra data is present and valid', async () => {
        const newUser = await userService.create({
          email: 'somebody@example.com',
          email_confirmed: 'somebody@example.com',
          pw: 'Iam1$trongPassword',
          pw_confirmed: 'Iam1$trongPassword',
          extra: {
            app_metadata: {
              roles: [
                'member'
              ]
            },
            user_metadata: {
              profileComplete: false
            },
            given_name: 'Some',
            family_name: 'Body',
            name: 'Some Body',
            nickname: 'Sommie',
            picture: 'http://lorempixel.com/60/60/people'
          }
        })
        expect(newUser.app_metadata).to.deep.equal({ roles: ['member'] })
        expect(newUser.user_metadata).to.deep.equal({ profileComplete: false })
        expect(newUser.given_name).to.equal('Some')
        expect(newUser.family_name).to.equal('Body')
        expect(newUser.name).to.equal('Some Body')
        expect(newUser.nickname).to.equal('Sommie')
        expect(newUser.picture).to.equal('http://lorempixel.com/60/60/people')
      })
    })

    describe('update()', () => {
      it('will throw a NotImplemented error if update() is called', async () => {
        let name
        try { await userService.update('someId', {}) } catch (err) { name = err.name }
        // console.log(inspect(err, false, null, true)) // eslint-disable-line
        expect(name).to.equal('NotImplemented')
      })
    })

    describe('patch()', () => {
      let patched_user, patched_users
      before(() => {
        const db = JSON.parse(fs.readFileSync(__dirname + '/mock/services/users/users.json', 'utf8'))
        const data = { app_metadata: { inactive: true } }
        patched_user = JSON.parse(JSON.stringify(db[0]))
        patched_user = merge(patched_user, data)
        patched_users = JSON.parse(JSON.stringify(db.filter(u => u.last_login < '2019-06-03T00:00:00.000Z')))
        patched_users = patched_users.map(u => merge(u, data))
        console.log(inspect(patched_users.length, false, null, true)) // eslint-disable-line
      })


      it('will throw an error if the appropriate scopes do not exist', async () => {
        // set app-wide scopes configuration to []
        const scopes = app.get('auth0Scopes')
        app.set('auth0Scopes', [])
        app.setup()

        // run a query
        let message
        try { await userService.patch('someId', {}) } catch (err) { message = err.message }
        expect(message).to.equal(
          'The token must have `update:users` or `update:users_app_metadata` scope to call this endpoint'
        )

        // reset the app-wide scopes back to what they were
        app.set('auth0Scopes', scopes)
        app.setup()
      })

      it('should throw an error if the patch() data contains the \'blocked\' key', async () => {
        let message
        try {
          await userService.patch('someId', { blocked: true })
        } catch (err) { message = err.message }
        expect(message).to.equal('Use the /auth0/blocks service to block/unblock a user.')
      })

      it('should throw an error if the patch() data contains an unknown key', async () => {
        let message
        try {
          await userService.patch('someId', { idontexist: true })
        } catch (err) { message = err.message }
        expect(message).to.equal('The idontexist cannot be updated.')
      })

      it('should throw an error for bulk password update attempts', async () => {
        let message
        try {
          await userService.patch(null, { password: 'I am an amazingly secure password' })
        } catch (err) { message = err.message }
        expect(message).to.equal('Bulk password updates not allowed.')
      })

      it('should throw an error for bulk email update attempts', async () => {
        let message
        try {
          await userService.patch(null, { email: 'nobody@example.com' })
        } catch (err) { message = err.message }
        expect(message).to.equal('Bulk email updates not allowed.')
      })

      it('should throw an error for bulk phone_number update attempts', async () => {
        let message
        try {
          await userService.patch(null, { phone_number: '8005551212' })
        } catch (err) { message = err.message }
        expect(message).to.equal('Bulk phone number updates not allowed.')
      })

      it('should throw an error for bulk username update attempts', async () => {
        let message
        try {
          await userService.patch(null, { username: 'god' })
        } catch (err) { message = err.message }
        expect(message).to.equal('Bulk username updates not allowed.')
      })

      it('will throw an error if the password is not strong enough', async () => {
        let message, errors
        try {
          await userService.patch('someId', {
            password: 'iamweak'
          })
        } catch (err) {
          message = err.message
          errors = err.data
        }
        expect(message).to.equal('Password is not strong enough')
        expect(errors.length).to.equal(4)
      })

      it('will throw an error if the password confirmation is missing', async () => {
        let message
        try {
          await userService.patch('someId', {
            password: 'I am a super strong password'
          })
        } catch (err) { message = err.message }
        expect(message).to.equal('The password and confirmation did not match.')
      })

      it('will throw an error if the password is not confirmed', async () => {
        let message
        try {
          await userService.patch('someId', {
            password: 'I am a super strong password',
            password_confirmed: 'I am not the same as super strong password'
          })
        } catch (err) { message = err.message }
        expect(message).to.equal('The password and confirmation did not match.')
      })

      it('will throw an error if the email confirmation is missing', async () => {
        let message
        try {
          await userService.patch('someId', {
            email: 'nobody@example.com'
          })
        } catch (err) { message = err.message }
        expect(message).to.equal('Email address was malformed, or did not match confirmation')
      })

      it('will throw an error if the email is not confirmed', async () => {
        let message
        try {
          await userService.patch('someId', {
            email: 'nobody@example.com',
            email_confirmed: 'not.nobody@example.com'
          })
        } catch (err) { message = err.message }
        expect(message).to.equal('Email address was malformed, or did not match confirmation')
      })

      it('will throw an error if the phone_number confirmation is missing', async () => {
        let message
        try {
          await userService.patch('someId', {
            phone_number: '8005551212'
          })
        } catch (err) { message = err.message }
        expect(message).to.equal('Phone number confirmation was missing, or did not match')
      })

      it('will throw an error if the phone_number is not confirmed', async () => {
        let message
        try {
          await userService.patch('someId', {
            phone_number: '8005551212',
            phone_number_confirmed: '8006661212'
          })
        } catch (err) { message = err.message }
        expect(message).to.equal('Phone number confirmation was missing, or did not match')
      })

      it('will throw an error if multi-user patch attempted and `multi` is not set on the service', async () => {
        // update the 'multi' setting on the service
        const multi = userService.multi
        userService.multi = false
        let message
        try {
          await userService.patch(null, { app_metadata: { account_delinquent: true } })
        } catch (err) { message = err.message }
        expect(message).to.equal('Patching multiple users is not permitted.')
        // set the setting back to what they were
        userService.multi = multi
      })

      it('it will patch an individual user and return the updated user', async () => {
        const result = await userService.patch('auth0|07e25d0261590d8da45cef0b', { app_metadata: { inactive: true } })
        expect(result).to.deep.equal(patched_user)
      })

      it('it will patch multiple users and return the updated users', async () => {
        // update the 'multi' setting on the service
        const multi = userService.multi
        userService.multi = true
        // add app_metadata.inactive to true for users who haven't logged in since before 2019-06-02
        // (in the test data set, `last_login` is generated from 2019-06-01 to 2019-06-30)
        const june2nd2019 = '2019-06-03T00:00:00.000Z'
        const result = await userService.patch(
          null,
          { app_metadata: { inactive: true } },
          { query: { last_login: { $lt: june2nd2019 } } }
        )
        expect(result).to.deep.equal(patched_users)
        // set the setting back to what they were
        userService.multi = multi
      })
    })

    describe('remove()', () => {
      let removed_user, removed_users
      before(() => {
        const db = JSON.parse(fs.readFileSync(__dirname + '/mock/services/users/users.json', 'utf8'))
        removed_user = db[0]
        removed_users = db.filter(u => u.last_login < '2019-06-10T00:00:00.000Z')
      })

      it('will throw an error if the appropriate scopes do not exist', async () => {
        // set app-wide scopes configuration to []
        const scopes = app.get('auth0Scopes')
        app.set('auth0Scopes', [])
        app.setup()

        // run a query
        let message
        try { await userService.remove('someId') } catch (err) { message = err.message }
        expect(message).to.equal('The token must have `delete:users` scope to call this endpoint')

        // reset the app-wide scopes back to what they were
        app.set('auth0Scopes', scopes)
        app.setup()
      })

      it('will throw an error if an id is not passed', async () => {
        let message
        try { await userService.remove() } catch (err) { message = err.message }
        expect(message).to.equal('An id must be provided to the \'remove\' method')
      })

      it('will remove the user by user_id and return the removed user', async () => {
        const result = await userService.remove('auth0|07e25d0261590d8da45cef0b')
        expect(result).to.deep.equal(removed_user)
      })

      it('will remove the user by email and return the removed user', async () => {
        const result = await userService.remove('Frances_Corkery54@gmail.com')
        expect(result).to.deep.equal(removed_user)
      })

      it('will throw an error if multi-user delete attempted and `multi` is not set on the service', async () => {
        // update the 'multi' setting on the service
        const multi = userService.multi
        userService.multi = false
        let message
        try {
          const june10th2019 = '2019-06-10T00:00:00.000Z'
          await userService.remove(null, { query: { last_login: { $lt: june10th2019 } } })
        } catch (err) { message = err.message }
        expect(message).to.equal('Removing multiple users is not permitted.')
        // set the setting back to what they were
        userService.multi = multi
      })

      it('will delete multiple users if query params are passed and return the removed users', async () => {
        // update the 'multi' setting on the service
        const multi = userService.multi
        userService.multi = true
        // try to delete users who haven't logged in since before 2019-06-02
        // (in the test data set, `last_login` is generated from 2019-06-01 to 2019-06-30)
        const june10th2019 = '2019-06-10T00:00:00.000Z'
        const result = await userService.remove(null, { query: { last_login: { $lt: june10th2019 } } })
        expect(result).to.deep.equal(removed_users)
        // set the setting back to what they were
        userService.multi = multi
      })
    })
  })
})
