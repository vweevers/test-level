if (process.argv[2] === '--rebuild') {
  require('require-rebuild')()
}

const test = require('tape')
    , level = require('../')
    , Memdown = require('memdown')
    , Leveldown = level.tryRequire('leveldown')
    , existent = require('existent')
    , spawn = require('cross-spawn-async')
    , semver = require('semver')

const { join, dirname } = require('path')

test('mem', (t) => {
  const db = level({ mem: true })()
  t.is(db.options.db, Memdown, 'sets db to memdown if mem is true')
  t.notOk(existent.sync(db.location), 'does not create dir')
  t.end()
})

test('explicit memdown', (t) => {
  const db = level({ db: Memdown })()
  t.notOk(existent.sync(db.location), 'does not create dir')
  t.end()
})

test('defaults to leveldown', (t) => {
  const db = level({ clean: true })()
  const loc = db.location

  t.is(db.options.db, Leveldown)
  t.ok(db.location.indexOf('test-level') > 0, 'defaults to test-level dir')
  t.ok(existent.sync(loc), 'exists: ' + loc)

  db.close(() => {
    t.notOk(existent.sync(loc), 'deleted dir')
    t.end()
  })
})

test('wrapper', (t) => {
  const db = level('test-level-*', { gen: 'alpha', clean: true, wrap: ['level-sublevel'] })()
  const loc = db.location

  t.is(typeof db.sublevel, 'function', 'got sublevel fn')
  t.ok(existent.sync(loc), 'exists: ' + loc)

  db.close(() => {
    t.notOk(existent.sync(loc), 'deleted dir')
    t.end()
  })
})

test('wrapper string', (t) => {
  const db = level('test-level-*', { gen: 'alpha', clean: true, wrap: 'sublevel' })()
  const loc = db.location

  t.is(typeof db.sublevel, 'function', 'got sublevel fn')
  t.ok(existent.sync(loc), 'exists: ' + loc)

  db.close(() => {
    t.notOk(existent.sync(loc), 'deleted dir')
    t.end()
  })
})

test('wrapper with options in array', (t) => {
  const opts = { valueEncoding: 'json' }
  const db = level({ clean: true, wrap: [ ['level-sublevel', opts] ] })()
  const loc = db.location

  t.plan(6)

  t.is(typeof db.sublevel, 'function', 'got sublevel fn')
  t.ok(existent.sync(loc), 'exists: ' + loc)

  db.put('a', { a: 1 }, (err) => {
    t.notOk(err, 'no put error')

    db.get('a', (err, val) => {
      t.notOk(err, 'no get error')
      t.same(val, { a: 1 })

      db.close(() => {
        t.notOk(existent.sync(loc), 'deleted dir')
      })
    })
  })
})

test('wrapper with options in object', (t) => {
  const opts = { valueEncoding: 'json' }
  const db = level({ clean: true, wrap: { sublevel: opts } })()
  const loc = db.location

  t.plan(6)

  t.is(typeof db.sublevel, 'function', 'got sublevel fn')
  t.ok(existent.sync(loc), 'exists: ' + loc)

  db.put('a', { a: 1 }, (err) => {
    t.notOk(err, 'no put error')

    db.get('a', (err, val) => {
      t.notOk(err, 'no get error')
      t.same(val, { a: 1 })

      db.close(() => {
        t.notOk(existent.sync(loc), 'deleted dir')
      })
    })
  })
})

test('invalid wrapper throws', (t) => {
  const factory = level('test-level-*', { clean: true, wrap: ['beep'] })
  t.plan(1)

  try {
    factory()
  } catch(err) {
    t.is(err.message, `Cannot find module 'beep'.\n\n    -- Please try \`npm install beep\`\n`)
  }
})

test('helper', level.test({ clean: true })(t => {
  t.ok(true, 'called test')
  t.ok(t.db.isOpen(), 'db is open')
  t.end()
}))

const bp = level.test({ clean: true, wrap: 'bytespace' })
test('helper with bytespace wrapper', bp(t => {
  const db = t.db
  const loc = db.location

  t.is(typeof db.namespace, 'object', 'got namespace')
  t.ok(existent.sync(loc), 'exists: ' + loc)

  db.close(() => {
    t.notOk(existent.sync(loc), 'deleted dir')
    t.end()
  })
}))

test('helper without wait', level.test({ clean: true, wait: false })(t => {
  t.ok(true, 'called test')
  t.notOk(t.db.isOpen(), 'db is not open')
  t.db.once('open', () => t.end())
}))

const lt = level.test('db_*', { gen: 'hat', clean: true })

