# js-message
Normalized JS & JSON Message and event Protocol for node.js, vanilla.js (plain old javascript), react.js, websockets, rest api's, node-ipc, and any other protocol that might use a js object and or a JSON string.  

js-message allows for seamless conversion of JSON messages and events to JS objects for a normalized implementation on the server and in the client without needing to concern yourself with JSON intermediaries and custom parsers.  

Things are just easier when you normalize them.  

npm js-message info :  [See npm trends and stats for js-message](http://npm-stat.com/charts.html?package=js-message&author=&from=&to=)  
![js-message npm version](https://img.shields.io/npm/v/js-message.svg) ![supported node version for js-message](https://img.shields.io/node/v/js-message.svg) ![total npm downloads for js-message](https://img.shields.io/npm/dt/js-message.svg) ![monthly npm downloads for js-message](https://img.shields.io/npm/dm/js-message.svg) ![npm licence for js-message](https://img.shields.io/npm/l/js-message.svg)

` npm install --save js-message `  

[![RIAEvangelist](https://avatars3.githubusercontent.com/u/369041?v=3&s=100)](https://github.com/RIAEvangelist)

GitHub info :  
[![js-message GitHub Release](https://img.shields.io/github/release/RIAEvangelist/js-message.svg) ![GitHub license js-message license](https://img.shields.io/github/license/RIAEvangelist/js-message.svg) ![open issues for js-message on GitHub](https://img.shields.io/github/issues/RIAEvangelist/js-message.svg)](http://riaevangelist.github.io/js-message/)

[js-message site](http://riaevangelist.github.io/js-message/)


|method or key  |type   |mutable|description|
|---------------|-------|-------|-----------|
|type           |String |true   |the type of message|
|data           |Object |true   |the message data or payload|
|load           |func   |false  |load a message from JSON, this will return a message with the type of error if not valid JSON|
|JSON           |String |not by user|JSON representation of the message|

### Creating a Message Object

```javascript

    //commonjs
    var Message=require('js-message');
    //plain old javascript
    <script src='js-message-vanilla.js' />

    var myMessage=new Message;
    myMessage.type='message or event type';
    myMessage.data.something='something';
    myMessage.data.stuff=[1,2,3,4,5]

    console.log(myMessage.JSON);

```

### Creating a Message From JSON

```javascript

    //commonjs
    var Message=require('js-message');
    //plain old javascript
    <script src='js-message-vanilla.js' />

    //lets say we have the above example running on
    //a websocket server sending js-messages as JSON
    //
    //and lets say this is the client in the browser
    ws.on(
        'message',
        handleMessage
    );

    handleMessage(e){
        var message=new Message;
        message.load(e.data);

        console.log(message.type, message.data);
    }

```

### Sending a Message Object via WebSocket

```javascript

    //commonjs
    var Message=require('js-message');
    //plain old javascript
    <script src='js-message-vanilla.js' />

    //client example, but works the same on server too!
    var ws=new WebSocket('ws://myawesomeWS:8000');

    var myMessage=new Message;
    myMessage.type='setUsername';
    myMessage.data.username='sideshow bob';

    ws.send(myMessage.JSON);

```


---

This work is licenced via the [DBAD Public Licence](http://www.dbad-license.org/).
