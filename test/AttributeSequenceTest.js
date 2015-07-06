var t = require('tap');
var seq = require('../src/AttributeSequence');

function c(s) {
    var result = [];
    s.eachRun(0, 100, function (value, start, length) { result.push([value, start, length]); });
    return result;
}

t.same(c(seq()), [], 'blank sequence');
t.same(c(seq().insert('X', 0, 10)), [ [ 'X', 0, 10 ] ], 'simple run');

t.same(c(seq().insert('X', 0, 10).insert('Y', 3, 5)), [ [ 'X', 0, 3 ], [ 'Y', 3, 5 ], [ 'X', 8, 7 ] ], 'split run');
t.same(c(seq().insert('X', 0, 10).insert('X', 3, 5)), [ [ 'X', 0, 15 ] ], 'inserted same value run');
t.same(c(seq().insert('X', 0, 10).insert('Y', 0, 5)), [ [ 'Y', 0, 5 ], [ 'X', 5, 10 ] ], 'pre-inserted value');
