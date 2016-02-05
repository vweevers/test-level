'use strict';

var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

var kindOf = require('kindof'),
    tmpgen = require('tmpgen'),
    existent = require('existent'),
    noop = function noop() {},
    tape = require('tape'),
    tryRequire = require('./try-require');

module.exports = function factory(name) {
  var opts = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  if (kindOf(name) === 'object') opts = name, name = null;

  if (opts.mem && !opts.db) opts.db = tryRequire('memdown');else if (!opts.mem && !opts.db) opts.db = tryRequire('leveldown');else if (opts.db === tryRequire('memdown', { silent: true })) opts.mem = true;

  var _opts = opts;
  var clean = _opts.clean;
  var always = _opts.always;
  var mem = _opts.mem;
  var gen = _opts.gen;
  var _opts$wrap = _opts.wrap;
  var wrap = _opts$wrap === undefined ? [] : _opts$wrap;

  var levelOpts = _objectWithoutProperties(_opts, ['clean', 'always', 'mem', 'gen', 'wrap']);

  var tmp = undefined;

  if (mem) {
    if (clean && opts.db && typeof opts.db.clearGlobalStore === 'function') {
      opts.db.clearGlobalStore();
    }

    gen = tmpgen.generator(gen);
    tmp = function (sub) {
      return joinName(name, sub, gen());
    };
  } else {
    tmp = tmpgen(name, { gen: gen, clean: clean, always: always });
  }

  switch (kindOf(wrap)) {
    case 'object':
      // e.g. { sublevel: { valueEncoding: 'json' } }
      wrap = Object.keys(wrap).map(function (name) {
        return [name, wrap[name]];
      });
      break;
    case 'string':
      if (!wrap) throw new Error('Wrapper name is empty');
      wrap = [wrap];
      break;
    case 'array':
      break;
    default:
      {
        var desc = 'Expected object, string or array for "wrap", got: ';
        throw new Error(desc + kindOf(wrap));
      }
  }

  return function create(name, opts, cb) {
    var kind = kindOf(name);

    if (kind === 'function') cb = name, opts = {}, name = null; // (cb)
    else if (kind === 'object') cb = opts, opts = name, name = null; // (opts, cb)

    if (typeof opts === 'function') cb = opts, opts = {}; // (name, cb)
    else if (!opts) opts = {};

    // TODO: merge opts with levelOpts

    var location = tmp(name);
    var levelup = tryRequire('levelup');

    var db = levelup(location, encodingOpts(_extends({}, levelOpts, opts)), cb);

    var close = typeof db.close === 'function' ? db.close.bind(db) : noop;
    var loc = db.location;

    // In case db.close was not called
    // Requires node 0.12.11 or later.
    // See https://github.com/nodejs/node-v0.x-archive/commit/a2eeb43deda58e7bbb8fcf24b934157992b937c0
    process.once('beforeExit', close);
    db.once('closed', function () {
      return process.removeListener('beforeExit', close);
    });

    // Clean after close
    if (clean && typeof tmp.del === 'function') db.once('closed', function () {
      tmp.del(location);
    });

    wrap.forEach(function (wrapper) {
      var _concat = [].concat(wrapper);

      var _concat2 = _slicedToArray(_concat, 2);

      var fn = _concat2[0];
      var opts = _concat2[1];

      if (typeof fn === 'string') fn = tryRequire(fn, { prefix: 'level-' });
      var sdb = opts !== undefined ? fn(db, opts) : fn(db);
      if (!sdb.close) sdb.close = close;
      if (!sdb.location) sdb.location = loc;
      db = sdb;
    });

    return db;
  };
};

module.exports.tryRequire = tryRequire;

