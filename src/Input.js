var $ = require('jquery');
var resetMetricsCss = require('./resetCss');

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

        if(e.ctrlKey)
            return true;

        if(k == 13) {
            // NOTE: layout engine explicitly expects ASCII LF instead of CR
            inputHandler("insert", "\n");
        } else if(k == 8) {
            // backspace
            // NOTE: backspace is actioned elsewhere; this is necessary to prevent character insert
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
        } else if(k == 8) {
            // backspace
            inputHandler("delete", true);
        } else if(k == 36) {
            // home
            inputHandler("inLine" + sel, -1);
        } else if(k == 35) {
            // end
            inputHandler("inLine" + sel, 1);
        } else if(e.ctrlKey) {
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

module.exports = initInput;
