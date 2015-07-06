var t = require('tap');
var PassCache = require('../src/PassCache');

t.test('simple operation', function (t) {
    var cache = new PassCache();

    cache.put('A', function () { t.ok('putting new key'); return 'X'; });
    cache.put('A', function () { t.fail('not needing to put in new key'); });

    t.end();
});
