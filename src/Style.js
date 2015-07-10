var $ = require('jquery');

function createStyle(stageContainer, extraCss, customCharacterHandler, hashCode) {
    var fullCss = $.extend({
        'font': 'inherit'
    }, extraCss, {
        display: 'inline-block',
        'line-height': 1,
        'white-space': 'pre',
        padding: 0,
        margin: 0
    });

    var stage = $('<span></span>').appendTo(stageContainer).css(fullCss);

    // TODO: measure baseline distance better
    stage.text('&nbsp;');
    var min = stage.height(); // distance from top edge to baseline
    var max = 0; // distance from baseline to bottom edge

    // previous-pass and same-pass cache
    var prevWidthCache = {}, nextWidthCache = {};
    var computeCount = 0;

    var contentHandler = customCharacterHandler !== null
        ? function (text, dom) {
            var i, len = text.length;
            for (i = 0; i < len; i++) {
                // enforce per-character display, because spans with same style get auto-merged
                dom.appendChild(customCharacterHandler(text.charAt(i)));
            }
        }
        : function (text, dom) {
            dom.appendChild(document.createTextNode(text));
        }

    return {
        min: min, max: max, css: fullCss, hashCode: hashCode,
        contentHandler: contentHandler,

        computeWidth: function(text) {
            if (text === '') {
                throw new Error('must have text');
            }

            var result = nextWidthCache[text];
            if(result !== undefined)
                return result;

            // get width value from prior pass, or compute it
            result = prevWidthCache[text];
            if(result === undefined) {
                stage.empty();

                // NOTE: newlines still need to return normal space width
                contentHandler(text === "\n" ? " " : text, stage[0]);

                result = stage[0].getBoundingClientRect().width; // only works for IE9+

                computeCount++;
            }

            // store for next pass
            nextWidthCache[text] = result;

            return result;
        },

        cleanCache: function() {
            // discard previous pass cache
            prevWidthCache = nextWidthCache;
            nextWidthCache = {};

            computeCount = 0;
        }
    };
}

module.exports = createStyle;
