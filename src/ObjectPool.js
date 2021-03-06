
function ObjectPool() {
    this._previousPass = Object.create(null);
    this._currentPass = Object.create(null);
}

ObjectPool.prototype.claim = function (code, createCallback) {
    var currentInstance = this._currentPass[code];
    if (currentInstance !== undefined) {
        return currentInstance;
    }

    // look for previous pass instance
    var instance = this._previousPass[code];
    if(instance !== undefined) {
        // claim instance as used
        delete this._previousPass[code];
    } else {
        // create new instance
        instance = createCallback();
    }

    // save for next pass
    this._currentPass[code] = instance;
    return instance;
};

ObjectPool.prototype.each = function (callback) {
    var n;

    for(n in this._currentPass)
        callback(this._currentPass[n]);

    for(n in this._previousPass)
        callback(this._previousPass[n]);
};

ObjectPool.prototype.removeUnused = function (disposeCallback) {
    // claim unused instances
    for(var n in this._previousPass)
        disposeCallback(this._previousPass[n]);

    // flip storage for next pass
    this._previousPass = this._currentPass;
    this._currentPass = {};
};

module.exports = ObjectPool;
