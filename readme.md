# test-level

**Create temporary levelup databases, with unique names generated by [tmpgen](https://github.com/vweevers/tmpgen). Can remove directory on test end, db.close or before process exit (on node >= 0.12.11). Does not include levelup, leveldown or memdown - so you get to choose the versions. API unstable, expect breaking changes.**

[![npm status](http://img.shields.io/npm/v/test-level.svg?style=flat-square)](https://www.npmjs.org/package/test-level) [![Travis build status](https://img.shields.io/travis/vweevers/test-level.svg?style=flat-square&label=travis)](http://travis-ci.org/vweevers/test-level) [![AppVeyor build status](https://img.shields.io/appveyor/ci/vweevers/test-level.svg?style=flat-square&label=appveyor)](https://ci.appveyor.com/project/vweevers/test-level) [![Dependency status](https://img.shields.io/david/vweevers/test-level.svg?style=flat-square)](https://david-dm.org/vweevers/test-level)

## example

`npm i levelup leveldown level-sublevel test-level`

```js
const disk = require('test-level')('my-module/*', { wrap: 'sublevel' })

const db1 = disk()
const db2 = disk()

// /tmp/my-module/1454283677055
// /tmp/my-module/1454283677055.001
console.log(db1.location, db2.location)

const sub = db1.sublevel('beep')
```

## see also

- [level-test](https://github.com/dominictarr/level-test)
- [ltest](https://github.com/ralphtheninja/ltest) test function on top of `level-test`

Differences from `level-test`:

- In `level-test`, `opts.clean` removes the directory *before* opening the db, in `test-level` it removes the directory *after* you're done
- No browser support as of yet
- Does not fallback to memdown if leveldown failed to load
- Does not include memdown, leveldown or levelup

## usage

`npm i levelup leveldown memdown level-sublevel test-level existent`

```js
const level = require('test-level')
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
```

Output:
```
db 1 false 8a2fe3f361ff5365dd956da54fcca014
db 2 true /tmp/test-level/1454283677010
db 3 true /tmp/my-module/1454283677055
db 4 true /tmp/beep-1454283677058/special-name

Exiting

db 1 false 8a2fe3f361ff5365dd956da54fcca014
db 2 true /tmp/test-level/1454283677010
db 3 true /tmp/my-module/1454283677055
db 4 false /tmp/beep-1454283677058/special-name
```

### tape test helper

[todo: write docs or move that stuff to another module]

## api

### `main(arg[,opts])`

...

## install

With [npm](https://npmjs.org) do:

```
npm install test-level
```

## license

[MIT](http://opensource.org/licenses/MIT) © Vincent Weevers