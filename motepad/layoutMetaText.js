define(
    [ 'motepad/binarySearch', 'motepad/layoutBlock' ],
    function(binarySearch, layoutBlock) {

        function tokenize(text, cb) {
            var rem = text;

            while(rem.length > 0) {
                var match = /^(\s)|\S+/.exec(rem);
                var token = match[0];

                var isSpace = (match[1] != null);
                var forceBreak = token == "\n";

                cb(token, isSpace, forceBreak);

                rem = rem.substring(token.length, rem.length);
            }
        }

        return function layoutMetaText(maxWidth, text, metaBlockCallback, defaultMetaCode, metaWidth, metaMin, metaMax) {
            var layout = layoutBlock(maxWidth, function(addInlineBlock, addWordBreak) {
                var processed = 0;
                var lastMetaCode = defaultMetaCode;

                tokenize(text, function(token, isSpace, forceBreak) {
                    var textIndex = processed;

                    metaBlockCallback(token.length, function(metaCode, textLength) {
                        var info = { textIndex: textIndex, textLength: textLength, metaCode: metaCode };
                        var str = text.substring(textIndex, textIndex + textLength);
                        var width = metaWidth(metaCode, str == "\n" ? ' ' : str);

                        addInlineBlock(info, width, metaMin(metaCode), metaMax(metaCode));

                        textIndex += textLength;
                        lastMetaCode = metaCode;
                    });

                    addWordBreak(isSpace, forceBreak);

                    if(textIndex != processed + token.length)
                        throw "meta block length mismatch: " + (processed + token.length - textLength);

                    processed += token.length;
                });

                // add a zero-width placeholder at the very end
                // TODO: handle empty last style properly
                addInlineBlock({ textIndex: processed, textLength: 0, metaCode: lastMetaCode }, 0, metaMin(lastMetaCode), metaMax(lastMetaCode));
                addWordBreak(false, false);
            });

            function computeSpanOffset(info, textIndex) {
                return metaWidth(info.metaCode, text.substring(info.textIndex, textIndex));
            }

            return {
                findTextIndex: function(x, y) {
                    var result = 0;

                    layout.withSpanByLocation(x, y, function(info, left, top, width, height) {
                        result = info.textLength < 1 ?
                            info.textIndex :
                            binarySearch(x - left, info.textIndex, info.textIndex + info.textLength - 1, function(i) { return computeSpanOffset(info, i) });
                    });

                    return result;
                },

                eachTextSpan: function(callback) {
                    layout.eachSpan(function(info, left, top, width, height) {
                        var spanText = text.substring(info.textIndex, info.textIndex + info.textLength);
                        callback(info.metaCode, spanText, left, top, width, height);
                    });
                },

                eachRangeSpan: function(selStart, selEnd, callback) {
                    if(selStart > selEnd) {
                        var t = selEnd;
                        selEnd = selStart;
                        selStart = t;
                    }

                    var started = false;
                    var finished = false;

                    layout.eachSpan(function(info, x, y, w, h) {
                        var startOffset = 0;
                        var endOffset = w;

                        if(!started) {
                            if(info.textIndex + info.textLength > selStart) {
                                started = true;
                                startOffset = computeSpanOffset(info, selStart);
                            }
                        }

                        if(!finished) {
                            if(info.textIndex + info.textLength > selEnd)
                                endOffset = computeSpanOffset(info, selEnd);

                            if(info.textIndex > selEnd)
                                finished = true;
                        }

                        if(started & !finished) {
                            callback(x + startOffset, y, endOffset - startOffset, h);
                        }
                    });
                },

                withTextIndex: function(textIndex, callback) {
                    layout.withSpan(textIndex, function(info) { return info.textIndex }, function(info, left, top, width, height) {
                        var charOffset = computeSpanOffset(info, textIndex);
                        callback(left + charOffset, top, height);
                    });
                },

                withTextLine: function(textIndex, callback) {
                    layout.withLine(textIndex, function(info) { return info.textIndex }, function(top, height) {
                        callback(top, height);
                    });
                }
            }
        }

    }
)