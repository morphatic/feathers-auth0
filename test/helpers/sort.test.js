const { expect } = require('chai')
const { sort, convertProps } = require('../../lib/helpers/sort')

describe('A sorting helper that has', () => {
  describe('a convertProps() function that converts $sort props into the format neede by `fast-sort`', () => {
    it('can handle simple, non-nested keys', () => {
      const $sort = { a: 1, b: -1, c: 1 }
      expect(convertProps($sort)).to.deep.equal([{ asc: 'a' }, { desc: 'b' }, { asc: 'c' }])
    })

    it('can handle nested keys', () => {
      const $sort = { 'a.b': 1, 'a.b.c': -1, c: 1 }
      const test = { a: { b: { c: 'foo' } }, c: 'bar' }
      const converted = convertProps($sort)
      expect(converted[0].asc(test)).to.deep.equal({ c: 'foo' })
      expect(converted[1].desc(test)).to.equal('foo')
      expect(converted[2]).to.deep.equal({ asc: 'c' })
    })
  })

  describe('a sort() function that can sort on multiple, nested keys', () => {
    let unsorted
    beforeEach(() => {
      unsorted = [
        { a: 1, b: 4, c: { d: 4 } },
        { a: 3, b: 1, c: { d: 1 } },
        { a: 3, b: 2, c: { d: 2 } },
        { a: 2, b: 4, c: { d: 4 } }
      ]
    })

    it('works for simple sorts', () => {
      const sorted = [
        { a: 1, b: 4, c: { d: 4 } },
        { a: 2, b: 4, c: { d: 4 } },
        { a: 3, b: 1, c: { d: 1 } },
        { a: 3, b: 2, c: { d: 2 } }
      ]
      expect(sort(unsorted, { a: 1, b: 1 })).to.deep.equal(sorted)
    })

    it('works for simple sorts (with mixed asc/desc)', () => {
      const sorted = [
        { a: 1, b: 4, c: { d: 4 } },
        { a: 2, b: 4, c: { d: 4 } },
        { a: 3, b: 2, c: { d: 2 } },
        { a: 3, b: 1, c: { d: 1 } }
      ]
      expect(sort(unsorted, { a: 1, b: -1 })).to.deep.equal(sorted)
    })

    it('works with nested keyes', () => {
      const sorted = [
        { a: 1, b: 4, c: { d: 4 } },
        { a: 2, b: 4, c: { d: 4 } },
        { a: 3, b: 1, c: { d: 1 } },
        { a: 3, b: 2, c: { d: 2 } }
      ]
      expect(sort(unsorted, { a: 1, 'c.d': 1 })).to.deep.equal(sorted)
    })

    it('works with nested keyes (with mixed asc/desc)', () => {
      const sorted = [
        { a: 1, b: 4, c: { d: 4 } },
        { a: 2, b: 4, c: { d: 4 } },
        { a: 3, b: 2, c: { d: 2 } },
        { a: 3, b: 1, c: { d: 1 } }
      ]
      expect(sort(unsorted, { a: 1, 'c.d': -1 })).to.deep.equal(sorted)
    })
  })
})