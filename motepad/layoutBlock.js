define(
    [ 'jQuery', 'motepad/binarySearch' ],
    function($, binarySearch) {

        return function layoutBlock(maxWidth, eachToken) {
            var lines = [];
            var spans = [];

            var nextLineTop = 0;
            var lineWidth = 0;
            var lineSpans = [];

            var commitLineSpans = function(lineSpans) {
                var min = 0, max = 0;
                $.each(lineSpans, function(i, span) {
                    min = Math.max(min, span.layoutMin);
                    max = Math.max(max, span.layoutMax);
                });

                var x = 0;
                $.each(lineSpans, function(i, span) {
                    span.line = lines.length;
                    span.lineOffset = x;
                    x += span.layoutWidth;
                });

                lines.push({ top: nextLineTop, height: min + max, min: min, firstSpan: spans.length, lastSpan: spans.length + lineSpans.length - 1 });
                spans = spans.concat(lineSpans);

                nextLineTop += min + max;
            };

            // lay out the text by creating text-lines
            eachToken(function(isSpace, forceBreak, eachInlineBlock) {
                var tokenSpans = [];
                var tokenWidth = 0;

                eachInlineBlock(function(info, width, min, max) {
                    var s = {
                        info: info,
                        layoutWidth: width,
                        layoutMin: min,
                        layoutMax: max
                    };

                    tokenSpans.push(s);
                    tokenWidth += width;
                });

                // TODO: newlines, other zero-width stuff or whatever gets normalized into spaces/etc

                if(forceBreak || (lineWidth > 0 && lineWidth + tokenWidth > maxWidth)) {
                    // when a space token straddles the end of line, we keep it there but still start new line
                    // NOTE: we also always do this for the line-break blocks
                    if(isSpace || forceBreak) {
                        lineSpans.push(tokenSpans[0]);

                        tokenSpans = [];
                        tokenWidth = 0;
                    }

                    commitLineSpans(lineSpans);

                    lineWidth = 0;
                    lineSpans = [];
                }

                lineSpans = lineSpans.concat(tokenSpans);
                lineWidth += tokenWidth;
            });

            // commit the remaining spans
            if(lineSpans.length > 0)
                commitLineSpans(lineSpans);

            return {
                eachSpan: function(callback) {
                    $.each(spans, function(i, span) {
                        var line = lines[span.line];
                        var base = line.top + line.min;
                        callback(span.info, span.lineOffset, base - span.layoutMin, span.layoutWidth, span.layoutMin + span.layoutMax);
                    });
                },

                withSpan: function(textIndex, textIndexGetter, callback) {
                    var span = spans[binarySearch(textIndex, 0, spans.length - 1, function(i) { return textIndexGetter(spans[i].info) })];
                    var line = lines[span.line];
                    var base = line.top + line.min;
                    callback(span.info, span.lineOffset, base - span.layoutMin, span.layoutWidth, span.layoutMin + span.layoutMax);
                },

                withLine: function(textIndex, textIndexGetter, callback) {
                    var span = spans[binarySearch(textIndex, 0, spans.length - 1, function(i) { return textIndexGetter(spans[i].info) })];
                    var line = lines[span.line];
                    callback(line.top, line.height);
                },

                withSpanByLocation: function(x, y, callback) {
                    var line = lines[binarySearch(y, 0, lines.length - 1, function(i) { return lines[i].top })];
                    var span = spans[binarySearch(x, line.firstSpan, line.lastSpan, function(i) { return spans[i].lineOffset })];
                    var base = line.top + line.min;
                    callback(span.info, span.lineOffset, base - span.layoutMin, span.layoutWidth, span.layoutMin + span.layoutMax);
                }
            };
        }

    }
)