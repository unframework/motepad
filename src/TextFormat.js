
function ensureCallback(fn) {
    if (typeof fn !== 'function') {
        throw new Error('expected function');
    }

    return fn;
}

function TextFormat() {
    this._attributeInfo = Object.create(null);
}

TextFormat.prototype.defineStyle = function (id, options) {
    if (this._attributeInfo[id]) {
        throw new Error('style already registered with that id');
    }

    var info = {
        defaultValue: options.defaultValue,
        getHashCode: ensureCallback(options.getHashCode),

        applyVisual: ensureCallback(options.applyVisual),

        parseHtmlTag: ensureCallback(options.parseHtmlTag),
        openHtmlTag: ensureCallback(options.openHtmlTag),
        closeHtmlTag: ensureCallback(options.closeHtmlTag)
    };

    this._attributeInfo[id] = options;
};

TextFormat.prototype._extractInfo = function () {
    var result = Object.create(null);

    for (var id in this._attributeInfo) {
        result[id] = this._attributeInfo[id];
    }

    return result;
};

module.exports = TextFormat;
