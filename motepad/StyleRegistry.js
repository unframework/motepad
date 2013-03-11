define(
    [ 'motepad/Style' ],
    function(createStyle) {

        var separator = "\u0001";

        function StyleRegistry(extentsStageContainer, attributeInfo) {
            this.extentsStageContainer = extentsStageContainer;
            this.attributeInfo = attributeInfo;
        }

        StyleRegistry.prototype.getOrCreate = function(values) {
            var codeParts = [ '' ]; // avoid colliding with normal properties
            var css = {};
            for(var n in this.attributeInfo) {
                codeParts.push(n);
                codeParts.push(this.attributeInfo[n].getHashCode(values[n]));

                this.attributeInfo[n].applyVisual(values[n], css);
            }

            var code = codeParts.join(separator);

            if(this[code] == null)
                this[code] = createStyle(this.extentsStageContainer, css, code);

            return this[code];
        }

        StyleRegistry.prototype.each = function(cb) {
            for(var n in this) {
                if(n.charAt(0) === separator)
                    cb(this[n]);
            }
        }

        return StyleRegistry;

    }
)