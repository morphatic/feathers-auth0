const fs = require('fs')
const { inspect } = require('util') // eslint-disable-line
const faker = require('faker')
const Chance = require('chance')
const jsf = require('json-schema-faker')
const { sort } = require('../../../../lib/helpers/sort')

// import the schema to be generated
const userSchema = JSON.parse(fs.readFileSync(__dirname + '/user.schema.json', 'utf8'))

// enable faker and chance
jsf.extend('faker', () => {
  // add an ISO8601 property to faker
  faker.iso8601 = {}
  faker.iso8601.between = (from, to) => faker.date.between(from, to).toISOString()
  faker.connection = provider => provider === 'auth0' ? 'Username-Password-Authentication' : provider
  faker.isSocial = provider => provider !== 'auth0'
  return faker
})
jsf.extend('chance', () => new Chance())

// set jsf options
jsf.option({
  alwaysFakeOptionals: true,
  fixedProbabilities: true,
  resolveJsonPath: true
})

// create a wrapper that will allow us to create multiple users
const userWrapper = {
  type: 'array',
  minItems: 500,
  maxItems: 500,
  items: {
    $ref: 'auth0user'
  }
}
// generate the fakes
jsf.resolve(userWrapper, [userSchema]).then(
  users => {
    // remove the kludge user.identities[0].combined property
    users.forEach(user => {
      const id = user.identities[0]
      user.user_id = `${id.provider}|${id.user_id}`
    })
    // sort the results by created_at
    users = sort(users, { created_at: 1 })
    // console.log(inspect(users, false, null, true)) // eslint-disable-line
    // write the results out to a file
    fs.writeFile(__dirname + '/users.json', JSON.stringify(users, null, 2), null, err => {
      if (err) throw err.message
      console.log(`Wrote ${users.length} users to users.json`) // eslint-disable-line
    })
  }
).catch(err => console.log(err)) // eslint-disable-line