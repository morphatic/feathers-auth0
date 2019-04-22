const { expect } = require('chai')
const { paging, sorting, selecting, parsing, convert } = require('../../lib/helpers/feathers-to-lucene')

describe('A FeathersJS to Auth0/Lucene query converter that has', () => {
  describe('a paging() function that', () => {
    let pagination, query
    beforeEach(() => {
      pagination = {
        default: 10,
        max: 50
      }
      query = {
        per_page: 10,
        page: 0,
        include_totals: true,
        search_engine: 'v3'
      }
    })

    it('throws an error if default pagination is not provided', () => {
      expect(() => paging()).to.throw('Cannot read property \'default\' of undefined')
    })

    it('throws an error if paginate.default > paginate.max', () => {
      pagination = {
        default: 100,
        max: 50
      }
      expect(() => paging({ pagination })).to.throw('Max results per page should not be greater than default.')
    })

    it('will return a default query with appropriate default pagination', () => {
      expect(paging({ pagination })).to.deep.equal({
        params: {
          paginate: pagination
        },
        query
      })
    })

    it('will work fine even if params is passed as an empty object', () => {
      const params = {}
      expect(paging({ pagination, params })).to.deep.equal({
        params: {
          paginate: pagination
        },
        query
      })
    })

    it('will work fine even if params is passed as `undefined`', () => {
      const params = undefined
      expect(paging({ pagination, params })).to.deep.equal({
        params: {
          paginate: pagination
        },
        query
      })
    })

    it('will restrict per_page to 100 even if pagination.default > 100', () => {
      pagination = {
        default: 200,
        max: 200
      }
      query.per_page = 100
      expect(paging({ pagination })).to.deep.equal({
        params: {
          paginate: pagination
        },
        query
      })
    })

    it('will set per_page to 100 paginate == false and $limit is not set', () => {
      const params = { paginate: false }
      query.per_page = 100
      expect(paging({ pagination, params })).to.deep.equal({ params, query })
    })

    it('will set per_page to $limit if paginate == false and $limit <= 100', () => {
      const params = {
        paginate: false,
        query: {
          $limit: 25
        }
      }
      query.per_page = 25
      expect(paging({ pagination, params })).to.deep.equal({ params, query })
    })

    it('will set per_page to 100 if paginate == false and $limit > 100', () => {
      const params = {
        paginate: false,
        query: {
          $limit: 200
        }
      }
      query.per_page = 100
      expect(paging({ pagination, params })).to.deep.equal({ params, query })
    })

    it('will override pagination if paginate is set and $limit is not', () => {
      const params = {
        paginate: {
          default: 25,
          max: 75
        }
      }
      query.per_page = 25
      expect(paging({ pagination, params })).to.deep.equal({ params, query })
    })

    it('will limit per_page to 100 if paginate.default > 100 and $limit is not set', () => {
      const params = {
        paginate: {
          default: 200,
          max: 300
        }
      }
      query.per_page = 100
      expect(paging({ pagination, params })).to.deep.equal({ params, query })
    })

    it('will set per_page to $limit if $limit <= paginate.max', () => {
      const params = {
        paginate: {
          default: 25,
          max: 95
        },
        query: {
          $limit: 90
        }
      }
      query.per_page = 90
      expect(paging({ pagination, params })).to.deep.equal({ params, query })
    })

    it('will set per_page to paginate.max if $limit > paginate.max', () => {
      const params = {
        paginate: {
          default: 25,
          max: 95
        },
        query: {
          $limit: 150
        }
      }
      query.per_page = 95
      expect(paging({ pagination, params })).to.deep.equal({ params, query })
    })

    it('will limit per_page to 100 if $limit > 100 and paginate.max > 100', () => {
      const params = {
        paginate: {
          default: 25,
          max: 200
        },
        query: {
          $limit: 150
        }
      }
      query.per_page = 100
      expect(paging({ pagination, params })).to.deep.equal({ params, query })
    })

    it('throws an error if $skip is defined but is not an integer >= 0', () => {
      const params = {
        query: {
          $skip: -1
        }
      }
      expect(() => paging({ pagination, params })).to.throw('$skip must be an integer value >= 0')
    })

    it('will set page to the value of $skip, if it is set', () => {
      const params = {
        query: {
          $skip: 2
        }
      }
      query.page = 2
      expect(paging({ pagination, params })).to.deep.equal({ params, query })
    })
  })

  describe('a sorting() function that', () => {
    let params
    beforeEach(() => {
      params = {
        params: {
          paginate: {
            default: 10,
            max: 50
          },
          query: {
            $sort: {
              email: 1
            }
          }
        },
        query: {
          per_page: 10,
          page: 0,
          include_totals: true,
          search_engine: 'v3'
        }
      }
    })

    it('throws an error if the parameters are not well-formed', () => {
      params.params.query.$sort.email = 'asc'
      expect(() => sorting(params)).to.throw('The value for the $sort field must be either 1 or -1.')
    })

    it('returns the same parameters it was given if $sort is not set', () => {
      delete params.params.query.$sort
      expect(sorting(params)).to.deep.equal(params)
    })

    it('returns the query with an added $sort parameter', () => {
      expect(sorting(params).query.sort).to.equal('email:1')
    })

    it('adds only the first $sort field if there are several', () => {
      params.params.query.$sort = {
        email: 1,
        name: -1,
        address: 1
      }
      expect(sorting(params).query.sort).to.equal('email:1')
    })
  })

  describe('a selecting() function that', () => {
    let params
    beforeEach(() => {
      params = {
        params: {
          paginate: {
            default: 10,
            max: 50
          },
          query: {
            $sort: {
              email: 1
            },
            $select: [
              'email',
              'user_id',
              'picture',
              'app_metadata.roles'
            ]
          }
        },
        query: {
          per_page: 10,
          page: 0,
          include_totals: true,
          search_engine: 'v3',
          sort: 'email:1'
        }
      }
    })

    it('returns the parameters it was given if there are no fields to select', () => {
      delete params.params.query.$select
      expect(selecting(params)).to.deep.equal(params)
    })

    it('adds a `fields` property to the query with a comma-separated list of fields in $select', () => {
      const fields = params.params.query.$select.join(',')
      expect(selecting(params).query.fields).to.equal(fields)
    })

    it('returns the parameters it was given if $select contains an empty array', () => {
      params.params.query.$select = []
      expect(selecting(params).query).to.not.have.property('fields')
    })
  })

  describe('a parsing() function that', () => {
    let params
    beforeEach(() => {
      params = {
        params: {
          paginate: {
            default: 10,
            max: 50
          },
          query: {
            $sort: {
              email: 1
            },
            $select: [
              'email',
              'user_id',
              'picture',
              'app_metadata.roles'
            ]
          }
        },
        query: {
          per_page: 10,
          page: 0,
          include_totals: true,
          search_engine: 'v3',
          sort: 'email:1'
        }
      }
    })

    it('returns the same params it was given if there are no queryable fields', () => {
      expect(parsing(params)).to.deep.equal(params)
    })

    it('correctly parses an equality query', () => {
      params.params.query.email = 'somebody@example.com'
      expect(parsing(params).query.q).to.equal('((email:"somebody@example.com"))')
    })

    it('correctly parses a wildcard query', () => {
      params.params.query.email = '*@example.com'
      expect(parsing(params).query.q).to.equal('((email:*@example.com))')
    })

    it('correctly parses an $ne query', () => {
      params.params.query.email = { $ne: 'somebody@example.com' }
      expect(parsing(params).query.q).to.equal('((email:(NOT "somebody@example.com")))')
    })

    it('correctly parses an $in query', () => {
      params.params.query.email = { $in: ['a@example.com', 'b@example.com'] }
      expect(parsing(params).query.q).to.equal('((email:("a@example.com" OR "b@example.com")))')
    })

    it('correctly parses an $nin query', () => {
      params.params.query.email = { $nin: ['a@example.com', 'b@example.com'] }
      expect(parsing(params).query.q).to.equal('((email:(NOT "a@example.com" AND NOT "b@example.com")))')
    })

    it('correctly parses a $lt query', () => {
      params.params.query.logins_count = { $lt: 50 }
      expect(parsing(params).query.q).to.equal('((logins_count:({* TO 50})))')
    })

    it('correctly parses a $lte query', () => {
      params.params.query.logins_count = { $lte: 50 }
      expect(parsing(params).query.q).to.equal('((logins_count:([* TO 50])))')
    })

    it('correctly parses a $gt query', () => {
      params.params.query.logins_count = { $gt: 50 }
      expect(parsing(params).query.q).to.equal('((logins_count:({50 TO *})))')
    })

    it('correctly parses a $gte query', () => {
      params.params.query.logins_count = { $gte: 50 }
      expect(parsing(params).query.q).to.equal('((logins_count:([50 TO *])))')
    })

    it('correctly parses a range between $lt & $gt query', () => {
      params.params.query.logins_count = { $lt: 200, $gt: 100 }
      expect(parsing(params).query.q).to.equal('((logins_count:({100 TO 200})))')
    })

    it('correctly parses a range outside $lt & $gt query', () => {
      params.params.query.logins_count = { $lt: 100, $gt: 200 }
      expect(parsing(params).query.q).to.equal('((logins_count:({* TO 100} OR {200 TO *})))')
    })

    it('correctly parses a range between $lte & $gt query', () => {
      params.params.query.logins_count = { $lte: 200, $gt: 100 }
      expect(parsing(params).query.q).to.equal('((logins_count:({100 TO 200])))')
    })

    it('correctly parses a range outside $lte & $gt query', () => {
      params.params.query.logins_count = { $lte: 100, $gt: 200 }
      expect(parsing(params).query.q).to.equal('((logins_count:([* TO 100] OR {200 TO *})))')
    })

    it('correctly parses a range between $lt & $gte query', () => {
      params.params.query.logins_count = { $lt: 200, $gte: 100 }
      expect(parsing(params).query.q).to.equal('((logins_count:([100 TO 200})))')
    })

    it('correctly parses a range outside $lt & $gte query', () => {
      params.params.query.logins_count = { $lt: 100, $gte: 200 }
      expect(parsing(params).query.q).to.equal('((logins_count:({* TO 100} OR [200 TO *])))')
    })

    it('correctly parses a range between $lte & $gte query', () => {
      params.params.query.logins_count = { $lte: 200, $gte: 100 }
      expect(parsing(params).query.q).to.equal('((logins_count:([100 TO 200])))')
    })

    it('correctly parses a range outside $lte & $gte query', () => {
      params.params.query.logins_count = { $lte: 100, $gte: 200 }
      expect(parsing(params).query.q).to.equal('((logins_count:([* TO 100] OR [200 TO *])))')
    })

    it('correctly parses a compound query: equality  and range between $lt & $gt', () => {
      params.params.query.email = 'somebody@example.com'
      params.params.query.logins_count = { $lt: 200, $gt: 100 }
      expect(parsing(params).query.q).to.equal('((email:"somebody@example.com") AND (logins_count:({100 TO 200})))')
    })

    it('correctly parses a compound query: two equalities', () => {
      params.params.query.family_name = 'Doe'
      params.params.query.given_name = 'J*'
      expect(parsing(params).query.q).to.equal('((family_name:"Doe") AND (given_name:J*))')
    })

    it('correctly parses an $or query', () => {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      const oneWeekAgo = d.toISOString()
      params.params.query.$or = [
        {
          email: {
            $ne: 'a@example.com'
          }
        },
        {
          logins_count: {
            $lt: 200,
            $gt: 100
          },
          last_login: {
            $gt: oneWeekAgo
          }
        },
        {
          family_name: 'Doe',
          given_name: 'J*'
        }
      ]
      expect(parsing(params).query.q).to.equal(
        `(((email:(NOT "a@example.com"))) OR ((logins_count:({100 TO 200})) AND (last_login:({${oneWeekAgo} TO *}))) OR ((family_name:"Doe") AND (given_name:J*)))`
      )
    })
  })

  describe('a convert() function that', () => {
    let params, oneWeekAgo
    beforeEach(() => {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      oneWeekAgo = d.toISOString()
      params = {
        pagination: {
          default: 5,
          max: 25
        },
        params: {
          paginate: {
            default: 10,
            max: 50
          },
          query: {
            $sort: {
              email: 1
            },
            $select: [
              'email',
              'user_id',
              'picture',
              'app_metadata.roles'
            ],
            $or: [
              {
                email: {
                  $ne: 'a@example.com'
                }
              },
              {
                logins_count: {
                  $lt: 200,
                  $gt: 100
                },
                last_login: {
                  $gt: oneWeekAgo
                }
              },
              {
                family_name: 'Doe',
                given_name: 'J*'
              }
            ]
          }
        }
      }
    })

    it('combines paging(), sorting(), selecting(), and parsing() to complete the entire conversion from FeathersJS to Auth0 format', () => {
      const query = {
        fields: 'email,user_id,picture,app_metadata.roles',
        include_totals: true,
        page: 0,
        per_page: 10,
        q: `(((email:(NOT "a@example.com"))) OR ((logins_count:({100 TO 200})) AND (last_login:({${oneWeekAgo} TO *}))) OR ((family_name:"Doe") AND (given_name:J*)))`,
        search_engine: 'v3',
        sort: 'email:1'
      }
      expect(convert(params)).to.deep.equal(query)
    })
  })
})
