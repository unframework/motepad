define(
    ['jquery-1.9.1.min', 'htmlparser'],
    function(jq, HTMLParser) {

        function binarySearch(value, first, last, getter) {
            var count = 0;
            while(first < last) {
                var midLine = first + Math.ceil((last - first) / 2);
                var midValue = getter(midLine);
        
                if(midValue <= value)
                    first = midLine;
                else
                    last = midLine - 1;
        
                // TODO: remove
                count++;
                if(count > 100)
                    throw "stuck in a loop for " + first + ' vs ' + last;
            }
        
            return last;
        }
        
        function layoutBlock(maxWidth, eachToken) {
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
        
        function layoutMetaText(maxWidth, text, metaBlockCallback, defaultMetaCode, metaWidth, metaMin, metaMax) {
            var layout = layoutBlock(maxWidth, function(tokenCallback) {
                var rem = text;
                var processed = 0;
        
                var lastMetaCode = defaultMetaCode;
        
                while(rem.length > 0) {
                    var match = /^(\s)|\S+/.exec(rem);
                    var token = match[0];
        
                    var isSpace = (match[1] != null);
                    var forceBreak = token == "\n";
        
                    tokenCallback(isSpace, forceBreak, function(inlineBlockCallback) {
                        var textIndex = processed;
        
                        metaBlockCallback(token.length, function(metaCode, textLength) {
                            var info = { textIndex: textIndex, textLength: textLength, metaCode: metaCode };
                            var str = text.substring(textIndex, textIndex + textLength);
                            var width = metaWidth(metaCode, str == "\n" ? ' ' : str);
        
                            inlineBlockCallback(info, width, metaMin(metaCode), metaMax(metaCode));
        
                            textIndex += textLength;
                            lastMetaCode = metaCode;
                        });
        
                        if(textIndex != processed + token.length)
                            throw "meta block length mismatch: " + (processed + token.length - textLength);
                    });
        
                    rem = rem.substring(token.length, rem.length);
                    processed += token.length;
                }
        
                // add a zero-width placeholder at the very end
                // TODO: handle empty last style properly
                tokenCallback(false, false, function(inlineBlockCallback) {
                    inlineBlockCallback({ textIndex: processed, textLength: 0, metaCode: lastMetaCode }, 0, metaMin(lastMetaCode), metaMax(lastMetaCode));
                });
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
        
        var richTextDataId = 'richText_ba4c44091e9a88f061d31dab36cb7e20';
        
        $.fn.richText = function(command, arg) {
            var parent = this.eq(0);
            if(parent.length < 1)
                return this;
        
            var commands = parent.data(richTextDataId);
        
            if(commands == null) {
                commands = init(parent);
                parent.data(richTextDataId, commands);
            }
        }
        
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
        
        function createAttributeSequence() {
            return createAttributeSequenceImpl([]);
        }
        
        function createAttributeSequenceImpl(runs) {
            function eachRun(callback) {
                var start = 0;
                $.each(runs, function(i, run) {
                    var r = callback(i, run, start);
                    start += run.length;
                    return r;
                });
            }
        
            var self = {
                insert: function(value, start, length) {
                    var newRuns = [];
                    var hit = false;
        
                    // TODO: merge similar runs
                    eachRun(function(i, run, runStart) {
                        if(runStart + run.length <= start) {
                            newRuns.push(run);
                        } else {
                            if(run.value == value) {
                                // simple merge
                                newRuns.push({ value: value, length: run.length + length });
                            } else {
                                // split the old run in two
                                var lenA = start - runStart;
                                var lenB = runStart + run.length - start;
        
                                if(lenA > 0) {
                                    newRuns.push({ value: run.value, length: lenA });
                                } else {
                                    // the new run comes in contact with previous run
                                    if(newRuns.length > 0) {
                                        var lastRun = newRuns[newRuns.length - 1];
                                        if(lastRun.value == value) {
                                            length += lastRun.length;
                                            newRuns.pop(); // remove the last run (it is unmodifiable)
                                        }
                                    }
                                }
        
                                newRuns.push({ value: value, length: length });
                                newRuns.push({ value: run.value, length: lenB });
                            }
        
                            // copy the rest of the runs
                            newRuns = newRuns.concat(runs.slice(i + 1));
        
                            // break out of the loop
                            hit = true;
                            return false;
                        }
                    });
                    
                    if(!hit) {
                        // the new run comes in contact with previous run
                        if(newRuns.length > 0) {
                            var lastRun = newRuns[newRuns.length - 1];
                            if(lastRun.value == value) {
                                length += lastRun.length;
                                newRuns.pop(); // remove the last run (it is unmodifiable)
                            }
                        }
        
                        newRuns.push({ value: value, length: length });
                    }
        
                    return createAttributeSequenceImpl(newRuns);
                },
        
                insertAll: function(all, start) {
                    var newRuns = [];
                    var hit = false;
        
                    var added = null;
                    var remainder = null;
        
                    // TODO: merge similar runs
                    eachRun(function(i, run, runStart) {
                        if(runStart + run.length <= start) {
                            newRuns.push(run);
                        } else {
                            // split the old run in two
                            var lenA = start - runStart;
                            var lenB = runStart + run.length - start;
        
                            added = [ { value: run.value, length: lenA }].concat(all);
                            added.push({ value: run.value, length: lenB });
        
                            remainder = runs.slice(i + 1);
        
                            // break out of the loop
                            return false;
                        }
                    });
        
                    // if no match above, it is a simple append
                    if(added == null) {
                        added = all;
                        remainder = [];
                    }
        
                    var mergeRun = null;
        
                    $.each(added, function(i, add) {
                        // skip empty runs
                        if(add.length < 1)
                            return;
        
                        if(mergeRun != null) {
                            if(mergeRun.value == add.value) {
                                mergeRun.length += add.length;
                            } else {
                                newRuns.push(add); // TODO: copy external data?
                                mergeRun = add;
                            }
                        } else {
                            // the new run comes in contact with unmodifiable run
                            if(newRuns.length > 0) {
                                var lastRun = newRuns[newRuns.length - 1];
                                if(lastRun.value == add.value) {
                                    add.length += lastRun.length;
                                    newRuns.pop(); // remove the unmodifiable run
                                }
                            }
        
                            newRuns.push(add);
                        }
                    });
        
                    // copy the rest of the runs
                    // NOTE: no need to merge with remaining runs (slice B of this run is always non-empty)
                    newRuns = newRuns.concat(remainder);
        
                    return createAttributeSequenceImpl(newRuns);
                },
        
                remove: function(start, length) {
                    var end = start + length;
                    var newRuns = [];
        
                    var mergeRun = null;
        
                    // TODO: merge similar runs
                    eachRun(function(i, run, runStart) {
                        if(runStart + run.length <= start) {
                            newRuns.push(run);
                        } else if(runStart < end) {
                            if(runStart < start) {
                                // keep the starting segment
                                mergeRun = { value: run.value, length: start - runStart };
                                newRuns.push(mergeRun);
                            }
        
                            if(runStart + run.length >= end) {
                                // keep the ending segment
                                var len = runStart + run.length - end;
                                if(len > 0) {
                                    if(mergeRun != null) {
                                        // try and merge with a starting segment
                                        if(mergeRun.value == run.value) {
                                            mergeRun.length += len;
                                        } else {
                                            mergeRun = { value: run.value, length: len };
                                            newRuns.push(mergeRun);
                                        }
                                    } else {
                                        // if no starting segment, try merging with last run
                                        if(newRuns.length > 0) {
                                            var lastRun = newRuns[newRuns.length - 1];
                                            if(lastRun.value == run.value) {
                                                len += lastRun.length;
                                                newRuns.pop(); // remove the last run (it is unmodifiable)
                                            }
                                        }
        
                                        mergeRun = { value: run.value, length: len };
                                        newRuns.push(mergeRun);
                                    }
                                }
                            }
                        } else {
                            var mergeDone = false;
        
                            // no need to merge with leftover segments
                            if(mergeRun == null) {
                                // potential merge with last run
                                if(newRuns.length > 0) {
                                    var lastRun = newRuns[newRuns.length - 1];
                                    if(lastRun.value == run.value) {
                                        newRuns.pop(); // remove the last run (it is unmodifiable)
                                        newRuns.push({ value: run.value, length: run.length + lastRun.length });
                                        mergeDone = true;
                                    }
                                }
                            }
        
                            // if no merge, just reuse current run
                            if(!mergeDone)
                                newRuns.push(run);
        
                            // copy over the remainder
                            newRuns = newRuns.concat(runs.slice(i + 1));
        
                            // break out of the loop
                            return false;
                        }
                    });
        
                    return createAttributeSequenceImpl(newRuns);
                },
        
                set: function(value, start, length) {
                    var end = start + length;
                    var newRuns = [];
        
                    var mergeRun = null;
        
                    eachRun(function(i, run, runStart) {
                        if(runStart + run.length <= start) {
                            newRuns.push(run);
                        } else if(runStart < end) {
                            if(runStart < start) {
                                // keep the starting segment
                                mergeRun = { value: run.value, length: start - runStart };
                                newRuns.push(mergeRun);
                            }
        
                            if(runStart <= start) {
                                if(mergeRun != null) {
                                    // try to merge with starting segment
                                    if(mergeRun.value == value) {
                                        mergeRun.length += length;
                                    } else {
                                        mergeRun = { value: value, length: length };
                                        newRuns.push(mergeRun);
                                    }
                                } else {
                                    // try to merge with last run
                                    if(newRuns.length > 0) {
                                        var lastRun = newRuns[newRuns.length - 1];
                                        if(lastRun.value == value) {
                                            length += lastRun.length;
                                            newRuns.pop(); // remove the last run (it is unmodifiable)
                                        }
                                    }
        
                                    mergeRun = { value: value, length: length };
                                    newRuns.push(mergeRun);
                                }
                            }
        
                            // keep the ending segment
                            if(runStart + run.length > end) {
                                var len = runStart + run.length - end;
        
                                if(mergeRun.value == run.value) {
                                    mergeRun.length += len;
                                } else {
                                    newRuns.push({ value: run.value, length: len });
                                }
        
                                // non-empty ending segment precludes further merges
                                mergeRun = null;
                            }
                        } else {
                            if(mergeRun != null && mergeRun.value == run.value) {
                                mergeRun.length += run.length;
                            } else {
                                newRuns.push(run);
                            }
                            
                            // copy over the remainder
                            newRuns = newRuns.concat(runs.slice(i + 1));
        
                            // break out of the loop
                            return false;
                        }
                    });
        
                    return createAttributeSequenceImpl(newRuns);
                },
        
                eachRun: function(start, length, callback) {
                    var end = start + length;
        
                    eachRun(function(i, run, runStart) {
                        if(runStart + run.length <= start) {
                            // ignore this run
                        } else {
                            var sliceStart = Math.max(start, runStart);
                            var sliceEnd = Math.min(end, runStart + run.length);
                            var sliceLength = sliceEnd - sliceStart;
                            callback(run.value, sliceStart, sliceLength);
                            
                            // when this run is touching range end, ignore the rest of the runs
                            if(runStart + run.length >= end)
                                return false;
                        }
                    });
                },
        
                createConsumer: function() {
                    var currentRun = 0;
                    var currentRunLength = runs.length > 0 ? runs[0].length : null;
        
                    var consumer = {
                        runLength: currentRunLength,
                        runValue: runs.length > 0 ? runs[0].value : null,
                        advance: function(len) {
                            currentRunLength -= len;
                            if(currentRunLength < 0)
                                throw "cannot consume past current run length";
        
                            if(currentRunLength == 0) {
                                currentRun++;
        
                                if(currentRun >= runs.length) {
                                    currentRunLength = null;
                                    consumer.runValue = null;
                                } else {
                                    currentRunLength = runs[currentRun].length;
                                    consumer.runValue = runs[currentRun].value;
                                }
                            }
        
                            consumer.runLength = currentRunLength;
                        }
                    };
        
                    return consumer;
                }
            };
        
            return self;
        }
        
        createAttributeSequence().insert('test', 0, 11).insert('test', 1, 9).insert('test2', 5, 10).set('test', 5, 10).eachRun(0, 30, function(v, s, len) {
            console.log('- ' + v + ' ' + s + ',' + len);
        });
        
        // TODO: IE unselectable
        var resetMetricsCss = {
            padding: 0, border: 'none', margin: 0,
            font: 'inherit', cursor: 'inherit',
            '-moz-user-select': '-moz-none',
            '-khtml-user-select': 'none',
            '-webkit-user-select': 'none',
            '-o-user-select': 'none',
            'user-select': 'none'
        }
        
        var attributeInfo = {
            /*
            link: {
                defaultValue: null,
                applyVisual: function(v, css) {
                    if(v != null) {
                        css['color'] = '#00f';
                        css['border-bottom'] = '1px solid #00f';
                    }
                    return v != null ? '1' : ''
                },
                parseHtmlTag: function(tag, styleAttrs, attrs) {
                    if(tag == 'a') {
                        return attrs['href'];
                    }
                },
                openHtmlTag: function(v) { return (v ? '<a>' : '') },
                closeHtmlTag: function(v) { return (v ? '</a>' : '') }
            },
            */
            bold: {
                defaultValue: false,
                applyVisual: function(v, css) { css['font-weight'] = v ? 'bold' : 'normal'; return v ? '1' : '' },
                parseHtmlTag: function(tag, styleAttrs) {
                    if(tag == 'b' || tag == 'strong' || styleAttrs['font-weight'] == 'bold')
                        return true;
                },
                openHtmlTag: function(v) { return (v ? '<b>' : '') },
                closeHtmlTag: function(v) { return (v ? '</b>' : '') }
            },
            italic: {
                defaultValue: false,
                applyVisual: function(v, css) { css['font-style'] = v ? 'italic' : 'normal'; return v ? '1' : '' },
                parseHtmlTag: function(tag, styleAttrs) {
                    if(tag == 'i' || tag == 'em' || styleAttrs['font-style'] == 'italic')
                        return true;
                },
                openHtmlTag: function(v) { return (v ? '<i>' : '') },
                closeHtmlTag: function(v) { return (v ? '</i>' : '') }
            }
        }
        
        function init(parent) {
            var outerContainer = $('<div></div>').addClass('editArea').insertAfter(parent).css({
                cursor: 'text',
                overflow: '-moz-scrollbars-vertical',
                'overflow-x': 'hidden',
                'overflow-y': 'scroll'
            });
            parent.hide();
        
            var container = $('<div></div>').appendTo(outerContainer).css(resetMetricsCss).css({
                display: 'block', position: 'relative', left: 0, top: 0
            });
        
            var extentsStageContainer = $('<div></div>').css(resetMetricsCss).css({
                position: 'absolute',
                top: '0px', left: '-3000px',
                width: '1999px', height: '1px',
                overflow: 'hidden'
            }).appendTo(container);
        
            var text = '';
            var attributes = {
            };
        
            for(var n in attributeInfo) {
                attributes[n] = createAttributeSequence();
            }
        
            var styles = { };
        
            function getStyleCode(values) {
                var codeParts = [];
                var css = {};
                for(var n in attributeInfo) {
                    codeParts.push(n);
                    codeParts.push(attributeInfo[n].applyVisual(values[n], css));
                }
        
                var code = codeParts.join("\u0001");
        
                if(styles[code] == null)
                    styles[code] = createStyle(extentsStageContainer, css);
                return code;
            }
        
            function getAttributeValues(name, index, length) {
                var values = [];
                attributes[name].eachRun(index, length, function(v) { values.push(v) });
                return values;
            }
        
            var inputHandler = null;
        
            var render = initRenderer(outerContainer, container, styles);
        
            initInput(outerContainer, container, undo, redo, function(inputType, arg) {
                inputHandler(inputType, arg);
            });
        
            // TODO: not store the computed layout in the state closure? it's fairly compact, though
            var undoStack = [];
            var undoDepth = -1;
        
            function undoable(callback) {
                // remember the state right before the operation
                // TODO: better consistency check with this level's text content?
                if(undoDepth >= 0)
                    undoStack[undoDepth].beforeNextOp = inputHandler;
        
                callback();
        
                // log the state right after
                undoDepth++;
                undoStack.splice(undoDepth);
                undoStack.push({ text: text, attributes: $.extend({}, attributes), afterPrevOp: inputHandler });
            }
        
            function undo() {
                if(undoDepth < 1)
                    return;
        
                undoDepth--;
                var level = undoStack[undoDepth];
                text = level.text;
                attributes = $.extend({}, level.attributes);
                level.beforeNextOp('refresh');
            }
        
            function redo() {
                if(undoDepth >= undoStack.length - 1)
                    return;
        
                undoDepth++;
                var level = undoStack[undoDepth];
                text = level.text;
                attributes = $.extend({}, level.attributes);
                level.afterPrevOp('refresh');
            }
        
            function layoutRichText() {
                var areaWidth = container.width();
        
                /*
                for(var n in attributes) {
                    console.log('-- attr: ' + n);
                    attributes[n].eachRun(0, 1000, function(value, i, length) { console.log('  ' + length + ': ' + value) })
                }
                console.log('--------');
                */
        
                var currentValues = {};
                for(var n in attributeInfo)
                    currentValues[n] = attributeInfo[n].defaultValue;
        
                var defaultMetaCode = getStyleCode(currentValues);
        
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
                            if(consumers[n].runLength == null)
                                throw "consumer overrun!";
        
                            textLength = Math.min(textLength, consumers[n].runLength);
                            currentValues[n] = consumers[n].runValue;
                        }
        
                        var metaCode = getStyleCode(currentValues);
        
                        callback(metaCode, textLength);
        
                        for(var n in consumers)
                            consumers[n].advance(textLength);
        
                        leftover -= textLength;
                    }
                }, defaultMetaCode, function(metaCode, spanText) {
                    return styles[metaCode].computeWidth(spanText);
                }, function(metaCode) {
                    return styles[metaCode].min;
                }, function(metaCode) {
                    return styles[metaCode].max;
                });
                
                // free up style cache memory
                for(var n in styles)
                    styles[n].cleanCache();
        
                return result;
            }
        
            function insertHTML(start, html) {
                var newText = '';
                var newAttributes = {
                };
        
                function startRun(name, value) {
                    newAttributes[name].push({ value: value, length: 0 });
                }
        
                for(var n in attributeInfo) {
                    newAttributes[n] = [];
                    startRun(n, attributeInfo[n].defaultValue);
                }
        
                var stack = [];
        
                function addChars(chars) {
                    newText = newText + chars;
        
                    // grow current attribute runs
                    var len = chars.length;
                    for(var n in newAttributes) {
                        var a = newAttributes[n];
                        a[a.length - 1].length += len;
                    }
                }
        
                HTMLParser(html, {
                    start: function(tag, attrList, unary) {
                        // unary tags are ignored, except for BR
                        if(unary) {
                            if(tag == 'br')
                                addChars("\n");
                            return;
                        }
        
                        var attrs = {};
                        $.each(attrList, function(i, a) { attrs[a.name] = a.value });
        
                        var style = attrs.style;
                        var styleAttrs = {};
                        $.each((style == null ? '' : style).split(';'), function(i, s) {
                            var p = s.split(':');
                            if(p.length == 2)
                                styleAttrs[$.trim(p[0])] = $.trim(p[1]);
                        });
        
                        // create a stack level for this tag
                        var level = [];
                        stack.push(level);
        
                        // start new runs
                        for(var n in attributeInfo) {
                            var v = attributeInfo[n].parseHtmlTag(tag, styleAttrs, attrs);
                            if(v != null) {
                                startRun(n, v);
                                level.push(n);
                            }
                        }
                    },
                    end: function(tag) {
                        // close this stack level's runs
                        $.each(stack.pop(), function(i, attr) { startRun(attr, attributeInfo[attr].defaultValue) });
        
                        // when block elements close, add double-newline
                        // TODO: support other block elements?
                        if(tag == 'p' || tag == 'div') {
                            addChars("\n\n");
                        }
                    },
                    chars: function(chars) {
                        chars = chars.replace(/\s+/g, " "); // normalize whitespace
                        addChars(chars);
                    },
                    comment: function(text) {}
                });
        
                text = text.substring(0, start) + newText + text.substring(start);
                for(var n in attributes)
                    attributes[n] = attributes[n].insertAll(newAttributes[n], start);
            }
        
            function toHTML(start, length) {
                var slices = [ { start: start, values: {} } ];
        
                for(var n in attributes) {
                    var sliceIndex = 0;
                    var slice = slices[sliceIndex];
        
                    attributes[n].eachRun(start, length, function(v, vs, vlen) {
                        // if range starts before current slice, subdivide previous slice
                        if(slice == null || slices[sliceIndex].start > vs) {
                            slice = { start: vs, values: $.extend({}, slices[sliceIndex - 1].values) };
                            slices.splice(sliceIndex, 0, slice);
                        }
        
                        // fill this and the rest of the slices within range
                        var vend = vs + vlen;
                        while(slice != null && slice.start < vend) {
                            slice.values[n] = v;
        
                            sliceIndex++;
                            slice = slices[sliceIndex];
                        }
                    });
                }
        
                var out = [];
        
                function startTag(name, value) {
                    var txt = attributeInfo[name].openHtmlTag(value);
                    if(txt.length > 0)
                        out.push(txt);
                }
        
                function endTag(name, value) {
                    var txt = attributeInfo[name].closeHtmlTag(value);
                    if(txt.length > 0)
                        out.push(txt);
                }
        
                function appendText(txt) {
                    out.push(txt.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace("\n", '<br />'));
                }
        
                var tagOrder = [];
                for(var n in attributeInfo)
                    tagOrder.push(n);
        
                var lastValues = {};
                var lastStart = null;
        
                $.each(slices, function(i, slice) {
                    if(i == 0) {
                        // start all the tags
                        for(var n in attributeInfo) {
                            var nv = slice.values[n];
                            lastValues[n] = nv;
                            startTag(n, nv);
                        }
                    } else {
                        // determine how deeply to unwind the current tags
                        var sameLevel = -1;
                        for(var n in attributeInfo) {
                            if(slice.values[n] != lastValues[n])
                                break;
        
                            lastValues[n] = slice.values[n];
                            sameLevel++;
                        }
        
                        // append previous slice's text
                        appendText(text.substring(lastStart, slice.start));
        
                        // end last attribute values
                        for(var i = tagOrder.length - 1; i > sameLevel; i--) {
                            var tn = tagOrder[i];
                            endTag(tn, lastValues[tn]);
                        }
        
                        // start new attribute values
                        for(var i = sameLevel + 1; i < tagOrder.length; i++) {
                            var tn = tagOrder[i];
                            startTag(tn, lastValues[tn] = slice.values[tn]);
                        }
                    }
        
                    lastStart = slice.start;
                });
        
                // append last slice's text
                appendText(text.substring(lastStart));
        
                // finish up tags
                for(var i = tagOrder.length - 1; i >= 0; i--) {
                    var tn = tagOrder[i];
                    endTag(tn, lastValues[tn]);
                }
        
                return out.join('');
            }
        
            function cursorMode(layout, isFocused, cursorIndex, intendedOffset, entryAttributes) {
                if(cursorIndex < 0 || cursorIndex > text.length)
                    throw "out of bounds";
        
                // render the cursor
                render(layout, isFocused, cursorIndex);
        
                function currentAttributes() {
                    var values = {};
        
                    if(text.length > 0) {
                        var activeIndex = cursorIndex > 0 ? cursorIndex - 1 : cursorIndex;
                        for(var n in attributes)
                            attributes[n].eachRun(activeIndex, 1, function(v) { values[n] = v });
                    } else {
                        for(var n in attributeInfo)
                            values[n] = attributeInfo[n].defaultValue;
                    }
        
                    return values;
                }
        
                inputHandler = function(input, arg) {
                    if(input == "character") {
                        var delta = (arg > 0 ? 1 : -1);
                        var ni = Math.max(0, Math.min(text.length, cursorIndex + delta));
        
                        cursorMode(layout, isFocused, ni);
                    } else if(input == "line") {
                        var offset = intendedOffset;
                        if(offset == null)
                            layout.withTextIndex(cursorIndex, function(left) { offset = left; });
        
                        var edge = 0;
                        layout.withTextLine(cursorIndex, function(top, height) { edge = arg < 0 ? top - 1 : top + height + 1; });
                        var ni = layout.findTextIndex(offset, edge);
        
                        cursorMode(layout, isFocused, ni, offset);
                    } else if(input == "inLine") {
                        var newOffset = arg < 0 ? -1 : Number.POSITIVE_INFINITY;
                        var edge = 0;
                        layout.withTextLine(cursorIndex, function(top, height) { edge = top; });
                        var ni = layout.findTextIndex(newOffset, edge);
        
                        cursorMode(layout, isFocused, ni, newOffset);
                    } else if(input == "characterSelect" || input == "lineSelect" || input == "inLineSelect") {
                        // switch to selected mode with zero-length selection and repeat the command
                        selectedMode(layout, isFocused, cursorIndex, cursorIndex);
                        inputHandler(input, arg);
                    } else if(input == "mouseDown") {
                        var ni = layout.findTextIndex(arg.x, arg.y);
                        draggingMode(layout, ni, ni);
                    } else if(input == "delete") {
                        var delIndex = arg ? cursorIndex - 1 : cursorIndex;
                        if(delIndex >= 0 && delIndex < text.length) {
                            undoable(function() {
        
                                text = text.substring(0, delIndex) + text.substring(delIndex + 1);
                                for(var n in attributes)
                                    attributes[n] = attributes[n].remove(delIndex, 1);
        
                                var newLayout = layoutRichText();
                                cursorMode(newLayout, isFocused, delIndex);
        
                            });
                        }
                    } else if(input == "insert") {
                        undoable(function() {
        
                            var values = entryAttributes == null ? currentAttributes() : entryAttributes;
        
                            text = text.substring(0, cursorIndex) + arg + text.substring(cursorIndex);
                            for(var n in attributes)
                                attributes[n] = attributes[n].insert(values[n], cursorIndex, arg.length);
        
                            var newLayout = layoutRichText();
                            cursorMode(newLayout, isFocused, cursorIndex + arg.length, null, values);
        
                        });
                    } else if(input == "pasteHtml") {
                        undoable(function() {
                            var distanceFromEnd = text.length - cursorIndex;
                            insertHTML(cursorIndex, arg);
        
                            var newLayout = layoutRichText();
                            cursorMode(newLayout, isFocused, text.length - distanceFromEnd);
                        });
                    } else if(input == "styleModifier") {
                        var nm = entryAttributes == null ? currentAttributes() : $.extend({}, entryAttributes);
                        if(arg == 'bold' || arg == 'italic')
                            nm[arg] = !nm[arg];
                        cursorMode(layout, isFocused, cursorIndex, null, nm);
                    } else if(input == "activeAttributeValues") {
                        if(text.length > 0) {
                            return getAttributeValues(arg, cursorIndex > 0 ? cursorIndex - 1 : cursorIndex, 1);
                        } else {
                            return [ attributeInfo[arg].defaultValue ];
                        }
                    } else if(input == "refresh") {
                        cursorMode(layout, isFocused, cursorIndex);
                    } else if(input == "focusUpdate") {
                        cursorMode(layout, arg, cursorIndex);
                    }
                };
            }
        
            function draggingMode(layout, startIndex, endIndex) {
                render(layout, true, endIndex, startIndex, endIndex);
        
                inputHandler = function(input, arg) {
                    if(input == "mouseMove") {
                        var ni = layout.findTextIndex(arg.x, arg.y);
                        draggingMode(layout, startIndex, ni);
                    } else if(input == "mouseUp") {
                        var ni = layout.findTextIndex(arg.x, arg.y);
                        if(ni == startIndex)
                            cursorMode(layout, true, ni);
                        else
                            selectedMode(layout, true, startIndex, ni);
                    } else if(input == "focusUpdate") {
                        cursorMode(layout, arg, startIndex);
                    } else if(input == "activeAttributeValues") {
                        cursorMode(layout, true, startIndex);
                        return inputHandler("activeAttributeValues", arg); // TODO: this better
                    } else if(input == "refresh") {
                        throw "should not end up in dragging mode after undo/redo";
                    }
                };
            }
        
            function selectedMode(layout, isFocused, startIndex, endIndex, intendedOffset) {
                render(layout, isFocused, endIndex, startIndex, endIndex);
        
                // TODO: keep checking that the selection is non-empty
                inputHandler = function(input, arg) {
                    if(input == "mouseDown") {
                        var ni = layout.findTextIndex(arg.x, arg.y);
                        draggingMode(layout, ni, ni);
                    } else if(input == "characterSelect") {
                        var delta = (arg > 0 ? 1 : -1);
                        var ni = Math.max(0, Math.min(text.length, endIndex + delta));
        
                        selectedMode(layout, isFocused, startIndex, ni);
                    } else if(input == "lineSelect") {
                        var offset = intendedOffset;
                        if(offset == null)
                            layout.withTextIndex(endIndex, function(left) { offset = left; });
        
                        var edge = 0;
                        layout.withTextLine(endIndex, function(top, height) { edge = arg < 0 ? top - 1 : top + height + 1; });
                        var ni = layout.findTextIndex(offset, edge);
        
                        selectedMode(layout, isFocused, startIndex, ni, offset);
                    } else if(input == "inLineSelect") {
                        var newOffset = arg < 0 ? -1 : Number.POSITIVE_INFINITY;
                        var edge = 0;
                        layout.withTextLine(endIndex, function(top, height) { edge = top; });
                        var ni = layout.findTextIndex(newOffset, edge);
        
                        selectedMode(layout, isFocused, startIndex, ni, newOffset);
                    } else if(input == "character" || input == "line" || input == "inLine") {
                        // switch to cursor mode and repeat the command
                        cursorMode(layout, isFocused, endIndex);
                        inputHandler(input, arg);
                    } else if(input == "insert" || input == "delete" || input == "pasteHtml") {
                        undoable(function() {
        
                            var a = Math.min(startIndex, endIndex);
                            var b = Math.max(startIndex, endIndex);
        
                            // delete the selection, switch to cursor mode and (if inserting) repeat the command
                            text = text.substring(0, a) + text.substring(b);
                            for(var n in attributes)
                                attributes[n] = attributes[n].remove(a, b - a);
        
                            var newLayout = layoutRichText();
                            cursorMode(newLayout, isFocused, a);
        
                        }); // NOTE: doing a two-step undo here
        
                        if(input != "delete")
                            inputHandler(input, arg);
                    } else if(input == "styleModifier") {
                        undoable(function() {
        
                            var a = Math.min(startIndex, endIndex);
                            var b = Math.max(startIndex, endIndex);
        
                            if(arg == 'bold' || arg == 'italic') {
                                // if at least one character is missing this style flag, don't remove it
                                var newValue = false;
        
                                var av = getAttributeValues(arg, a, b - a);
                                $.each(av, function(i, v) { if(!v) { newValue = true; return false; } });
        
                                attributes[arg] = attributes[arg].set(newValue, a, b - a);
        
                                var newLayout = layoutRichText();
                                selectedMode(newLayout, isFocused, startIndex, endIndex);
                            }
        
                        });
                    } else if(input == "copyHtml") {
                        var a = Math.min(startIndex, endIndex);
                        var b = Math.max(startIndex, endIndex);
                        return toHTML(a, b - a);
                    } else if(input == "activeAttributeValues") {
                        var a = Math.min(startIndex, endIndex);
                        var b = Math.max(startIndex, endIndex);
                        return getAttributeValues(arg, a, b - a);
                    } else if(input == "refresh") {
                        selectedMode(layout, isFocused, startIndex, endIndex);
                    } else if(input == "focusUpdate") {
                        selectedMode(layout, arg, startIndex, endIndex);
                    }
                };
            }
        
            // seed the initial content and mark the first undo snapshot
            cursorMode(layoutRichText(), false, 0);
        
            undoable(function() {
                var initial = parent.val();
                if(initial != null)
                    inputHandler('pasteHtml', initial);
            });
        
            // return command-set
            return {
        
            };
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
        
        function initInput(outerContainer, container, undo, redo, inputHandler) {
            // mouse handlers
            var isFocused = false;
            var wasFocusedBeforeClick = null; // when restoring focus via mouse click, helps detect if it was a true focus change
        
            outerContainer.mousedown(function(e) {
                var containerOffset = container.offset();
                var x = e.pageX - containerOffset.left;
                var y = e.pageY - containerOffset.top;
        
                // if clicking on scrollable container, detect the scrollbar click
                var isUsable = true;
                if(e.target == outerContainer.get(0) && e.originalTarget != e.target)
                    isUsable = false;
        
                // regain input area focus (this click always causes input blur)
                // NOTE: we let this event complete normally first
                wasFocusedBeforeClick = isFocused;
                setTimeout(function() {
                    inputArea.focus();
                    wasFocusedBeforeClick = null;
        
                    if(isUsable)
                        inputHandler('mouseDown', { x: x, y: y });
                }, 0);
            });
        
            $(document).mousemove(function(e) {
                var containerOffset = container.offset();
                var x = e.pageX - containerOffset.left;
                var y = e.pageY - containerOffset.top;
        
                inputHandler('mouseMove', { x: x, y: y });
            }).mouseup(function(e) {
                var containerOffset = container.offset();
                var x = e.pageX - containerOffset.left;
                var y = e.pageY - containerOffset.top;
        
                inputHandler('mouseUp', { x: x, y: y });
            });
        
            // NOTE: appending to container to maintain focus progression
            var inputArea = $('<div></div>').appendTo(container).css(resetMetricsCss).css({
                position: 'absolute',
                top: 0, left: -2000, width: 1, height: 1
            }).attr('contentEditable', 'true').keypress(function(e) {
                var k = e.keyCode;
        
                if(e.metaKey)
                    return true;
        
                if(k == 13) {
                    // NOTE: layout engine explicitly expects ASCII LF instead of CR
                    inputHandler("insert", "\n");
                } else if(k == 8) {
                    // backspace
                    inputHandler("delete", true);
                } else if(e.which) {
                    inputHandler("insert", String.fromCharCode(e.which));
                } else {
                    // allow regular event
                    return true;
                }
        
                e.preventDefault();
                e.stopPropagation();
                return false;
            }).keydown(function(e) {
                var input = $(this);
                var k = e.keyCode;
                var sel = e.shiftKey ? 'Select' : '';
        
                if(k == 37) {
                    // left
                    inputHandler("character" + sel, -1);
                } else if(k == 39) {
                    // right
                    inputHandler("character" + sel, 1);
                } else if(k == 38) {
                    // up
                    inputHandler("line" + sel, -1);
                } else if(k == 40) {
                    // down
                    inputHandler("line" + sel, 1);
                } else if(k == 46) {
                    // delete
                    inputHandler("delete", false);
                } else if(k == 36) {
                    // home
                    inputHandler("inLine" + sel, -1);
                } else if(k == 35) {
                    // end
                    inputHandler("inLine" + sel, 1);
                } else if(e.metaKey) {
                    // misc Ctrl+? shortcuts
                    if(k == 66) {
                        // "b"
                        inputHandler("styleModifier", 'bold');
                    } else if(k == 73) {
                        // "i"
                        inputHandler("styleModifier", 'italic');
                    } else if(k == 86) {
                        // "v"
                        // TODO: add more hooks to do this, or just always check input area
                        input.text(''); // clean up before pasting
                        setTimeout(function() { var v = input.html(); inputHandler("pasteHtml", v); }, 0);
                        return true;
                    } else if(k == 67 || k == 88) {
                        // "c" or "x"
                        // TODO: add more hooks to do this, or just always seed input area
                        var txt = inputHandler("copyHtml");
                        if(txt != null) {
                            if(k == 88)
                                inputHandler("delete", false); // simple deletion
        
                            input.html(txt);
                            document.execCommand('selectAll', false, null); // TODO: check for focus
                            return true;
                        }
                    } else if(k == 90 && !e.shiftKey) {
                        // "z"
                        undo();
                    } else if(k == 89 || (k == 90 && e.shiftKey)) {
                        // "y" or "z" with shift (and control)
                        redo();
                    } else {
                        // allow regular event
                        return true;
                    }
                } else {
                    // allow regular event
                    return true;
                }
        
                e.preventDefault();
                e.stopPropagation();
                return false;
            }).focus(function() {
                isFocused = true;
                if(!wasFocusedBeforeClick)
                    inputHandler('focusUpdate', isFocused);
            }).blur(function() {
                isFocused = false;
        
                // if blurring during our own click, do not run handler
                if(!wasFocusedBeforeClick)
                    inputHandler('focusUpdate', isFocused);
            });
        }
        
        $(function() {
            $('#testInput').richText();
        });
    }
)
