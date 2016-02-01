'use strict';

var level = require('../..');
var db = level('test-level/foo*/*', { clean: true, gen: 'hat' })();

console.log(db.location);