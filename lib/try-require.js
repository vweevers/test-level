'use strict';

var stackTrace = require('stack-trace');
var moduleRoot = require('./module-root');

var _require = require('path');

var basename = _require.basename;
var dirname = _require.dirname;

// TODO: makes modules out of these functions (mismatch-error, try-require,
// module-not-found-error, module-root)
var regexes = [/Module version mismatch/i, // this should be thrown in all cases, but isn't
/A dynamic link library \(DLL\) initialization routine failed/i, // windows

// TODO: only test for this on modern node (find out which exact version)
/Module did not self-register/i, // modern node requiring a 0.10 module

// TODO: only test for these on legacy node (find out which exact version)
/undefined symbol: node_module_register/i, // 0.10 linux
/Symbol not found: _node_module_register/i // 0.10 osx
];

module.exports = tryRequire;

function rootRequire(ids) {
  for (var i = 0, last = ids.length - 1; i <= last; i++) {
    try {
      return require(ids[i]);
    } catch (err) {
      if (!isNotFoundError(err)) throw err;
    }
  }

  var root = module.parent;
  while (root.parent) root = root.parent;

  // For `npm link` situations
  for (var i = 0, last = ids.length - 1; i <= last; i++) {
    try {
      return root.require(ids[i]);
    } catch (err) {
      if (i === last || !isNotFoundError(err)) throw err;
    }
  }
}

function tryRequire(id, opts) {
  var _ref = opts || {};

  var prefix = _ref.prefix;
  var silent = _ref.silent;

  var ids = [id];

  // Prefixed id takes precedence
  if (prefix && id.slice(0, prefix.length) !== prefix) {
    ids.unshift(prefix + id);
  }

  try {
    return rootRequire(ids);
  } catch (err) {
    if (silent) return;

    if (isMismatchError(err)) {
      var hints = ['Please try `npm rebuild ' + id + '` or read `npm docs ' + id + '`.', 'To rebuild all native modules run `npm rebuild`.'];

      var mismatch = getMismatch(err);

      if (mismatch) {
        hints.push('Expected ABI ' + mismatch.expected + ', got ' + mismatch.actual + '.');
      }

      var root = findFailingNativeModule(err);
      var _name = root ? basename(root) : id;
      var verb = mismatch ? ' ' : ' likely ';
      var msg = 'Module \'' + _name + '\' was' + verb + 'built for a different Node.js version.';

      if (root) hints.push('Located at ' + root);

      if (!mismatch) {
        var _msg = err.message.trim().split(/\r?\n/).map(function (line) {
          return '       ' + line.trim();
        }).join('\n');

        if (_msg.trim()) hints.push('Got error:\n\n' + _msg);
      }

      throw new Error(helpful(msg, hints));
    } else {
      var notFound = getNotFoundModule(err);

      if (notFound) {
        var msg = 'Cannot find module \'' + notFound + '\'.';
        var hint = 'Please try `npm install ' + id + '`';
        throw new Error(helpful(msg, [hint]));
      } else if (isNotFoundError(err)) {
        var msg = 'Cannot find module \'' + id + '\'.';
        var hint = 'Please try `npm install ' + id + '`';
        throw new Error(helpful(msg, [hint]));
      }

      throw err;
    }
  }
}

function helpful(msg, hints) {
  if (hints.length) msg += '\n';
  hints.forEach(function (hint) {
    msg += '\n    -- ' + hint;
  });
  if (hints.length) msg += '\n';
  return msg;
}

function isMismatchError(err, opts) {
  if (opts && opts.strict) {
    return regexes[0].test(String(err));
  }

  for (var i = 0, msg = String(err), l = regexes.length; i < l; i++) {
    if (regexes[i].test(msg)) return true;
  }
}

function getMismatch(err) {
  var match = /Module version mismatch. Expected (\d+), got (\d+)/.exec(String(err));
  return match ? { expected: match[1], actual: match[2] } : void 0;
}

function findFailingNativeModule(err) {
  var trace = stackTrace.parse(err);
  var visited = {};

  for (var i = 0, l = trace.length; i < l; i++) {
    var path = !trace[i].isNative() && trace[i].getFileName();

    while (path && path.indexOf('node_modules') > 0) {
      // TODO: first resolve path with bindings({ bindings: path, path: true })
      // if it can't be resolved, the path is irrelevant
      var root = moduleRoot.tail(path, { silent: true });
      if (!root) break;

      if (!visited[root]) {
        visited[root] = true;

        try {
          require(root);
        } catch (err) {
          if (isMismatchError(err)) return root;
        }
      }

      path = dirname(dirname(root));
    }
  }
}

function isNotFoundError(err, id) {
  if (id != null) return String(err).indexOf('Cannot find module \'' + id + '\'') >= 0;else return String(err).indexOf('Cannot find module') >= 0;
}

function getNotFoundModule(err) {
  var match = /Cannot find module '([^']+)'/.exec(String(err));
  return match && match[1] || void 0;
}