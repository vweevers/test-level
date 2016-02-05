'use strict';

const kindOf = require('kindof')
    , tmpgen = require('tmpgen')
    , existent = require('existent')
    , noop = function() {}
    , tape = require('tape')
    , tryRequire = require('./try-require')

module.exports = function factory(name, opts = {}) {
  if (kindOf(name) === 'object') opts = name, name = null

  if (opts.mem && !opts.db) opts.db = tryRequire('memdown')
  else if (!opts.mem && !opts.db) opts.db = tryRequire('leveldown')
  else if (opts.db === tryRequire('memdown', { silent: true })) opts.mem = true

  let { clean, always, mem, gen, wrap = [], ...levelOpts } = opts
  let tmp;

  if (mem) {
    if (clean && opts.db && typeof opts.db.clearGlobalStore === 'function') {
      opts.db.clearGlobalStore()
    }

    gen = tmpgen.generator(gen)
    tmp = (sub) => joinName(name, sub, gen())
  } else {
    tmp = tmpgen(name, { gen, clean, always })
  }

  switch(kindOf(wrap)) {
    case 'object':
      // e.g. { sublevel: { valueEncoding: 'json' } }
      wrap = Object.keys(wrap).map(name => [ name, wrap[name] ])
      break
    case 'string':
      if (!wrap) throw new Error('Wrapper name is empty')
      wrap = [wrap]
      break
    case 'array':
      break
    default: {
      const desc = 'Expected object, string or array for "wrap", got: '
      throw new Error(desc + kindOf(wrap))
    }
  }

  return function create(name, opts, cb) {
    const kind = kindOf(name)

    if (kind === 'function') cb = name, opts = {}, name = null // (cb)
    else if (kind === 'object') cb = opts, opts = name, name = null // (opts, cb)

    if (typeof opts === 'function') cb = opts, opts = {} // (name, cb)
    else if (!opts) opts = {}

    // TODO: merge opts with levelOpts

    const location = tmp(name)
    const levelup = tryRequire('levelup')

    let db = levelup(location, encodingOpts({ ...levelOpts, ...opts }), cb)

    const close = typeof db.close === 'function' ? db.close.bind(db) : noop
    const loc = db.location

    // In case db.close was not called
    // Requires node 0.12.11 or later.
    // See https://github.com/nodejs/node-v0.x-archive/commit/a2eeb43deda58e7bbb8fcf24b934157992b937c0
    process.once('beforeExit', close)
    db.once('closed', () => process.removeListener('beforeExit', close))

    // Clean after close
    if (clean && typeof tmp.del === 'function') db.once('closed', () => {
      tmp.del(location)
    })

    wrap.forEach(wrapper => {
      let [ fn, opts ] = [].concat(wrapper)
      if (typeof fn === 'string') fn = tryRequire(fn, { prefix: 'level-' })
      const sdb = opts !== undefined ? fn(db, opts) : fn(db)
      if (!sdb.close) sdb.close = close
      if (!sdb.location) sdb.location = loc
      db = sdb
    })

    return db
  }
}

module.exports.tryRequire = tryRequire

// Test helper to close db after test ends.
module.exports.test = function(name, opts) {
  if (kindOf(name) === 'object') opts = name, name = null
  else if (!opts) opts = {}

  const { wait: wait_global = true, ...dbOpts } = opts

  const create = module.exports(name, dbOpts)
  const checkCreated = !dbOpts.mem
  const checkDeleted = !!(dbOpts.clean && !dbOpts.mem)

  function testFactory(name, opts, test) {
    // (opts, test)
    if (kindOf(name) === 'object') test = opts, opts = name, name = null

    // (test)
    else if (typeof name === 'function') test = name, opts = {}, name = null

    // (name, test)
    else if (typeof opts === 'function') test = opts, opts = {}
    else if (!opts) opts = {}

    if (typeof test !== 'function') {
      throw new Error('test is not a function')
    }

    // If true (default), wait for db to open before running test
    const wait = opts.wait != null ? opts.wait : wait_global

    return function run(t) {
      const db = create(name, opts)
      const loc = db.location
      const plan = t.plan
      const end = t.end

      let pending = 0, ended = false, closed = false;

      // override plan(n) to add our own assertions
      t.plan = function(n) {
        plan.call(t, (pending=n) + checkCreated + checkDeleted + 1)
      }

      t.end = function(err) {
        if (closed) return end.call(t, err)

        db.once('closed', function(){
          end.call(t, err)
        })

        db.close()
      }

      function onEnd() {
        if (ended) return
        ended = true
        if (!closed) db.close()
      }

      function onClose() {
        if (closed) return
        closed = true
        t.ok(true, 'db closed')
        if (checkDeleted) t.notOk(existent.sync(loc), 'deleted: ' + loc)
      }

      function onResult() {
        if (--pending === 0) onEnd()
      }

      function start() {
        test(t, db)
      }

      db.once('closed', onClose)
      db.once('close', onClose)

      if (checkCreated) t.ok(existent.sync(loc), 'created: ' + loc)

      t.on('end', onEnd)
      t.on('result', onResult)

      t.db = db

      if (!wait) start()
      else if (db.isOpen()) process.nextTick(start)
      else db.once('open', start)
    }
  }

  testFactory.test = function(...args) {
    args = getTestArgs(args);
    return tape(args.name, args.tapeOpts, testFactory(args.dbOpts, args.cb))
  }

  testFactory.skip = testFactory.test.skip = function (...args) {
    args = getTestArgs(args, { skip: true })
    return tape(args.name, args.tapeOpts, testFactory(args.dbOpts, args.cb))
  }

  testFactory.only = testFactory.test.only = function (...args) {
    args = getTestArgs(args)
    return tape.only(args.name, args.tapeOpts, testFactory(args.dbOpts, args.cb))
  }

  return testFactory
}

function joinName(...parts) {
  return parts.filter(Boolean).join('-')
}

// Adapted from tape
function getTestArgs(args, override = {}) {
  let name = '(anonymous)';
  let opts = {};
  let cb;

  for (let i=0; i<args.length; i++) {
    let arg = args[i], t = typeof arg

    if (t === 'string') name = arg
    else if (t === 'object') opts = arg || opts
    else if (t === 'function') cb = arg
  }

  const { skip, timeout, ...dbOpts } = { ...opts, ...override }
  return { name, tapeOpts: { skip, timeout }, dbOpts, cb };
}

function encodingOpts(opts) {
  if (opts.encoding) {
    if (!opts.keyEncoding) opts.keyEncoding = opts.encoding
    if (!opts.valueEncoding) opts.valueEncoding = opts.encoding
  }

  return opts
}
