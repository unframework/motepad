var createStyle = require('./Style');

var separator = "\u0001";

function StyleRegistry(extentsStageContainer, attributeInfo) {
    this.extentsStageContainer = extentsStageContainer;
    this.attributeInfo = attributeInfo;
}

StyleRegistry.prototype.getOrCreate = function(values) {
    var codeParts = [ '' ]; // avoid colliding with normal properties by ensuring a leading divider char
    var css = {};
    var customCharacterHandler = null;

    for(var n in this.attributeInfo) {
        codeParts.push(n);
        codeParts.push(this.attributeInfo[n].getHashCode(values[n]));

        this.attributeInfo[n].applyVisual(values[n], css);

        if (this.attributeInfo[n].createCharacterContent) {
            // @todo detect clashes
            customCharacterHandler = this.attributeInfo[n].createCharacterContent(values[n]);
        }
    }

    var code = codeParts.join(separator);

    if(this[code] === undefined)
        this[code] = createStyle(this.extentsStageContainer, css, customCharacterHandler, code);

    return this[code];
};

StyleRegistry.prototype.each = function(cb) {
    for(var n in this) {
        if(n.charAt(0) === separator)
            cb(this[n]);
    }
};

module.exports = StyleRegistry;
