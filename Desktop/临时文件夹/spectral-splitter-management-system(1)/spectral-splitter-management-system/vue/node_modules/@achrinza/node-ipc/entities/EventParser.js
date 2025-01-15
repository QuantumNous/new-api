'use strict';

const Defaults = require('./Defaults.js');

class Parser{
  constructor(config){
    if(!config){
      config=new Defaults;
    }
    this.delimiter=config.delimiter;
  }

  format(message){
    if(!message.data && message.data!==false && message.data!==0){
        message.data={};
    }
    if(message.data['_maxListeners']){
        message.data={};
    }

    message=message.JSON+this.delimiter;
    return message;
  }

  parse(data){
    let events=data.split(this.delimiter);
    events.pop();
    return events;
  }
}

module.exports=Parser;
