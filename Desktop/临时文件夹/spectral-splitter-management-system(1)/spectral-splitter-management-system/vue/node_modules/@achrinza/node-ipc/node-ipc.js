'use strict';

const IPC = require('./services/IPC.js');

class IPCModule extends IPC{
    constructor(){
        super();
        //include IPC to make extensible
        Object.defineProperty(
            this,
            'IPC',
            {
                enumerable:true,
                writable:false,
                value:IPC
            }
        )
    }
}

module.exports=new IPCModule;