// Test helper to close db after test ends.
module.exports.test = function (name, opts) {
  if (kindOf(name) === 'object') opts = name, name = null;else if (!opts) opts = {};

  var _opts2 = opts;
  var _opts2$wait = _opts2.wait;
  var wait_global = _opts2$wait === undefined ? true : _opts2$wait;

  var dbOpts = _objectWithoutProperties(_opts2, ['wait']);

  var create = module.exports(name, dbOpts);
  var checkCreated = !dbOpts.mem;
  var checkDeleted = !!(dbOpts.clean && !dbOpts.mem);

  function testFactory(name, opts, test) {
    // (opts, test)
    if (kindOf(name) === 'object') test = opts, opts = name, name = null;

    // (test)
    else if (typeof name === 'function') test = name, opts = {}, name = null;

      // (name, test)
      else if (typeof opts === 'function') test = opts, opts = {};else if (!opts) opts = {};

    if (typeof test !== 'function') {
      throw new Error('test is not a function');
    }

    // If true (default), wait for db to open before running test
    var wait = opts.wait != null ? opts.wait : wait_global;

    return function run(t) {
      var db = create(name, opts);
      var loc = db.location;
      var plan = t.plan;
      var end = t.end;

      var pending = 0,
          ended = false,
          closed = false;

      // override plan(n) to add our own assertions
      t.plan = function (n) {
        plan.call(t, (pending = n) + checkCreated + checkDeleted + 1);
      };

      t.end = function (err) {
        if (closed) return end.call(t, err);

        db.once('closed', function () {
          end.call(t, err);
        });

        db.close();
      };

      function onEnd() {
        if (ended) return;
        ended = true;
        if (!closed) db.close();
      }

      function onClose() {
        if (closed) return;
        closed = true;
        t.ok(true, 'db closed');
        if (checkDeleted) t.notOk(existent.sync(loc), 'deleted: ' + loc);
      }

      function onResult() {
        if (--pending === 0) onEnd();
      }

      function start() {
        test(t, db);
      }

      db.once('closed', onClose);
      db.once('close', onClose);

      if (checkCreated) t.ok(existent.sync(loc), 'created: ' + loc);

      t.on('end', onEnd);
      t.on('result', onResult);

      t.db = db;

      if (!wait) start();else if (db.isOpen()) process.nextTick(start);else db.once('open', start);
    };
  }

  testFactory.test = function () {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    args = getTestArgs(args);
    return tape(args.name, args.tapeOpts, testFactory(args.dbOpts, args.cb));
  };

  testFactory.skip = testFactory.test.skip = function () {
    for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      args[_key2] = arguments[_key2];
    }

    args = getTestArgs(args, { skip: true });
    return tape(args.name, args.tapeOpts, testFactory(args.dbOpts, args.cb));
  };

  testFactory.only = testFactory.test.only = function () {
    for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
      args[_key3] = arguments[_key3];
    }

    args = getTestArgs(args);
    return tape.only(args.name, args.tapeOpts, testFactory(args.dbOpts, args.cb));
  };

  return testFactory;
};

function joinName() {
  for (var _len4 = arguments.length, parts = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
    parts[_key4] = arguments[_key4];
  }

  return parts.filter(Boolean).join('-');
}

// Adapted from tape
function getTestArgs(args) {
  var override = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  var name = '(anonymous)';
  var opts = {};
  var cb = undefined;

  for (var i = 0; i < args.length; i++) {
    var arg = args[i],
        t = typeof arg;

    if (t === 'string') name = arg;else if (t === 'object') opts = arg || opts;else if (t === 'function') cb = arg;
  }

  var _extends2 = _extends({}, opts, override);

  var skip = _extends2.skip;
  var timeout = _extends2.timeout;

  var dbOpts = _objectWithoutProperties(_extends2, ['skip', 'timeout']);

  return { name: name, tapeOpts: { skip: skip, timeout: timeout }, dbOpts: dbOpts, cb: cb };
}

function encodingOpts(opts) {
  if (opts.encoding) {
    if (!opts.keyEncoding) opts.keyEncoding = opts.encoding;
    if (!opts.valueEncoding) opts.valueEncoding = opts.encoding;
  }

  return opts;
}