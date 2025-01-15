# Event PubSub

npm info :  
![event-pubsub npm version](https://img.shields.io/npm/v/event-pubsub.svg) ![total npm downloads for event-pubsub](https://img.shields.io/npm/dt/event-pubsub.svg) ![monthly npm downloads for event-pubsub](https://img.shields.io/npm/dm/event-pubsub.svg)

GitHub info :  
![event-pubsub GitHub Release](https://img.shields.io/github/release/RIAEvangelist/event-pubsub.svg) ![GitHub license event-pubsub license](https://img.shields.io/github/license/RIAEvangelist/event-pubsub.svg) ![open issues for event-pubsub on GitHub](https://img.shields.io/github/issues/RIAEvangelist/event-pubsub.svg)

***Super light and fast*** Extensible PubSub events and EventEmitters for Node and the browser with support for ES6 by default, and ES5 versions for older verions of node and older IE/Safari versions.

For older versions of node and io.js the latest versions of `event-pubsub` may work with the --harmony flag. Officially though, we support node v4 and newer with es5 and es6

Easy for any developer level. No frills, just high speed events following the publisher subscriber pattern!

[Pretty GitHub.io site](http://riaevangelist.github.io/event-pubsub/)  

[See NPM stats for event-pubsub](http://npm-stat.com/charts.html?package=event-pubsub&author=&from=&to=)

**EXAMPLE FILES**  

1. [Node Event PubSub Examples](https://github.com/RIAEvangelist/event-pubsub/tree/master/examples/node)  
2. [Browser Event PubSub Examples](https://github.com/RIAEvangelist/event-pubsub/tree/master/examples/browser)

**Node Install**  
`npm i --save event-pubsub`  
By default the correct version (ES5/ES6) will be included. You can force the es5/6 version by requiring `event-pubsub/es5` or `event-pubsub/es6`.

**Browser Install**  
*see browser examples above or below*  

```html

<script src='path/to/event-pubsub-browser.js'></script>
<!-- OR ES5 for older browser support
    <script src='path/to/event-pubsub-browser-es5.js'></script>
-->

```

# Methods

|Method|Arguments|Description|
|------|---------|-----------|
|subscribe|type (string), handler(function), once (bool/optional)|will bind the `handler` function to the the `type` event. Just like `addEventListener` in the browser. If once is set to true the hander will be removed after being called once.|
|on|same as above|same as above|
|once|type (string), handler(function)| will bind the `handler` function to the the `type` event and unbind it after ***one*** execution. Just like `addEventListener` in the browser withe the `once` option set|
|unSubscribe|type (string), handler(function or *)|will ***un***bind the `handler` function from the the `type` event. If the `handler` is `*`, all handlers for the event type will be removed.   Just like `removeEventListener` in the browser, but also can remove all event handlers for the type.|
|off|same as above|same as above|
|publish|type (string), ...data arguments|will call all `handler` functions bound to the event `type` and pass all `...data arguments` to those handlers|
|emit|same as above|same as above|
|trigger|same as above|same as above|

While `publish`, `subscribe`, and `unSubscribe` are the proper method names for the publisher/subscriber model, we have included `on`, `off`, and `emit` as well because these are the most common event method names, and shorter. We have also kept the `trigger` method as an alias for `publish` and `emit` for backwards compatability with earlier versions of `event-pubsub`.

# The ` * ` type

The ` * ` type is a special event type that will be triggered by ***any publish or emit*** the handlers for these should expect the first argument to be the type and all arguments after to be data arguments.


## Basic Examples

***NOTE - the only difference between node and browser code is how the `events` variable is created***  
* node ` const events = new Events `
* browser `const events = new window.EventPubSub;`

#### Node

```javascript

// ES5/ES6 now automatically chosen based on node version
const Events = new require('event-pubsub');
const events=new Events;

events.on(
    'hello',
    function(data){
        console.log('hello event recieved ', data);
        events.emit(
            'world',
            {
                type:'myObject',
                data:{
                    x:'YAY, Objects!'
                }
            }
        )
    }
);

events.on(
    'world',
    function(data){
        console.log('World event got',data);
        events.off('*','*');
        console.log('Removed all events');
    }
);

events.emit(
    'hello',
    'world'
);



```

#### Basic Chaining

```javascript

events.on(
    'hello',
    someFunction
).on(
    'goodbye',
    anotherFunction
).emit(
    'hello',
    'world'
);

events.emit(
    'goodbye',
    'complexity'
).off(
    'hello',
    '*'
);

```

#### Browser
##### HTML

```html


    <!DOCTYPE html>
    <html>
        <head>
            <title>PubSub Example</title>
            <script src='../../event-pubsub-browser.js'></script>
            <!-- OR ES5 for older browser support
                <script src='../../event-pubsub-browser-es5.js'></script>
            -->
            <script src='yourAmazingCode.js'></script>
        </head>
        <body>
            ...
        </body>
    </html>


```


##### Inside Your Amazing Code


```javascript

var events = new window.EventPubSub();

events.on(
    'hello',
    function(data){
        console.log('hello event recieved ', data);
        events.emit(
            'world',
            {
                type:'myObject',
                data:{
                    x:'YAY, Objects!'
                }
            }
        )
    }
);

 events.emit(
     'hello',
     'world'
 );

 events.emit(
     'hello',
     'again','and again'
 );


```


### Basic Event Emitter and/or Extending Event PubSub

```javascript

// ES5/ES6 now automatically chosen based on node version
const Events = require('event-pubsub');
// manually include es6
// const Events = require('event-pubsub/es6');

class Book extends Events{
    constructor(){
        super();
        //now Book has .on, .off, and .emit

        this.words=[];
    }

    add(...words){
        this.words.push(...words);
        this.emit(
            'added',
            ...words
        );
    }

    read(){
        this.emit(
            'reading'
        );
        console.log(this.words.join(' '));
    }
}

const book=new Book;

book.on(
    'added',
    function(...words){
        console.log('words added : ',words);
        this.read();
    }
);

book.add(
    'once','upon','a','time','in','a','cubicle'
);


```

##### ES5 extention example

```javascript

// manually include es5
const Events = require('event-pubsub/es5.js');

function Book(){
    //extend happens below
    Object.assign(this,new Events);
    //now Book has .on, .off, and .emit

    this.words=[];
    this.add=add;
    this.erase=erase;
    this.read=read;

    function add(){
        arguments.slice=Array.prototype.slice;

        this.words=this.words.concat(
            arguments.slice()
        );
        this.emit(
            'added',
            arguments.slice()
        );
    }

    function read(){
        this.emit(
            'reading'
        );
        console.log(this.words.join(' '));
    }

    return this;
};

const book=new Book;

book.on(
    'added',
    function(...words){
        console.log('words added : ',words);
        this.read();
    }
);

book.add(
    'once','upon','a','time','in','a','cubicle'
);


```
