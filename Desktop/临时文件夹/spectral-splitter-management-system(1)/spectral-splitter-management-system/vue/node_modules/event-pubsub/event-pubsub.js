'use strict';

let EventPubSub = require('./es5');
if(process.version[1]>5){
    EventPubSub = require('./es6');
}

module.exports=EventPubSub;
