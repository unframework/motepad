var $ = require('jquery');

require('.');

var style = '.editArea {'
+ '    background: #effaff;'
+ '    padding: 5px;'
+ '    border: 1px solid #888;'
+ '    color: #444;'
+ ''
+ '    font-family: Georgia, serif;'
+ '    font-size: 16px;'
+ ''
+ '    height: 300px;'
+ ''
+ '    box-shadow: 0px 0px 20px -5px #888;'
+ '}'
+ 'body { font-size: 16px; }';

$('body').append('<div style="width:600px;margin:30px auto;"><textarea id="testInput">&lt;a href="about:blank">This is a &lt;b>lovely&lt;/b>&lt;/a> test</textarea></div>')

document.getElementsByTagName('head')[0].appendChild((function (html) {
    var span = document.createElement('span');
    span.innerHTML = html;
    return span.firstChild;
})('<style>' + style + '</style>'));

$(function() {
    $('#testInput').richText();
});
