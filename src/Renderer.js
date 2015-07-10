var $ = require('jquery');
var resetMetricsCss = require('./resetCss');
var ObjectPool = require('./ObjectPool');

// @todo do not render clipped portions
function initRenderer(outerContainer, container) {
    // display element containers
    var spanContainer = $('<div></div>').appendTo(container);
    spanContainer.css(resetMetricsCss).css({
        position: 'absolute',
        left: 0, top: 0,
        cursor: 'inherit'
    });

    var cursor = $('<div></div>').appendTo(container);
    cursor.css(resetMetricsCss).css({
        position: 'absolute',
        background: '#000',
        left: 0, top: 0
    });

    var selection = $('<div></div>').prependTo(container);
    selection.css(resetMetricsCss).css({
        position: 'absolute',
        left: 0, top: 0
    });

    function createTextSpan(spanText, css, contentHandler) {
        var dom = $('<div></div>').appendTo(spanContainer);
        dom.css(css).css({ display: 'block', position: 'absolute' });

        // ignore trailing placeholder
        if (spanText !== '') {
            contentHandler(spanText, dom[0]);
        }

        return dom;
    }

    var lastDrawnLayout = null;
    var lastDrawnSelectionId = '';

    var domWordCache = new ObjectPool();
    var domCache = new ObjectPool();

    var selectionDomCache = new ObjectPool();
    var freeSelectionDomNodes = [];

    return function render(layout, isFocused, cursorIndex, selStart, selEnd) {
        if (arguments.length !== 5) {
            throw new Error('must supply all state');
        }

        var displayCodeParts;
        var interestTop = null, interestBottom = null;

        if(lastDrawnLayout !== layout) {
            var bottom = 0;
            displayCodeParts = [];

            layout.eachTextSpan(function(style, spanText, left, top, width, height) {
                bottom = top + height;

                if (spanText === ' ') {
                    return;
                }

                var heavyCode = style.hashCode + '|' + spanText;
                var lightCache = domWordCache.claim(heavyCode, function() {
                    var result = new ObjectPool();
                    result.freeNodes = [];
                    return result;
                });

                // TODO: reuse same closure instance?
                lightCache.claim(left + '|' + top, function() {
                    var dom = lightCache.freeNodes.length > 0
                        ? lightCache.freeNodes.pop()
                        : createTextSpan(spanText, style.css, style.contentHandler);

                     // only works for IE9+
                    dom.css({ transform: 'translate(' + left + 'px,' + top + 'px)' });

                    return dom;
                });
            });

            domWordCache.each(function(lightCache) {
                lightCache.removeUnused(function(dom) {
                    lightCache.freeNodes.push(dom.css({ transform: 'translate(-1000px, -1000px)' }));
                });
            });

            domWordCache.removeUnused(function(lightCache) {
                // when a word is no longer used, remove its free nodes
                // TODO: check if the cache contains stuff itself? that shouldn't happen, right?
                while(lightCache.freeNodes.length > 0)
                    lightCache.freeNodes.pop().remove();
            });

            // extend the container height for scrolling
            container.css({ height: bottom });

            lastDrawnLayout = layout;
            lastDrawnSelectionId = ''; // invalidate the last drawn selection
        }

        // render cursor if applicable
        if(isFocused && cursorIndex !== null) {
            layout.withTextIndex(cursorIndex, function(left, top, height) {
                cursor.stop(true).show().css({
                    left: left,
                    top: top,
                    height: height,
                    width: Math.floor(height / 16) + 1
                }).animate({ dummy: 1 }, 400, function() {
                    if(cursor.css('display') === 'none')
                        cursor.show();
                    else
                        cursor.hide();
                    cursor.animate({ dummy: 1 }, 400, arguments.callee);
                });

                interestTop = top;
                interestBottom = top + height;
            });
        } else {
            cursor.stop(true).hide();
        }

        // render selection, if it has changed
        var selectionId = selStart + '..' + selEnd + '!' + isFocused;
        if(selectionId !== lastDrawnSelectionId) {
            lastDrawnSelectionId = selectionId;

            displayCodeParts = [];
            var boxCss = {
                display: 'block',
                position: 'absolute',
                background: isFocused ? '#ccf' : '#ccc'
            };

            displayCodeParts[0] = isFocused ? '1' : '';

            if(selStart !== null && selEnd !== null) {
                layout.eachRangeSpan(selStart, selEnd, function(x, y, w, h) {
                    displayCodeParts[1] = x;
                    displayCodeParts[2] = y;
                    displayCodeParts[3] = w;
                    displayCodeParts[4] = h;

                    selectionDomCache.claim(displayCodeParts.join('\u0002'), function() {
                        var dom = freeSelectionDomNodes.length > 0 ? freeSelectionDomNodes.pop() : $('<div></div>').appendTo(selection);

                        boxCss.width = w;
                        boxCss.height = h;
                        boxCss.left = x;
                        boxCss.top = y;
                        dom.css(boxCss);

                        return dom;
                    });
                });

                layout.withTextIndex(selEnd, function(left, top, height) {
                    interestTop = top;
                    interestBottom = top + height;
                });
            }

            selectionDomCache.removeUnused(function(dom) {
                freeSelectionDomNodes.push(dom.hide());
            });
        }

        if(interestTop !== null) {
            // NOTE: not using innerHeight to preserve padding
            var scrollTop = outerContainer.scrollTop();
            var scrollBottom = scrollTop + outerContainer.height();

            if(interestTop < scrollTop)
                outerContainer.scrollTop(interestTop);
            else if(interestBottom > scrollBottom)
                outerContainer.scrollTop(scrollTop + (interestBottom - scrollBottom));
        }
    };
}

module.exports = initRenderer;