test('helper with end', lt(t => {
  setTimeout(() => {
    t.ok(true, 'called test')
    t.end()
  }, 10)
}))

test('helper with plan', lt(t => {
  t.on('plan', function(n){
    t.is(n, 5, 'helper added 3 assertions')
  })

  t.plan(2)

  setTimeout(() => {
    t.ok(true, 'called test')
  }, 10)
}))

lt.test('direct helper', (t) => {
  t.on('plan', function(n){
    t.is(n, 5, 'helper added 3 assertions')
  })

  t.plan(2)

  setTimeout(() => {
    t.ok(t.db, 'has db')
  }, 10)
})

level.test({ clean: true, wrap: 'bytespace' })
.test('direct helper with bytespace wrapper', (t) => {
  const db = t.db
  const loc = db.location

  t.is(typeof db.namespace, 'object', 'got namespace')
  t.ok(existent.sync(loc), 'exists: ' + loc)

  db.close(() => {
    t.notOk(existent.sync(loc), 'deleted dir')
    t.end()
  })
})

lt.skip('skip direct helper', (t) => {
  t.on('plan', function(n){
    t.is(n, 5, 'helper added 3 assertions')
  })

  t.plan(2)

  setTimeout(() => {
    t.ok(t.db, 'has db')
  }, 10)
})

lt.test.skip('skip direct helper', (t) => {
  t.on('plan', function(n){
    t.is(n, 5, 'helper added 3 assertions')
  })

  t.plan(2)

  setTimeout(() => {
    t.ok(t.db, 'has db')
  }, 10)
})

test('helper with skip', lt(t => {
  t.pass('pass')
  t.skip('skip')
  t.end()
}))

test('helper with skip and plan', lt(t => {
  t.on('plan', function(n){
    t.is(n, 6, 'helper added 3 assertions')
  })

  t.plan(3)
  t.pass('pass')
  t.skip('skip')
  t.end()
}))

test('helper with sub tests', lt(t => {
  t.test('sub1', (t) => {
    t.ok(true, 'sub test 1')
    setTimeout(() => t.end(), 500)
  })

  t.test('sub2', (st) => {
    st.ok(true, 'sub test 2')
    st.ok(t.db.isOpen(), 'db still open in sub2')
    st.end()
  })
}))

// TODO: add note to readme about this limitation
test.skip('helper with sub tests and assertions', lt(t => {
  t.on('plan', function(n){
    t.is(n, 5, 'helper added 3 assertions')
  })

  // meh, t will wait for the db tests... but those should run after subtests
  t.plan(2)

  setTimeout(() => {
    t.ok(true, 'called test')
  }, 10)

  t.test('sub1', (st) => {
    st.ok(true, 'sub test 1')
    st.end()
  })

  t.test('sub2', (st) => {
    st.ok(true, 'sub test 2')
    st.ok(t.db.isOpen(), 'db still open in sub2')
    st.end()
  })
}))

test('helper with end and plan', lt(t => {
  t.on('plan', function(n){
    t.is(n, 5, 'helper added 3 assertions')
  })

  t.plan(2)

  setTimeout(() => {
    t.ok(true, 'called test')
    t.end()
  }, 10)
}))

test('helper with end and manual db close', lt(t => {
  t.db.close(() => {
    t.ok(true, 'called test')
    t.end()
  })
}))

test('helper with plan and manual db close', lt(t => {
  t.on('plan', function(n){
    t.is(n, 5, 'helper added 3 assertions')
  })

  t.plan(2)
  t.db.close(() => t.ok(true, 'called test'))
}))

const lt2 = level.test({ mem: true })
test('helper on mem db skips create and delete assertions', lt2(t => {
  t.on('plan', function(n){
    t.is(n, 2, 'helper added 1 assertion')
  })

  t.plan(1)
}))

const lt3 = level.test({ clean: false })
test('helper with { clean: false } skips delete assertion', lt3(t => {
  t.on('plan', function(n){
    t.is(n, 3, 'helper added 2 assertion')
  })

  t.plan(1)
}))

test('cleans on process exit', (t) => {
  const v = process.versions.node

  if (!semver.satisfies(v, '>=0.11.12')) {
    t.ok(true, 'skipping test, beforeExit event is not available on node v' + v)
    return t.end()
  }

  t.plan(2)

  const child = spawn('node', [join(__dirname, 'scripts', 'clean.js')])
  let path;

  child.stdout.once('data', (data) => {
    path = data.toString().trim()
    t.ok(existent.sync(path), 'created: ' + path)
  })

  child.on('close', () => {
    const parent = dirname(path)
    t.notOk(existent.sync(parent), 'deleted parent: ' + parent)
  })
})
