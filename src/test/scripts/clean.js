const level = require('../..')
const db = level('test-level/foo*/*', { clean: true, gen: 'hat' })()

console.log(db.location)
