/**
 * Copyright 2011, 2013 Nick Matantsev
 * Dual-licensed under the MIT or GPL Version 2 licenses.
 */

var $ = require('jquery');
var HTMLParser = require('./htmlparser').HTMLParser;
var resetMetricsCss = require('./src/resetCss');
var createAttributeSequence = require('./src/AttributeSequence');
var createStyle = require('./src/Style');
var StyleRegistry = require('./src/StyleRegistry');
var initRenderer = require('./src/Renderer');
var initInput = require('./src/Input');
var layoutRichText = require('./src/layoutRichText');

var richTextDataId = 'richText_ba4c44091e9a88f061d31dab36cb7e20';

$.fn.richText = function(command, arg) {
    var parent = this.eq(0);
    if(parent.length < 1)
        return this;

    var commands = parent.data(richTextDataId);

    if(commands === null) {
        commands = init(parent);
        parent.data(richTextDataId, commands);
    }
};

/*
createAttributeSequence().insert('test', 0, 11).insert('test', 1, 9).insert('test2', 5, 10).set('test', 5, 10).eachRun(0, 30, function(v, s, len) {
    console.log('- ' + v + ' ' + s + ',' + len);
});
*/

var attributeInfo = {
    /*
    link: {
        defaultValue: null,
        getHashCode: function(v) { return v !== null ? '1' : '' },
        applyVisual: function(v, css) {
            if(v !== null) {
                css['color'] = '#00f';
                css['border-bottom'] = '1px solid #00f';
            }
        },
        parseHtmlTag: function(tag, styleAttrs, attrs) {
            if(tag === 'a') {
                return attrs['href'];
            }
        },
        openHtmlTag: function(v) { return (v ? '<a>' : '') },
        closeHtmlTag: function(v) { return (v ? '</a>' : '') }
    },
    */
    bold: {
        defaultValue: false,
        getHashCode: function(v) { return v ? '1' : ''; },
        applyVisual: function(v, css) { css['font-weight'] = v ? 'bold' : 'normal'; },
        parseHtmlTag: function(tag, styleAttrs) {
            if(tag === 'b' || tag === 'strong' || styleAttrs['font-weight'] === 'bold')
                return true;
        },
        openHtmlTag: function(v) { return (v ? '<b>' : ''); },
        closeHtmlTag: function(v) { return (v ? '</b>' : ''); }
    },
    italic: {
        defaultValue: false,
        getHashCode: function(v) { return v ? '1' : ''; },
        applyVisual: function(v, css) { css['font-style'] = v ? 'italic' : 'normal'; },
        parseHtmlTag: function(tag, styleAttrs) {
            if(tag === 'i' || tag === 'em' || styleAttrs['font-style'] === 'italic')
                return true;
        },
        openHtmlTag: function(v) { return (v ? '<i>' : ''); },
        closeHtmlTag: function(v) { return (v ? '</i>' : ''); }
    }
};

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

    var styles = new StyleRegistry(extentsStageContainer, attributeInfo);

    function getAttributeValues(name, index, length) {
        var values = [];
        attributes[name].eachRun(index, length, function(v) { values.push(v); });
        return values;
    }

    var inputHandler = null;

    var render = initRenderer(outerContainer, container);

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

    function insertHTML(start, html) {
        var n;

        var newText = '';
        var newAttributes = {
        };

        function startRun(name, value) {
            newAttributes[name].push({ value: value, length: 0 });
        }

        for(n in attributeInfo) {
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
                    if(tag === 'br')
                        addChars("\n");
                    return;
                }

                var attrs = {};
                attrList.forEach(function (a) { attrs[a.name] = a.value; });

                var style = attrs.style;
                var styleAttrs = {};
                (style === null ? '' : style).split(';').forEach(function (s) {
                    var p = s.split(':');
                    if(p.length === 2)
                        styleAttrs[$.trim(p[0])] = $.trim(p[1]);
                });

                // create a stack level for this tag
                var level = [];
                stack.push(level);

                // start new runs
                for(var n in attributeInfo) {
                    var v = attributeInfo[n].parseHtmlTag(tag, styleAttrs, attrs);
                    if(v !== null) {
                        startRun(n, v);
                        level.push(n);
                    }
                }
            },
            end: function(tag) {
                // close this stack level's runs
                stack.pop().forEach(function (attr) { startRun(attr, attributeInfo[attr].defaultValue); });

                // when block elements close, add double-newline
                // TODO: support other block elements?
                if(tag === 'p' || tag === 'div') {
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
        for(n in attributes)
            attributes[n] = attributes[n].insertAll(newAttributes[n], start);
    }

    function toHTML(start, length) {
        var n;
        var slices = [ { start: start, values: {} } ];

        for(n in attributes) {
            /*jslint loopfunc: true */
            var sliceIndex = 0;
            var slice = slices[sliceIndex];

            attributes[n].eachRun(start, length, function(v, vs, vlen) {
                // if range starts before current slice, subdivide previous slice
                if(slice === null || slices[sliceIndex].start > vs) {
                    slice = { start: vs, values: $.extend({}, slices[sliceIndex - 1].values) };
                    slices.splice(sliceIndex, 0, slice);
                }

                // fill this and the rest of the slices within range
                var vend = vs + vlen;
                while(slice !== null && slice.start < vend) {
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
        for(n in attributeInfo)
            tagOrder.push(n);

        var lastValues = {};
        var lastStart = null;

        slices.forEach(function (slice, index) {
            var n, i, tn;

            if(index === 0) {
                // start all the tags
                for(n in attributeInfo) {
                    var nv = slice.values[n];
                    lastValues[n] = nv;
                    startTag(n, nv);
                }
            } else {
                // determine how deeply to unwind the current tags
                var sameLevel = -1;
                for(n in attributeInfo) {
                    if(slice.values[n] !== lastValues[n])
                        break;

                    lastValues[n] = slice.values[n];
                    sameLevel++;
                }

                // append previous slice's text
                appendText(text.substring(lastStart, slice.start));

                // end last attribute values
                for(i = tagOrder.length - 1; i > sameLevel; i--) {
                    tn = tagOrder[i];
                    endTag(tn, lastValues[tn]);
                }

                // start new attribute values
                for(i = sameLevel + 1; i < tagOrder.length; i++) {
                    tn = tagOrder[i];
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
            var n;
            var values = {};

            if(text.length > 0) {
                /*jslint loopfunc: true */
                var activeIndex = cursorIndex > 0 ? cursorIndex - 1 : cursorIndex;
                for(n in attributes)
                    attributes[n].eachRun(activeIndex, 1, function(v) { values[n] = v; });
            } else {
                for(n in attributeInfo)
                    values[n] = attributeInfo[n].defaultValue;
            }

            return values;
        }

        inputHandler = function(input, arg) {
            var ni, edge;

            if(input === "character") {
                var delta = (arg > 0 ? 1 : -1);
                ni = Math.max(0, Math.min(text.length, cursorIndex + delta));

                cursorMode(layout, isFocused, ni);
            } else if(input === "line") {
                var offset = intendedOffset;
                if(offset === null)
                    layout.withTextIndex(cursorIndex, function(left) { offset = left; });

                edge = 0;
                layout.withTextLine(cursorIndex, function(top, height) { edge = arg < 0 ? top - 1 : top + height + 1; });
                ni = layout.findTextIndex(offset, edge);

                cursorMode(layout, isFocused, ni, offset);
            } else if(input === "inLine") {
                var newOffset = arg < 0 ? -1 : Number.POSITIVE_INFINITY;
                edge = 0;
                layout.withTextLine(cursorIndex, function(top, height) { edge = top; });
                ni = layout.findTextIndex(newOffset, edge);

                cursorMode(layout, isFocused, ni, newOffset);
            } else if(input === "characterSelect" || input === "lineSelect" || input === "inLineSelect") {
                // switch to selected mode with zero-length selection and repeat the command
                selectedMode(layout, isFocused, cursorIndex, cursorIndex);
                inputHandler(input, arg);
            } else if(input === "mouseDown") {
                ni = layout.findTextIndex(arg.x, arg.y);
                draggingMode(layout, ni, ni);
            } else if(input === "delete") {
                var delIndex = arg ? cursorIndex - 1 : cursorIndex;
                if(delIndex >= 0 && delIndex < text.length) {
                    undoable(function() {

                        text = text.substring(0, delIndex) + text.substring(delIndex + 1);
                        for(var n in attributes)
                            attributes[n] = attributes[n].remove(delIndex, 1);

                        var newLayout = layoutRichText(container.width(), text, attributes, attributeInfo, styles);
                        cursorMode(newLayout, isFocused, delIndex);

                    });
                }
            } else if(input === "insert") {
                undoable(function() {

                    var values = entryAttributes === null ? currentAttributes() : entryAttributes;

                    text = text.substring(0, cursorIndex) + arg + text.substring(cursorIndex);
                    for(var n in attributes)
                        attributes[n] = attributes[n].insert(values[n], cursorIndex, arg.length);

                    var newLayout = layoutRichText(container.width(), text, attributes, attributeInfo, styles);
                    cursorMode(newLayout, isFocused, cursorIndex + arg.length, null, values);

                });
            } else if(input === "pasteHtml") {
                undoable(function() {
                    var distanceFromEnd = text.length - cursorIndex;
                    insertHTML(cursorIndex, arg);

                    var newLayout = layoutRichText(container.width(), text, attributes, attributeInfo, styles);
                    cursorMode(newLayout, isFocused, text.length - distanceFromEnd);
                });
            } else if(input === "styleModifier") {
                var nm = entryAttributes === null ? currentAttributes() : $.extend({}, entryAttributes);
                if(arg === 'bold' || arg === 'italic')
                    nm[arg] = !nm[arg];
                cursorMode(layout, isFocused, cursorIndex, null, nm);
            } else if(input === "activeAttributeValues") {
                if(text.length > 0) {
                    return getAttributeValues(arg, cursorIndex > 0 ? cursorIndex - 1 : cursorIndex, 1);
                } else {
                    return [ attributeInfo[arg].defaultValue ];
                }
            } else if(input === "refresh") {
                cursorMode(layout, isFocused, cursorIndex);
            } else if(input === "focusUpdate") {
                cursorMode(layout, arg, cursorIndex);
            }
        };
    }

    function draggingMode(layout, startIndex, endIndex) {
        render(layout, true, endIndex, startIndex, endIndex);

        inputHandler = function(input, arg) {
            var ni;

            if(input === "mouseMove") {
                ni = layout.findTextIndex(arg.x, arg.y);
                draggingMode(layout, startIndex, ni);
            } else if(input === "mouseUp") {
                ni = layout.findTextIndex(arg.x, arg.y);
                if(ni === startIndex)
                    cursorMode(layout, true, ni);
                else
                    selectedMode(layout, true, startIndex, ni);
            } else if(input === "focusUpdate") {
                cursorMode(layout, arg, startIndex);
            } else if(input === "activeAttributeValues") {
                cursorMode(layout, true, startIndex);
                return inputHandler("activeAttributeValues", arg); // TODO: this better
            } else if(input === "refresh") {
                throw "should not end up in dragging mode after undo/redo";
            }
        };
    }

    function selectedMode(layout, isFocused, startIndex, endIndex, intendedOffset) {
        render(layout, isFocused, endIndex, startIndex, endIndex);

        // TODO: keep checking that the selection is non-empty
        inputHandler = function(input, arg) {
            var ni, edge;

            if(input === "mouseDown") {
                ni = layout.findTextIndex(arg.x, arg.y);
                draggingMode(layout, ni, ni);
            } else if(input === "characterSelect") {
                var delta = (arg > 0 ? 1 : -1);
                ni = Math.max(0, Math.min(text.length, endIndex + delta));

                selectedMode(layout, isFocused, startIndex, ni);
            } else if(input === "lineSelect") {
                var offset = intendedOffset;
                if(offset === null)
                    layout.withTextIndex(endIndex, function(left) { offset = left; });

                edge = 0;
                layout.withTextLine(endIndex, function(top, height) { edge = arg < 0 ? top - 1 : top + height + 1; });
                ni = layout.findTextIndex(offset, edge);

                selectedMode(layout, isFocused, startIndex, ni, offset);
            } else if(input === "inLineSelect") {
                var newOffset = arg < 0 ? -1 : Number.POSITIVE_INFINITY;
                edge = 0;
                layout.withTextLine(endIndex, function(top, height) { edge = top; });
                ni = layout.findTextIndex(newOffset, edge);

                selectedMode(layout, isFocused, startIndex, ni, newOffset);
            } else if(input === "character" || input === "line" || input === "inLine") {
                // switch to cursor mode and repeat the command
                cursorMode(layout, isFocused, endIndex);
                inputHandler(input, arg);
            } else if(input === "insert" || input === "delete" || input === "pasteHtml") {
                undoable(function() {

                    var a = Math.min(startIndex, endIndex);
                    var b = Math.max(startIndex, endIndex);

                    // delete the selection, switch to cursor mode and (if inserting) repeat the command
                    text = text.substring(0, a) + text.substring(b);
                    for(var n in attributes)
                        attributes[n] = attributes[n].remove(a, b - a);

                    var newLayout = layoutRichText(container.width(), text, attributes, attributeInfo, styles);
                    cursorMode(newLayout, isFocused, a);

                }); // NOTE: doing a two-step undo here

                if(input !== "delete")
                    inputHandler(input, arg);
            } else if(input === "styleModifier") {
                undoable(function() {

                    var a = Math.min(startIndex, endIndex);
                    var b = Math.max(startIndex, endIndex);

                    if(arg === 'bold' || arg === 'italic') {
                        // if at least one character is missing this style flag, don't remove it
                        var newValue = false;

                        var av = getAttributeValues(arg, a, b - a);
                        av.forEach(function (v) { if(!v) { newValue = true; return false; } });

                        attributes[arg] = attributes[arg].set(newValue, a, b - a);

                        var newLayout = layoutRichText(container.width(), text, attributes, attributeInfo, styles);
                        selectedMode(newLayout, isFocused, startIndex, endIndex);
                    }

                });
            } else if(input === "copyHtml") {
                var a = Math.min(startIndex, endIndex);
                var b = Math.max(startIndex, endIndex);
                return toHTML(a, b - a);
            } else if(input === "activeAttributeValues") {
                var a2 = Math.min(startIndex, endIndex);
                var b2 = Math.max(startIndex, endIndex);
                return getAttributeValues(arg, a2, b2 - a2);
            } else if(input === "refresh") {
                selectedMode(layout, isFocused, startIndex, endIndex);
            } else if(input === "focusUpdate") {
                selectedMode(layout, arg, startIndex, endIndex);
            }
        };
    }

    // seed the initial content and mark the first undo snapshot
    cursorMode(layoutRichText(container.width(), text, attributes, attributeInfo, styles), false, 0);

    undoable(function() {
        var initial = parent.val();
        if(initial !== null)
            inputHandler('pasteHtml', initial);
    });

    // return command-set
    return {

    };
}
