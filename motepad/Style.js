define(
    [ 'jQuery' ],
    function($) {

        function createStyle(stageContainer, extraCss) {
            var fullCss = $.extend({
                'font': 'inherit'
            }, extraCss, {
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

            return {
                min: min, max: max, css: fullCss,

                computeWidth: function(text) {
                    var result = nextWidthCache[text];
                    if(result != null)
                        return result;

                    // get width value from prior pass, or compute it
                    result = prevWidthCache[text];
                    if(result == null) {
                        // NOTE: newlines still need to return normal space width
                        stage.text(text == "\n" ? " " : text);
                        result = stage.width();

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

                    console.log('computed: ' + computeCount);
                    computeCount = 0;
                }
            }
        }

        return createStyle;

    }
)