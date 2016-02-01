const { sep, dirname } = require('path')

module.exports = moduleRootHead
module.exports.head = moduleRootHead
module.exports.tail = moduleRootTail

function moduleRootHead(path, opts){
  var segs = path.split(sep);
  var index = segs.indexOf('node_modules')

  if (index < 0 || index === segs.length-1) {
    if (opts && opts.silent) return
    throw new Error('Could not find module root in: ' + path)
  }

  return segs.slice(0, index + 2).join(sep);
}

function moduleRootTail(path, opts, _path) {
  if (_path === undefined) _path = path

  var segs = path.split(sep);
  var index = segs.lastIndexOf('node_modules')

  if (index < 0) {
    if (opts && opts.silent) return
    throw new Error('Could not find module root in: ' + _path)
  }

  if (index === segs.length-1) { // ends in 'node_modules'
    return moduleRoot.tail(dirname(path), opts, _path)
  }

  return segs.slice(0, index + 2).join(sep);
}
