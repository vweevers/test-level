const level = require('./lib')
    , existent = require('existent')

// Create a levelup+memdown factory, with node-hat as
// name generator (see `npm docs tmpgen` for details)
const mem = level({ mem: true, valueEncoding: 'utf8', gen: 'hat' })

// Same as
const mem2 = level({ db: require('memdown'), gen: 'hat' })
const mem3 = level({ db: 'memdown', gen: 'hat' })

// Create a db and override the valueEncoding (or
// any other levelup option) of the factory
const db1 = mem({ valueEncoding: 'json' })

// Create a levelup+leveldown factory. Each db gets a unique temporary
// directory with the default monotonic-timestamp name generator and is
// wrapped with level-sublevel.
const diskA = level({ wrap: ['sublevel'] })
const db2 = diskA()
const sub = db2.sublevel('beep')

// Same, at custom tmp location, with wrapper options
const diskB = level('my-module/*', {
  wrap: [ ['sublevel', { valueEncoding: 'json' }] ]
})

const db3 = diskB()

// Remove created dbs before process exit (ignored if mem is true)
const diskC = level('beep-*', { clean: true })

// Create db in a subdirectory
const db4 = diskC('special-name')

;[db1, db2, db3, db4].forEach((db, i) => {
  console.log('db %d', i+1, existent.sync(db.location), db.location)
})

process.on('exit', function(){
  console.log('\nExiting\n')
  ;[db1, db2, db3, db4].forEach((db, i) => {
    // db4 is removed
    console.log('db %d', i+1, existent.sync(db.location), db.location)
  })
})
