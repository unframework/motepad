var t = require('tap');
var ObjectPool = require('../src/ObjectPool');

t.test('simple operation', function (t) {
    var cache = new ObjectPool();

    cache.put('A', function () { t.ok('putting new key'); return 'X'; });
    cache.put('A', function () { t.fail('not needing to put in new key'); });

    t.end();
});
