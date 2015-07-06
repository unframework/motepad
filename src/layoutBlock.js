var $ = require('jquery');
var binarySearch = require('./binarySearch');

module.exports = function layoutBlock(maxWidth, run) {
    var lines = [];
    var spans = [];

    var nextLineTop = 0;
    var lineWidth = 0;
    var lineSpans = [];

    var commitLineSpans = function(lineSpans) {
        var min = 0, max = 0;
        lineSpans.forEach(function (span) {
            min = Math.max(min, span.layoutMin);
            max = Math.max(max, span.layoutMax);
        });

        var x = 0;
        lineSpans.forEach(function (span) {
            span.line = lines.length;
            span.lineOffset = x;
            x += span.layoutWidth;
        });

        lines.push({ top: nextLineTop, height: min + max, min: min, firstSpan: spans.length, lastSpan: spans.length + lineSpans.length - 1 });
        spans = spans.concat(lineSpans);

        nextLineTop += min + max;
    };

    var wordSpans = [];
    var wordWidth = 0;

    // lay out the text by creating text-lines
    run(addInlineBlock, addWordBreak);

    function addInlineBlock(info, width, min, max) {
        var s = {
            info: info,
            layoutWidth: width,
            layoutMin: min,
            layoutMax: max
        };

        wordSpans.push(s);
        wordWidth += width;
    }

    function addWordBreak(isSpace, forceBreakAfter) {
        // TODO: newlines, other zero-width stuff or whatever gets normalized into spaces/etc

        // before committing the word, insert line break if it would make the line too long
        if (forceBreakAfter || (lineWidth > 0 && lineWidth + wordWidth > maxWidth)) {
            // when a space token straddles the end of line, we keep it there but still start new line
            if(isSpace || forceBreakAfter) {
                lineSpans.push(wordSpans[0]); // TODO: double-check this

                wordSpans = [];
                wordWidth = 0;
            }

            // insert line break after the line so far
            commitLineSpans(lineSpans);

            lineWidth = 0;
            lineSpans = [];
        }

        // add word to the line and start new one
        lineSpans = lineSpans.concat(wordSpans);
        lineWidth += wordWidth;

        wordSpans = [];
        wordWidth = 0;
    }

    if(wordSpans.length !== 0)
        throw "did not get trailing word break";

    // commit the remaining spans
    if(lineSpans.length > 0)
        commitLineSpans(lineSpans);

    return {
        eachSpan: function(callback) {
            spans.forEach(function (span) {
                var line = lines[span.line];
                var base = line.top + line.min;
                callback(span.info, span.lineOffset, base - span.layoutMin, span.layoutWidth, span.layoutMin + span.layoutMax);
            });
        },

        withSpan: function(textIndex, textIndexGetter, callback) {
            var span = spans[binarySearch(textIndex, 0, spans.length - 1, function(i) { return textIndexGetter(spans[i].info); })];
            var line = lines[span.line];
            var base = line.top + line.min;
            callback(span.info, span.lineOffset, base - span.layoutMin, span.layoutWidth, span.layoutMin + span.layoutMax);
        },

        withLine: function(textIndex, textIndexGetter, callback) {
            var span = spans[binarySearch(textIndex, 0, spans.length - 1, function(i) { return textIndexGetter(spans[i].info); })];
            var line = lines[span.line];
            callback(line.top, line.height);
        },

        withSpanByLocation: function(x, y, callback) {
            var line = lines[binarySearch(y, 0, lines.length - 1, function(i) { return lines[i].top; })];
            var span = spans[binarySearch(x, line.firstSpan, line.lastSpan, function(i) { return spans[i].lineOffset; })];
            var base = line.top + line.min;
            callback(span.info, span.lineOffset, base - span.layoutMin, span.layoutWidth, span.layoutMin + span.layoutMax);
        }
    };
};
