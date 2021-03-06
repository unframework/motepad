var $ = require('jquery');

var init = require('./src/main');

var richTextDataId = 'richText_ba4c44091e9a88f061d31dab36cb7e20';

$.fn.richText = function(command, arg) {
    var parent = this.eq(0);
    if(parent.length < 1)
        return this;

    var commands = parent.data(richTextDataId);

    if(commands === undefined) {
        if (command === 'create') {
            commands = init(arg, parent);
            parent.data(richTextDataId, commands);
        }
    } else {
        commands[command](arg);
    }

    return this;
};

/*
createAttributeSequence().insert('test', 0, 11).insert('test', 1, 9).insert('test2', 5, 10).set('test', 5, 10).eachRun(0, 30, function(v, s, len) {
    console.log('- ' + v + ' ' + s + ',' + len);
});
*/

