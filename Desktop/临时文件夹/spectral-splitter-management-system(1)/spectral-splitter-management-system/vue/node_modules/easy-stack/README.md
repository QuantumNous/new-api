# easy-stack Is Great for any javascript stack (LIFO)

JS Stacks are different from queues because they are LIFO (last in first out) unlike a queue which is FIFO (first in first out). While a Queue executes in order, a stack executes whatever was most recently added to the stack, much like a reading a stack of papers on your desk. If you read half the papers and someone puts more on the top you start with the new ones first.

1. socket messages
2. priority async operations
3. priority synchronous operations
4. stacks you want to start running automatically when you add new items
5. any simple or complex stack operations
6. base class to extend
7. anything else that needs a stack


# Stable and easy to use
Works great in node.js, webpack, browserify, or any other commonjs loader or compiler. To use in plain old vanilla browser javascript without common js just replace the requires in the examples with script tags. We show that below too. Any time you need a JS stack easy-stack is there for you.

` require('easy-stack'); ` for ES6 node.  
` require('easy-stack/es5.js'); ` for ES5 node and browser.

**npm install easy-stack**

npm info :  [See npm trends and stats for easy-stack](http://npm-stat.com/charts.html?package=easy-stack&author=&from=&to=)  
![easy-stack npm version](https://img.shields.io/npm/v/easy-stack.svg) ![supported node version for easy-stack](https://img.shields.io/node/v/easy-stack.svg) ![total npm downloads for easy-stack](https://img.shields.io/npm/dt/easy-stack.svg) ![monthly npm downloads for easy-stack](https://img.shields.io/npm/dm/easy-stack.svg) ![npm licence for easy-stack](https://img.shields.io/npm/l/easy-stack.svg)

[![RIAEvangelist](https://avatars3.githubusercontent.com/u/369041?v=3&s=100)](https://github.com/RIAEvangelist)

GitHub info :  
![easy-stack GitHub Release](https://img.shields.io/github/release/RIAEvangelist/easy-stack.svg) ![GitHub license easy-stack license](https://img.shields.io/github/license/RIAEvangelist/easy-stack.svg) ![open issues for easy-stack on GitHub](https://img.shields.io/github/issues/RIAEvangelist/easy-stack.svg)

Package details websites :
* [GitHub.io site](http://riaevangelist.github.io/easy-stack/ "easy-stack documentation"). A prettier version of this site.
* [NPM Module](https://www.npmjs.org/package/easy-stack "easy-stack npm module"). The npm page for the easy-stack module.

This work is licenced via the [DBAD Public Licence](http://www.dbad-license.org/).

## Exposed methods and values

|key|type|parameters|default|description|
|----|----|----|----|----|
|add|function|any number of functions|  |adds all parameter functions to stack and starts execution if autoRun is true, stack is not already running and stack is not forcibly stopped |
|next|function|  |  |executes next item in stack if stack is not forcibly stopped|
|clear|function|  |  |removes remaining items in the stack|
|contents|Array|  |  | stack instance contents |
|autoRun|Bool|  | true |should autoRun stack when new item added|
|stop|Bool|  | false |setting this to true will forcibly prevent the stack from executing|

### Basic stack use in node, react, browserify, webpack or any other commonjs implementation

```javascript

    var Stack=require('easy-stack');
    //create a new Stack instance
    var stack=new Stack;

    for(var i=0; i<50; i++){
        //add a bunch of stuff to the stack
        stack.add(makeRequest);
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
                    <script src='./es5.js'></script>
                    <script>
                            console.log('my awesome app script');
                            var stack=new Stack;

                            for(var i=0; i<50; i++){
                                stack.add(makeRequest);
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

    var Stack=require('easy-stack');

    //ws-share just makes it easier to share websocket code and ensure you don't open a websocket more than once
    var WS=require('ws-share');

    //js-message makes it easy to create and parse normalized JSON messages.
    var Message=require('js-message');

    //create a new Stack instance
    var stack=new Stack;

    //force stop until websocket opened
    stack.stop=true;

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
                stack.stop=false;
                stack.next();
            }
        );

        ws.on(
            'error',
            function(err){
                //stop execution of stack if there is an error because the websocket is likely closed
                stack.stop=true;
                //remove remaining items in the stack
                stack.clear();
                throw(err);
            }
        );

        ws.on(
            'close',
            function(){
                //stop execution of stack when the websocket closed
                stack.stop=true;
            }
        );
    }

    //simulate a lot of requests being stackd up for the websocket
    for(var i=0; i<50; i++){
        stack.add(makeRequest);
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

# Extending ES6 stack.js

```javascript

    const Stack=require('easy-stack');

    class MyAwesomestack extends Stack{

        isStopped(){
            return this.stop;
        }

        removeThirdItem(){
            this.contents.splice(2,1);
            return this.contents;
        }
    };


```


# Extending stack node es5 or browser

```javascript

    var Stack=require('easy-stack');

    //MyAwesomestack inherits from stack
    MyAwesomestack.prototype = new Stack;
    //Constructor will extend stack
    MyAwesomestack.prototype.constructor = MyAwesomestack;

    function MyAwesomestack(){
        //extend with some stuff your app needs,
        //maybe npm publish your extention with easy-stack as a dependancy?
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
            //get the stack content
            var list=this.contents;
            //modify the stack content
            list.splice(2,1);
            //save the modified stack content
            this.contents=list;

            return this.contents;
        }
    }

```
