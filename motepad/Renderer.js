define(
    [ 'jQuery', 'motepad/resetCss' ],
    function($, resetMetricsCss) {

        // reusable pass-based caching logic
        function createCache() {
            var previousPass = {}, currentPass = {};

            return {
                put: function(code, createCallback) {
                    var instance = previousPass[code];
                    if(instance != null) {
                        // claim instance as used
                        delete previousPass[code];
                    } else {
                        // create new instance
                        instance = createCallback();
                    }

                    // save for next pass
                    currentPass[code] = instance;
                    return instance;
                },

                each: function(callback) {
                    for(var n in currentPass)
                        callback(currentPass[n]);

                    for(var n in previousPass)
                        callback(previousPass[n]);
                },

                removeUnused: function(disposeCallback) {
                    // claim unused instances
                    for(var n in previousPass)
                        disposeCallback(previousPass[n]);

                    // flip storage for next pass
                    previousPass = currentPass;
                    currentPass = {};
                }
            }
        }

        function initRenderer(outerContainer, container, styles) {
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

            var lastDrawnLayout = null;
            var lastDrawnSelectionId = '';

            var domWordCache = createCache();
            var domCache = createCache();

            var selectionDomCache = createCache();
            var freeSelectionDomNodes = [];

            return function render(layout, isFocused, cursorIndex, selStart, selEnd) {
                var interestTop = null, interestBottom = null;

                if(!(lastDrawnLayout === layout)) {
                    var bottom = 0;
                    var displayCodeParts = [];

                    layout.eachTextSpan(function(metaCode, spanText, left, top, width, height) {
                        // TODO: ignore the whitespace spans
                        var heavyCode = metaCode + '|' + spanText;
                        var lightCache = domWordCache.put(heavyCode, function() {
                            var result = createCache();
                            result.freeNodes = [];
                            return result;
                        });

                        // TODO: reuse same closure instance?
                        lightCache.put(left + '|' + top, function() {
                            var dom = lightCache.freeNodes.length > 0 ? lightCache.freeNodes.pop() : null;
                            if(dom == null) {
                                dom = $('<div></div>').appendTo(spanContainer);
                                dom.css(styles[metaCode].css).css({ display: 'block', position: 'absolute' });
                                dom.text(spanText);
                            } else {
                                dom.show();
                            }

                            dom.css({ top: top, left: left });

                            return dom;
                        });
                        bottom = top + height;
                    });

                    domWordCache.each(function(lightCache) {
                        lightCache.removeUnused(function(dom) {
                            lightCache.freeNodes.push(dom.hide());
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
                if(isFocused && cursorIndex != null) {
                    layout.withTextIndex(cursorIndex, function(left, top, height) {
                        cursor.stop(true).show().css({
                            left: left,
                            top: top,
                            height: height,
                            width: Math.floor(height / 16) + 1
                        }).animate({ dummy: 1 }, 400, function() {
                            if(cursor.css('display') == 'none')
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
                if(selectionId != lastDrawnSelectionId) {
                    lastDrawnSelectionId = selectionId;

                    var displayCodeParts = [];
                    var boxCss = {
                        display: 'block',
                        position: 'absolute',
                        background: isFocused ? '#ccf' : '#ccc'
                    };

                    displayCodeParts[0] = isFocused ? '1' : '';

                    if(selStart != null && selEnd != null) {
                        layout.eachRangeSpan(selStart, selEnd, function(x, y, w, h) {
                            displayCodeParts[1] = x;
                            displayCodeParts[2] = y;
                            displayCodeParts[3] = w;
                            displayCodeParts[4] = h;

                            selectionDomCache.put(displayCodeParts.join('\u0002'), function() {
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

                if(interestTop != null) {
                    // NOTE: not using innerHeight to preserve padding
                    var scrollTop = outerContainer.scrollTop();
                    var scrollBottom = scrollTop + outerContainer.height();

                    if(interestTop < scrollTop)
                        outerContainer.scrollTop(interestTop);
                    else if(interestBottom > scrollBottom)
                        outerContainer.scrollTop(scrollTop + (interestBottom - scrollBottom));
                }
            }
        }

        return initRenderer;

    }
)
