# FeathersJS Auth0 Management API Adapter

[![Build Status](https://travis-ci.org/morphatic/feathers-auth0.svg?branch=master)](https://travis-ci.org/morphatic/feathers-auth0)
[![Coverage Status](https://coveralls.io/repos/github/morphatic/feathers-auth0/badge.svg?branch=master)](https://coveralls.io/github/morphatic/feathers-auth0?branch=master)
![node](https://img.shields.io/node/v/@morphatic/feathers-auth0.svg)
![npm](https://img.shields.io/npm/v/@morphatic/feathers-auth0.svg)
![MIT](https://img.shields.io/npm/l/@morphatic/feathers-auth0.svg)

Creates the services necessary to use the [Auth0 Management API](https://auth0.com/docs/api/management/v2) with [FeathersJS](https://feathersjs.com).

:warning: **This package is designed to work with the [FeatherJS v4.0 (Crow)](https://crow.docs.feathersjs.com/), currently (2019-08-02) in pre-release.** :warning:

This package will **probably** work with older versions of FeathersJS, but if all you need is the Users API, you can install version 0.1.4.

## Installation

Installation is a 3-step process. First, add the package as a dependency to your FeathersJS project:

```shell
npm install -S @morphatic/feathers-auth0
```

Then, update `src/app.js` to include and configure it:

```js
// src/app.js

// at the top of the file where everything
// else gets imported...
const auth0 = require('@morphatic/feathers-auth0')

// ... other configuration ...

// add it in the middleware configuration section

app.configure(auth0())

// in any case, it should come BEFORE the 404 handler
app.use(express.notFound()) // <-- BEFORE this line
```

Third, you'll need to update your `config/default.json` file to add your Auth0 credentials. **YOU ARE STRONGLY DISCOURAGED FROM COMMITTING YOUR AUTH0 CREDENTIALS TO A PUBLIC REPOSITORY!!!** You may want to add the `config/` folder to your `.gitignore` to prevent your Auth0 secret key from getting inadvertently shared. In any case, you need to update your Feathers configuration to add the following:

```js
{
  // ... your other config settings ...
  "auth0options": {
    "domain": "example.auth0.com",
    "clientId": "your_client_id",
    "clientSecret": "your_client_secret"
  },
  "owasp": {
    "allowPassphrases": true,
    "maxLength": 128,
    "minLength": 15,
    "minPhraseLength": 20,
    "minOptionalTestsToPass": 4
  }
}
```

Note, that this package depends upon the [`owasp-password-strength-test`](https://www.npmjs.com/package/owasp-password-strength-test) which is used to make sure that new passwords created for Auth0 users conform to security best practices.

## :warning: Secure your API!!! :warning:

Out of the box, this plugin does **_NOT_** include any functionality that would restrict who or what can access your API endpoints. Therefore it is absolutely critical that you make sure you implement some sort of access control to your API. As a suggestion, you might use [`@morphatic/feathers-auth0-strategy`](https://www.npmjs.com/package/@morphatic/feathers-auth0-strategy), but you should always use _something_.

## Usage

This plugin is an adapter that creates services to wrap [Auth0 Management API](https://auth0.com/docs/api/management/v2) functions with an API that conforms to the [FeathersJS Common API](https://crow.docs.feathersjs.com/api/databases/common.html). Once installed, clients would access it using a FeathersJS client the way they would any other service. For example, to get a list of users associated with your Auth0 client:

```js
// create a FeathersJS REST client, with, e.g., axios
const feathers = require('@feathersjs/feathers-client')
const axios = require('axios')

const app = feathers()
const rc = feathers.rest('https://api.example.com') // the URL to your feathers API server
app.configure(rc.axios(axios))

// now get users
app.service('/auth0/users').find().then(
  users => {
    // do something with the retrieved list of users
  }
)
```

This plugin does NOT yet wrap _all_ of the Auth0 Management API functions. See below for the functions that have been implemented so far.

## Implemented Functions

Below is a list of implemented functions and notes about using them. If a function is not listed, it is (probably) not implemented (yet). Note, this package was never intended to implement the **_full_** Auth0 Management API, as a great deal of that functionality is more than adequately provided by Auth0's own user dashboard. However, for integrating Auth0 into the user management functionality of many apps, it is desirable to NOT have to switch back and forth between one's own app and Auth0. There are cases when some users of your app should be able to manage users, but not need access to the Auth0 dashboard. As such, most of the functions implemented here will concern user management.

### Users Endpoint

By using `app.service('/auth0/users')`, one can `find()`, `get()`, `create()`, `patch()`, and `remove()` users. Auth0 does not expose any functionality matching Feathers `update()`, so this method is not implemented. There are some other differences from the Feathers Common API, namely:

* **Search**<br>Auth0 considers asterisks (`*`) to be wildcards and so you can accomplish queries akin to using the SQL `LIKE` keyword. For example, to find users with gmail accounts you might do:<br>`app.service('/auth0/users').find({ query: { email: "*@gmail.com" } })`
* **Find by Email**<br>Since all Auth0 users are guaranteed to be associated with an email address, in addition to the regular Auth0 `user_id`, one can `get()` a user by submitting their email address in place of the `id`:<br>`app.service('/auth0/users/').get('somebody@example.com')`
* **Sort**<br>Auth0 does NOT support sorting on multiple fields. Therefore, if you include more than one field in the `$sort` clause of a Feathers query, the second and subsequent fields will be restricted to sorting the results from Auth0 on the _client_ side. This can result in unexpected result sets. It might be advisable to restrict sort to a single field at a time.
* **`$limit: 0`**<br>Auth0 does not have query syntax that allows replication of the fast count that would normally be returned by setting `$limit: 0` on a Feathers query. The result is just a normal page of results with zero results, but the overall total number of records is listed.
* **Multi**<br>By default, you **_cannot_** `patch()` or `remove()` multiple records at one time. If you would like to be able to do so, you need to alter your configuration as follows. In `src/app.js` when you make the call to `app.configure(auth0())` (as described above), you need to pass an object that has `multi` set to `true` or as an array of strings that contains either `patch`, `remove` or both, i.e. `app.configure(auth0({multi: true}))` or `app.configure(auth0({multi: ['patch']}))`. You can pass other configuration settings [as described in the Feathers `service` docs](https://crow.docs.feathersjs.com/api/databases/common.html). This setting cannot be altered from the client side. An error will be thrown if a client tries to perform an `patch()` or `remove()` operation on more than one record when `multi` has not been enabled.

### Tickets Endpoint

By using `app.service('/auth0/tickets')`, one can `create()` requests to reset users' passwords and (re)send the email verification email that is sent out when a person first signs up for your app. None of the other Feathers API functions are implemented for the `tickets` service as they do not match to any Auth0 API functionality.

The `data` parameter of the `create()` function typically is just an object containing the `user_id` of the user for whom the password is being reset or who needs to have the email verification message sent again. The `params` parameter of the `create()` function must contain a `type` property that has a value of either `password_reset` or `email_verification` to let the API know what kind of ticket should be created. For example:

```js
// get the user_id of, e.g., the currently logged in user
const user_id = this.$store.state.auth.user.user_id

// make a password reset request from the client
// this results in a password reset email being sent to the user's email address
try {
  await api.service('/auth0/tickets').create({ user_id, type: 'password_reset' })
} catch (error) {
  // errors are thrown, e.g., if the user_id is not found
  console.log(error)
}

// make an email verification request
// this results in an email verification link being sent to the user's email address
try {
  await api.service('/auth0/tickets').create({ user_id, type: 'email_verification' })
} catch (error) {
  // errors are thrown, e.g., if the user_id is not found
  console.log(error)
}
```

### Other Endpoints

At this time, no other endpoints have been implemented. In order of priority, the next endpoint that is planned for implementation is the `jobs` endpoint for batch import/export of users. Other endpoints will be added on an "as needed" or "as requested" basis. Pull requests are always welcome.

## Questions, Comments, Feedback

Please ask questions, or provide comments or feedback using the Issues tab above. Thanks!
