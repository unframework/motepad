var binarySearch = require('./binarySearch');
var layoutBlock = require('./layoutBlock');
var layoutMetaText = require('./layoutMetaText');

module.exports = function layoutRichText(areaWidth, text, attributes, attributeInfo, styles) {
    var currentValues = {};
    for(var n in attributeInfo)
        currentValues[n] = attributeInfo[n].defaultValue;

    var defaultStyle = styles.getOrCreate(currentValues);

    var consumers = {};
    for(var n in attributes) {
        consumers[n] = attributes[n].createConsumer();
    }

    var result = layoutMetaText(areaWidth, text, function(tokenLength, callback) {
        var leftover = tokenLength;

        while(leftover > 0) {
            // find maximum inline block length
            var textLength = leftover;
            for(var n in consumers) {
                // TODO: this check should not be necessary
                if(consumers[n].runLength === null)
                    throw "consumer overrun!";

                textLength = Math.min(textLength, consumers[n].runLength);
                currentValues[n] = consumers[n].runValue;
            }

            var style = styles.getOrCreate(currentValues);

            callback(style, textLength);

            for(var n in consumers)
                consumers[n].advance(textLength);

            leftover -= textLength;
        }
    }, defaultStyle);

    // free up style cache memory
    styles.each(function(style) { style.cleanCache(); });

    return result;
};
