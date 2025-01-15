# js-queue Is Great for any queue

1. socket message queuing
2. async operations
3. synchronous operations
4. atomic operations
3. code with requirements before executing
4. queues you want to start running any time you add new items
5. any simple or complex queue operations
6. base class to extend
7. anything else that needs a queue
8. Anything which needs a stack instead of a queue.


# Stable and easy to use
Works great in node.js, webpack, browserify, or any other commonjs loader or compiler. To use in plain old vanilla browser javascript without common js just replace the requires in the examples with script tags. We show that below too.

` js-queue ` also exposes the ` easy-stack ` stack via ` require('js-queue/stack.js') ` this file exposes an ES6 stack which allows for Last In First Out (LIFO) queuing. This can come in handy depending on your application needs, check out the [easy-stack javascript documentation](https://github.com/RIAEvangelist/easy-stack) it follows the ` js-queue ` interface but is node 6 or greater as it uses ES6 classes.  

**npm install js-queue**

npm info :  [See npm trends and stats for js-queue](http://npm-stat.com/charts.html?package=@node-ipc/js-queue&author=&from=&to=)  
![js-queue npm version](https://img.shields.io/npm/v/js-queue.svg) ![supported node version for js-queue](https://img.shields.io/node/v/js-queue.svg) ![total npm downloads for js-queue](https://img.shields.io/npm/dt/js-queue.svg) ![monthly npm downloads for @node-ipc/js-queue](https://img.shields.io/npm/dm/@node-ipc/js-queue.svg) ![npm licence for @node-ipc/js-queue](https://img.shields.io/npm/l/@node-ipc/js-queue.svg)

GitHub info :  
![js-queue GitHub Release](https://img.shields.io/github/release/node-ipc/js-queue.svg) ![GitHub license js-queue license](https://img.shields.io/github/license/node-ipc/js-queue.svg) ![open issues for js-queue on GitHub](https://img.shields.io/github/issues/node-ipc/js-queue.svg)

Package details websites :
* [GitHub.io site](http://node-ipc.github.io/js-queue/ "js-queue documentation"). A prettier version of this site.
* [NPM Module](https://www.npmjs.org/package/@node-ipc/js-queue "js-queue npm module"). The npm page for the js-queue module.

This work is licenced via the MIT Licence.

## Exposed methods and values

|key|type|paramaters|default|description|
|----|----|----|----|----|
|add|function|any number of functions|  |adds all parameter functions to queue and starts execution if autoRun is true, queue is not already running and queue is not forcibly stopped |
|next|function|  |  |executes next item in queue if queue is not forcibly stopped|
|clear|function|  |  |removes remaining items in the queue|
|contents|Array|  |  | Queue instance contents |
|autoRun|Bool|  | true |should autoRun queue when new item added|
|stop|Bool|  | false |setting this to true will forcibly prevent the queue from executing|

### Basic queue use in node, react, browserify, webpack or any other commonjs implementation

```javascript

    var Queue=require('js-queue');
    //create a new queue instance
    var queue=new Queue;

    for(var i=0; i<50; i++){
        //add a bunch of stuff to the queue
        queue.add(makeRequest);
    }

    function makeRequest(){
        //do stuff
        console.log('making some request');

        this.next();
    }

```

### Basic browser use

The only difference is including via a script tag instead of using require.

```html

    <html>
            <head>
                    <!-- this is the only difference -->
                    <script src='./queue-vanilla.js'></script>
                    <script>
                            console.log('my awesome app script');
                            var queue=new Queue;

                            for(var i=0; i<50; i++){
                                queue.add(makeRequest);
                            }

                            function makeRequest(){
                                console.log('making some request');

                                this.next();
                            }
                    </script>
            </head>
            <body>
            </body>
    </html>

```

### Basic use with websockets in node, react, browserify, webpack or any other commonjs implementation

This allows you to start adding requests immediately and only execute if the websocket is connected. To use in plain browser based JS without webpack or browserify just replace the requires with the script tag.

```javascript

    var Queue=require('js-queue');

    //ws-share just makes it easier to share websocket code and ensure you don't open a websocket more than once
    var WS=require('ws-share');

    //js-message makes it easy to create and parse normalized JSON messages.
    var Message=require('js-message');

    //create a new queue instance
    var queue=new Queue;

    //force stop until websocket opened
    queue.stop=true;

    var ws=null;

    function startWS(){
        //websocket.org rocks
        ws=new WS('wss://echo.websocket.org/?encoding=text');

        ws.on(
            'open',
            function(){
                ws.on(
                    'message',
                    handleResponse
                );

                //now that websocket is opened allow auto execution
                queue.stop=false;
                queue.next();
            }
        );

        ws.on(
            'error',
            function(err){
                //stop execution of queue if there is an error because the websocket is likely closed
                queue.stop=true;
                //remove remaining items in the queue
                queue.clear();
                throw(err);
            }
        );

        ws.on(
            'close',
            function(){
                //stop execution of queue when the websocket closed
                queue.stop=true;
            }
        );
    }

    //simulate a lot of requests being queued up for the websocket
    for(var i=0; i<50; i++){
        queue.add(makeRequest);
    }

    var messageID=0;

    function handleResponse(e){
        var message=new Message;
        message.load(e.data);

        console.log(message.type,message.data);
    }

    function makeRequest(){
        messageID++;
        var message=new Message;
        message.type='testMessage';
        message.data=messageID;

        ws.send(message.JSON);

        this.next();
    }

    startWS();

```


# Extending Queue

```javascript

    var Queue=require('js-queue');

    //MyAwesomeQueue inherits from Queue
    MyAwesomeQueue.prototype = new Queue;
    //Constructor will extend Queue
    MyAwesomeQueue.prototype.constructor = MyAwesomeQueue;

    function MyAwesomeQueue(){
        //extend with some stuff your app needs,
        //maybe npm publish your extention with js-queue as a dependancy?
        Object.defineProperties(
            this,
            {
                isStopped:{
                    enumerable:true,
                    get:checkStopped,
                    set:checkStopped
                },
                removeThirdItem:{
                    enumerable:true,
                    writable:false,
                    value:removeThird
                }
            }
        );

        //enforce Object.assign for extending by locking down Class structure
        //no willy nilly cowboy coding
        Object.seal(this);

        function checkStopped(){
            return this.stop;
        }

        function removeThird(){
            //get the queue content
            var list=this.contents;
            //modify the queue content
            list.splice(2,1);
            //save the modified queue content
            this.contents=list;

            return this.contents;
        }
    }

```
