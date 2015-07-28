var $ = require('jquery');

require('.');
var TextFormat = require('./src/TextFormat');

var style = '.editArea {'
+ '    background: #effaff;'
+ '    padding: 5px;'
+ '    border: 1px solid #888;'
+ '    color: #444;'
+ ''
+ '    font-family: Georgia, serif;'
+ '    font-size: 32px;'
+ ''
+ '    height: 300px;'
+ ''
+ '    box-shadow: 0px 0px 20px -5px #888;'
+ '}'
+ 'body { font-size: 16px; }';

$('body').append('<div style="width:600px;margin:30px auto;"><textarea id="testInput">&lt;a href="about:blank">This is a &lt;b>lovely&lt;/b>&lt;/a> test</textarea></div>')
var htmlButton = $('<button>See HTML</button>').appendTo($('<div style="text-align:center"></div>').appendTo(document.body));

document.getElementsByTagName('head')[0].appendChild((function (html) {
    var span = document.createElement('span');
    span.innerHTML = html;
    return span.firstChild;
})('<style>' + style + '</style>'));

var format = new TextFormat();

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

format.defineStyle('bold', {
    defaultValue: false,
    getHashCode: function(v) { return v ? '1' : ''; },
    applyVisual: function(v, css) { css['font-weight'] = v ? 'bold' : 'normal'; },
    parseHtmlTag: function(tag, styleAttrs) {
        if(tag === 'b' || tag === 'strong' || styleAttrs['font-weight'] === 'bold')
            return true;
    },
    openHtmlTag: function(v) { return (v ? '<b>' : ''); },
    closeHtmlTag: function(v) { return (v ? '</b>' : ''); }
});

format.defineStyle('italic', {
    defaultValue: false,
    getHashCode: function(v) { return v ? '1' : ''; },
    applyVisual: function(v, css) { css['font-style'] = v ? 'italic' : 'normal'; },
    parseHtmlTag: function(tag, styleAttrs) {
        if(tag === 'i' || tag === 'em' || styleAttrs['font-style'] === 'italic')
            return true;
    },
    openHtmlTag: function(v) { return (v ? '<i>' : ''); },
    closeHtmlTag: function(v) { return (v ? '</i>' : ''); }
});

$(function() {
    var control = $('#testInput').richText('create', format);

    htmlButton.click(function () {
        control.richText('exportHTML', function (html) {
            alert(html);
        });
    });
});
