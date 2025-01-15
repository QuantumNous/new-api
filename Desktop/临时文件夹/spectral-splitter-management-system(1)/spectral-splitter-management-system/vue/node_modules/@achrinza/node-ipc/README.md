# @achrinza/node-ipc

> **NOTE:** This is a maintenance fork of `node-ipc` This is intended for
> packages that directly or indirectly depend on `node-ipc` where maintainers
> need a drop-in replacement.
>
> See https://github.com/achrinza/node-ipc/issues/1 for more details.

[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](code_of_conduct.md)
[![Coverage Status](https://coveralls.io/repos/github/achrinza/node-ipc/badge.svg?branch=main)](https://coveralls.io/github/achrinza/node-ipc?branch=main)

_a nodejs module for local and remote Inter Process Communication_ with full support for Linux, Mac and Windows. It also supports all forms of socket communication from low level unix and windows sockets to UDP and secure TLS and TCP sockets.

A great solution for complex multiprocess **Neural Networking** in Node.JS

**npm install @achrinza/node-ipc**

#### Older versions of node

the latest versions of `@achrinza/node-ipc` may work with the --harmony flag. Officially though, we support node v4 and newer with es5 and es6

#### Testing

`npm test` will run the jasmine tests with istanbul for @achrinza/node-ipc and generate a coverage report in the spec folder.

You may want to install jasmine and istanbul globally with `sudo npm install -g jasmine istanbul`

---

#### Contents

1. [Types of IPC Sockets and Supporting OS](#types-of-ipc-sockets)
1. [IPC Config](#ipc-config)
1. [IPC Methods](#ipc-methods)
   1. [log](#log)
   2. [connectTo](#connectto)
   3. [connectToNet](#connecttonet)
   4. [disconnect](#disconnect)
   5. [serve](#serve)
   6. [serveNet](#servenet)
1. [IPC Stores and Default Variables](#ipc-stores-and-default-variables)
1. [IPC Events](#ipc-events)
1. [Multiple IPC instances](#multiple-ipc-instances)
1. [Basic Examples](#basic-examples)
   1. [Server for Unix||Windows Sockets & TCP Sockets](#server-for-unix-sockets-windows-sockets--tcp-sockets)
   2. [Client for Unix||Windows Sockets & TCP Sockets](#client-for-unix-sockets--tcp-sockets)
   3. [Server & Client for UDP Sockets](#server--client-for-udp-sockets)
   4. [Raw Buffers, Real Time and / or Binary Sockets](#raw-buffer-or-binary-sockets)
1. [Working with TLS/SSL Socket Servers & Clients](https://github.com/RIAEvangelist/@achrinza/node-ipc/tree/master/example/TLSSocket)
1. [Node Code Examples](https://github.com/RIAEvangelist/@achrinza/node-ipc/tree/master/example)

---

#### Types of IPC Sockets

| Type                          | Stability | Definition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unix Socket or Windows Socket | Stable    | Gives Linux, Mac, and Windows lightning fast communication and avoids the network card to reduce overhead and latency. [Local Unix and Windows Socket examples ](https://github.com/RIAEvangelist/@achrinza/node-ipc/tree/master/example/unixWindowsSocket/ "Unix and Windows Socket Node IPC examples")                                                                                                                                                                                                                                                                                                                                 |
| TCP Socket                    | Stable    | Gives the most reliable communication across the network. Can be used for local IPC as well, but is slower than #1's Unix Socket Implementation because TCP sockets go through the network card while Unix Sockets and Windows Sockets do not. [Local or remote network TCP Socket examples ](https://github.com/RIAEvangelist/@achrinza/node-ipc/tree/master/example/TCPSocket/ "TCP Socket Node IPC examples")                                                                                                                                                                                                                         |
| TLS Socket                    | Stable    | Configurable and secure network socket over SSL. Equivalent to https. [TLS/SSL documentation](https://github.com/RIAEvangelist/@achrinza/node-ipc/tree/master/example/TLSSocket)                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| UDP Sockets                   | Stable    | Gives the **fastest network communication**. UDP is less reliable but much faster than TCP. It is best used for streaming non critical data like sound, video, or multiplayer game data as it can drop packets depending on network connectivity and other factors. UDP can be used for local IPC as well, but is slower than #1's Unix Socket or Windows Socket Implementation because UDP sockets go through the network card while Unix and Windows Sockets do not. [Local or remote network UDP Socket examples ](https://github.com/RIAEvangelist/@achrinza/node-ipc/tree/master/example/UDPSocket/ "UDP Socket Node IPC examples") |

| OS    | Supported Sockets          |
| ----- | -------------------------- |
| Linux | Unix, Posix, TCP, TLS, UDP |
| Mac   | Unix, Posix, TCP, TLS, UDP |
| Win   | Windows, TCP, TLS, UDP     |

---

#### IPC Config

`ipc.config`

Set these variables in the `ipc.config` scope to overwrite or set default values.

```javascript

    {
        appspace        : 'app.',
        socketRoot      : '/tmp/',
        id              : os.hostname(),
        networkHost     : 'localhost', //should resolve to 127.0.0.1 or ::1 see the table below related to this
        networkPort     : 8000,
        readableAll     : false,
        writableAll     : false,
        encoding        : 'utf8',
        rawBuffer       : false,
        delimiter       : '\f',
        sync            : false,
        silent          : false,
        logInColor      : true,
        logDepth        : 5,
        logger          : console.log,
        maxConnections  : 100,
        retry           : 500,
        maxRetries      : false,
        stopRetrying    : false,
        unlink          : true,
        interfaces      : {
            localAddress: false,
            localPort   : false,
            family      : false,
            hints       : false,
            lookup      : false
        }
    }

```

| variable       | documentation                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| appspace       | used for Unix Socket (Unix Domain Socket) namespacing. If not set specifically, the Unix Domain Socket will combine the socketRoot, appspace, and id to form the Unix Socket Path for creation or binding. This is available in case you have many apps running on your system, you may have several sockets with the same id, but if you change the appspace, you will still have app specic unique sockets. |
| socketRoot     | the directory in which to create or bind to a Unix Socket                                                                                                                                                                                                                                                                                                                                                     |
| id             | the id of this socket or service                                                                                                                                                                                                                                                                                                                                                                              |
| networkHost    | the local or remote host on which TCP, TLS or UDP Sockets should connect                                                                                                                                                                                                                                                                                                                                      |
| networkPort    | the default port on which TCP, TLS, or UDP sockets should connect                                                                                                                                                                                                                                                                                                                                             |
| readableAll    | makes the pipe readable for all users including windows services                                                                                                                                                                                                                                                                                                                                              |
| writableAll    | makes the pipe writable for all users including windows services                                                                                                                                                                                                                                                                                                                                              |
| encoding       | the default encoding for data sent on sockets. Mostly used if rawBuffer is set to true. Valid values are : ` ascii` `utf8` ` utf16le` ` ucs2` ` base64` `hex` .                                                                                                                                                                                                                                               |
| rawBuffer      | if true, data will be sent and received as a raw node `Buffer` **NOT** an `Object` as JSON. This is great for Binary or hex IPC, and communicating with other processes in languages like C and C++                                                                                                                                                                                                           |
| delimiter      | the delimiter at the end of each data packet.                                                                                                                                                                                                                                                                                                                                                                 |
| sync           | synchronous requests. Clients will not send new requests until the server answers.                                                                                                                                                                                                                                                                                                                            |
| silent         | turn on/off logging default is false which means logging is on                                                                                                                                                                                                                                                                                                                                                |
| logInColor     | turn on/off util.inspect colors for ipc.log                                                                                                                                                                                                                                                                                                                                                                   |
| logDepth       | set the depth for util.inspect during ipc.log                                                                                                                                                                                                                                                                                                                                                                 |
| logger         | the function which receives the output from ipc.log; should take a single string argument                                                                                                                                                                                                                                                                                                                     |
| maxConnections | this is the max number of connections allowed to a socket. It is currently only being set on Unix Sockets. Other Socket types are using the system defaults.                                                                                                                                                                                                                                                  |
| retry          | this is the time in milliseconds a client will wait before trying to reconnect to a server if the connection is lost. This does not effect UDP sockets since they do not have a client server relationship like Unix Sockets and TCP Sockets.                                                                                                                                                                 |
| maxRetries     | if set, it represents the maximum number of retries after each disconnect before giving up and completely killing a specific connection                                                                                                                                                                                                                                                                       |
| stopRetrying   | Defaults to false meaning clients will continue to retry to connect to servers indefinitely at the retry interval. If set to any number the client will stop retrying when that number is exceeded after each disconnect. If set to true in real time it will immediately stop trying to connect regardless of maxRetries. If set to 0, the client will **_NOT_** try to reconnect.                           |
| unlink         | Defaults to true meaning that the module will take care of deleting the IPC socket prior to startup. If you use `@achrinza/node-ipc` in a clustered environment where there will be multiple listeners on the same socket, you must set this to `false` and then take care of deleting the socket in your own code.                                                                                           |
| interfaces     | primarily used when specifying which interface a client should connect through. see the [socket.connect documentation in the node.js api](https://nodejs.org/api/net.html#net_socket_connect_options_connectlistener)                                                                                                                                                                                         |

---

#### IPC Methods

These methods are available in the IPC Scope.

---

##### log

`ipc.log(a,b,c,d,e...);`

ipc.log will accept any number of arguments and if `ipc.config.silent` is not set, it will concat them all with a single space ' ' between them and then log them to the console. This is fast because it prevents any concatenation from happening if the ipc.config.silent is set `true`. That way if you leave your logging in place it should have almost no effect on performance.

The log also uses util.inspect You can control if it should log in color, the log depth, and the destination via `ipc.config`

```javascript
ipc.config.logInColor = true; //default
ipc.config.logDepth = 5; //default
ipc.config.logger = console.log.bind(console); // default
```

---

##### connectTo

`ipc.connectTo(id,path,callback);`

Used for connecting as a client to local Unix Sockets and Windows Sockets. **_This is the fastest way for processes on the same machine to communicate_** because it bypasses the network card which TCP and UDP must both use.

| variable | required | definition                                                                                                                                                                                                                                                                     |
| -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| id       | required | is the string id of the socket being connected to. The socket with this id is added to the ipc.of object when created.                                                                                                                                                         |
| path     | optional | is the path of the Unix Domain Socket File, if the System is Windows, this will automatically be converted to an appropriate pipe with the same information as the Unix Domain Socket File. If not set this will default to `ipc.config.socketRoot`+`ipc.config.appspace`+`id` |
| callback | optional | this is the function to execute when the socket has been created.                                                                                                                                                                                                              |

**examples** arguments can be ommitted so long as they are still in order.

```javascript
ipc.connectTo("world");
```

or using just an id and a callback

```javascript
ipc.connectTo("world", function () {
  ipc.of.world.on("hello", function (data) {
    ipc.log(data.debug);
    //if data was a string, it would have the color set to the debug style applied to it
  });
});
```

or explicitly setting the path

```javascript
ipc.connectTo("world", "myapp.world");
```

or explicitly setting the path with callback

```javascript

    ipc.connectTo(
        'world',
        'myapp.world',
        function(){
            ...
        }
    );

```

---

##### connectToNet

`ipc.connectToNet(id,host,port,callback)`

Used to connect as a client to a TCP or [TLS socket](https://github.com/RIAEvangelist/@achrinza/node-ipc/tree/master/example/TLSSocket) via the network card. This can be local or remote, if local, it is recommended that you use the Unix and Windows Socket Implementaion of `connectTo` instead as it is much faster since it avoids the network card altogether.

For TLS and SSL Sockets see the [@achrinza/node-ipc TLS and SSL docs](https://github.com/RIAEvangelist/@achrinza/node-ipc/tree/master/example/TLSSocket). They have a few additional requirements, and things to know about and so have their own doc.

| variable | required | definition                                                                                                                                                                   |
| -------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id       | required | is the string id of the socket being connected to. For TCP & TLS sockets, this id is added to the `ipc.of` object when the socket is created with a reference to the socket. |
| host     | optional | is the host on which the TCP or TLS socket resides. This will default to `ipc.config.networkHost` if not specified.                                                          |
| port     | optional | the port on which the TCP or TLS socket resides.                                                                                                                             |
| callback | optional | this is the function to execute when the socket has been created.                                                                                                            |

**examples** arguments can be ommitted so long as they are still in order.  
So while the default is : (id,host,port,callback), the following examples will still work because they are still in order (id,port,callback) or (id,host,callback) or (id,port) etc.

```javascript
ipc.connectToNet("world");
```

or using just an id and a callback

```javascript

    ipc.connectToNet(
        'world',
        function(){
            ...
        }
    );

```

or explicitly setting the host and path

```javascript

    ipc.connectToNet(
        'world',
        'myapp.com',serve(path,callback)
        3435
    );

```

or only explicitly setting port and callback

```javascript

    ipc.connectToNet(
        'world',
        3435,
        function(){
            ...
        }
    );

```

---

##### disconnect

`ipc.disconnect(id)`

Used to disconnect a client from a Unix, Windows, TCP or TLS socket. The socket and its refrence will be removed from memory and the `ipc.of` scope. This can be local or remote. UDP clients do not maintain connections and so there are no Clients and this method has no value to them.

| variable | required | definition                                               |
| -------- | -------- | -------------------------------------------------------- |
| id       | required | is the string id of the socket from which to disconnect. |

**examples**

```javascript
ipc.disconnect("world");
```

---

##### serve

`ipc.serve(path,callback);`

Used to create local Unix Socket Server or Windows Socket Server to which Clients can bind. The server can `emit` events to specific Client Sockets, or `broadcast` events to all known Client Sockets.

| variable | required | definition                                                                                                                                                                                                                                                                          |
| -------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| path     | optional | This is the path of the Unix Domain Socket File, if the System is Windows, this will automatically be converted to an appropriate pipe with the same information as the Unix Domain Socket File. If not set this will default to `ipc.config.socketRoot`+`ipc.config.appspace`+`id` |
| callback | optional | This is a function to be called after the Server has started. This can also be done by binding an event to the start event like `ipc.server.on('start',function(){});`                                                                                                              |

**_examples_** arguments can be omitted so long as they are still in order.

```javascript
ipc.serve();
```

or specifying callback

```javascript

    ipc.serve(
        function(){...}
    );

```

or specify path

```javascript
ipc.serve("/tmp/myapp.myservice");
```

or specifying everything

```javascript

    ipc.serve(
        '/tmp/myapp.myservice',
        function(){...}
    );

```

---

##### serveNet

`serveNet(host,port,UDPType,callback)`

Used to create TCP, TLS or UDP Socket Server to which Clients can bind or other servers can send data to. The server can `emit` events to specific Client Sockets, or `broadcast` events to all known Client Sockets.

| variable | required | definition                                                                                                                                                                                |
| -------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| host     | optional | If not specified this defaults to the first address in os.networkInterfaces(). For TCP, TLS & UDP servers this is most likely going to be 127.0.0.1 or ::1                                |
| port     | optional | The port on which the TCP, UDP, or TLS Socket server will be bound, this defaults to 8000 if not specified                                                                                |
| UDPType  | optional | If set this will create the server as a UDP socket. 'udp4' or 'udp6' are valid values. This defaults to not being set. When using udp6 make sure to specify a valid IPv6 host, like `::1` |
| callback | optional | Function to be called when the server is created                                                                                                                                          |

**_examples_** arguments can be ommitted solong as they are still in order.

default tcp server

```javascript
ipc.serveNet();
```

default udp server

```javascript
ipc.serveNet("udp4");
```

or specifying TCP server with callback

```javascript

    ipc.serveNet(
        function(){...}
    );

```

or specifying UDP server with callback

```javascript

    ipc.serveNet(
        'udp4',
        function(){...}
    );

```

or specify port

```javascript
ipc.serveNet(3435);
```

or specifying everything TCP

```javascript

    ipc.serveNet(
        'MyMostAwesomeApp.com',
        3435,
        function(){...}
    );

```

or specifying everything UDP

```javascript

    ipc.serveNet(
        'MyMostAwesomeApp.com',
        3435,
        'udp4',
        function(){...}
    );

```

---

### IPC Stores and Default Variables

| variable   | definition                                                                                                                                                                                                                 |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ipc.of     | This is where socket connection refrences will be stored when connecting to them as a client via the `ipc.connectTo` or `iupc.connectToNet`. They will be stored based on the ID used to create them, eg : ipc.of.mySocket |
| ipc.server | This is a refrence to the server created by `ipc.serve` or `ipc.serveNet`                                                                                                                                                  |

---

### IPC Server Methods

| method | definition                                                                  |
| ------ | --------------------------------------------------------------------------- |
| start  | start serving need to call `serve` or `serveNet` first to set up the server |
| stop   | close the server and stop serving                                           |

---

### IPC Events

| event name            | params                   | definition                                                                                                                                                                                      |
| --------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| error                 | err obj                  | triggered when an error has occured                                                                                                                                                             |
| connect               |                          | triggered when socket connected                                                                                                                                                                 |
| disconnect            |                          | triggered by client when socket has disconnected from server                                                                                                                                    |
| socket.disconnected   | socket destroyedSocketID | triggered by server when a client socket has disconnected                                                                                                                                       |
| destroy               |                          | triggered when socket has been totally destroyed, no further auto retries will happen and all references are gone.                                                                              |
| data                  | buffer                   | triggered when ipc.config.rawBuffer is true and a message is received.                                                                                                                          |
| **_your event type_** | **_your event data_**    | triggered when a JSON message is received. The event name will be the type string from your message and the param will be the data object from your message eg : `{ type:'myEvent',data:{a:1}}` |

### Multiple IPC Instances

Sometimes you might need explicit and independent instances of @achrinza/node-ipc. Just for such scenarios we have exposed the core IPC class on the IPC singleton.

```javascript
const RawIPC = require("@achrinza/node-ipc").IPC;
const ipc = new RawIPC();
const someOtherExplicitIPC = new RawIPC();

//OR

const ipc = require("@achrinza/node-ipc");
const someOtherExplicitIPC = new ipc.IPC();

//setting explicit configs

//keep one silent and the other verbose
ipc.config.silent = true;
someOtherExplicitIPC.config.silent = true;

//make one a raw binary and the other json based ipc
ipc.config.rawBuffer = false;

someOtherExplicitIPC.config.rawBuffer = true;
someOtherExplicitIPC.config.encoding = "hex";
```

---

### Basic Examples

You can find [Advanced Examples](https://github.com/RIAEvangelist/@achrinza/node-ipc/tree/master/example) in the examples folder. In the examples you will find more complex demos including multi client examples.

#### Server for Unix Sockets, Windows Sockets & TCP Sockets

The server is the process keeping a socket for IPC open. Multiple sockets can connect to this server and talk to it. It can also broadcast to all clients or emit to a specific client. This is the most basic example which will work for local Unix and Windows Sockets as well as local or remote network TCP Sockets.

```javascript
var ipc = require("@achrinza/node-ipc");

ipc.config.id = "world";
ipc.config.retry = 1500;

ipc.serve(function () {
  ipc.server.on("message", function (data, socket) {
    ipc.log("got a message : ".debug, data);
    ipc.server.emit(
      socket,
      "message", //this can be anything you want so long as
      //your client knows.
      data + " world!"
    );
  });
  ipc.server.on("socket.disconnected", function (socket, destroyedSocketID) {
    ipc.log("client " + destroyedSocketID + " has disconnected!");
  });
});

ipc.server.start();
```

#### Client for Unix Sockets & TCP Sockets

The client connects to the servers socket for Inter Process Communication. The socket will receive events emitted to it specifically as well as events which are broadcast out on the socket by the server. This is the most basic example which will work for both local Unix Sockets and local or remote network TCP Sockets.

```javascript
var ipc = require("@achrinza/node-ipc");

ipc.config.id = "hello";
ipc.config.retry = 1500;

ipc.connectTo("world", function () {
  ipc.of.world.on("connect", function () {
    ipc.log("## connected to world ##".rainbow, ipc.config.delay);
    ipc.of.world.emit(
      "message", //any event or message type your server listens for
      "hello"
    );
  });
  ipc.of.world.on("disconnect", function () {
    ipc.log("disconnected from world".notice);
  });
  ipc.of.world.on(
    "message", //any event or message type your server listens for
    function (data) {
      ipc.log("got a message from world : ".debug, data);
    }
  );
});
```

#### Server & Client for UDP Sockets

UDP Sockets are different than Unix, Windows & TCP Sockets because they must be bound to a unique port on their machine to receive messages. For example, A TCP, Unix, or Windows Socket client could just connect to a separate TCP, Unix, or Windows Socket sever. That client could then exchange, both send and receive, data on the servers port or location. UDP Sockets can not do this. They must bind to a port to receive or send data.

This means a UDP Client and Server are the same thing because in order to receive data, a UDP Socket must have its own port to receive data on, and only one process can use this port at a time. It also means that in order to `emit` or `broadcast` data the UDP server will need to know the host and port of the Socket it intends to broadcast the data to.

This is the most basic example which will work for both local and remote UDP Sockets.

##### UDP Server 1 - "World"

```javascript
var ipc = require("../../../@achrinza/node-ipc");

ipc.config.id = "world";
ipc.config.retry = 1500;

ipc.serveNet("udp4", function () {
  console.log(123);
  ipc.server.on("message", function (data, socket) {
    ipc.log(
      "got a message from ".debug,
      data.from.variable,
      " : ".debug,
      data.message.variable
    );
    ipc.server.emit(socket, "message", {
      from: ipc.config.id,
      message: data.message + " world!",
    });
  });

  console.log(ipc.server);
});

ipc.server.start();
```

##### UDP Server 2 - "Hello"

_note_ we set the port here to 8001 because the world server is already using the default ipc.config.networkPort of 8000. So we can not bind to 8000 while world is using it.

```javascript
ipc.config.id = "hello";
ipc.config.retry = 1500;

ipc.serveNet(8001, "udp4", function () {
  ipc.server.on("message", function (data) {
    ipc.log("got Data");
    ipc.log(
      "got a message from ".debug,
      data.from.variable,
      " : ".debug,
      data.message.variable
    );
  });
  ipc.server.emit(
    {
      address: "127.0.0.1", //any hostname will work
      port: ipc.config.networkPort,
    },
    "message",
    {
      from: ipc.config.id,
      message: "Hello",
    }
  );
});

ipc.server.start();
```

#### Raw Buffer or Binary Sockets

Binary or Buffer sockets can be used with any of the above socket types, however the way data events are emit is **_slightly_** different. These may come in handy if working with embedded systems or C / C++ processes. You can even make sure to match C or C++ string typing.

When setting up a rawBuffer socket you must specify it as such :

```javascript
ipc.config.rawBuffer = true;
```

You can also specify its encoding type. The default is `utf8`

```javascript
ipc.config.encoding = "utf8";
```

emit string buffer :

```javascript
//server
ipc.server.emit(socket, "hello");

//client
ipc.of.world.emit("hello");
```

emit byte array buffer :

```javascript
//hex encoding may work best for this.
ipc.config.encoding = "hex";

//server
ipc.server.emit(socket, [10, 20, 30]);

//client
ipc.server.emit([10, 20, 30]);
```

emit binary or hex array buffer, this is best for real time data transfer, especially whan connecting to C or C++ processes, or embedded systems :

```javascript
ipc.config.encoding = "hex";

//server
ipc.server.emit(socket, [0x05, 0x6d, 0x5c]);

//client
ipc.server.emit([0x05, 0x6d, 0x5c]);
```

Writing explicit buffers, int types, doubles, floats etc. as well as big endian and little endian data to raw buffer nostly valuable when connecting to C or C++ processes, or embedded systems (see more detailed info on buffers as well as UInt, Int, double etc. here)[https://nodejs.org/api/buffer.html]:

```javascript
ipc.config.encoding = "hex";

//make a 6 byte buffer for example
const myBuffer = Buffer.alloc(6).fill(0);

//fill the first 2 bytes with a 16 bit (2 byte) short unsigned int

//write a UInt16 (2 byte or short) as Big Endian
myBuffer.writeUInt16BE(
  2, //value to write
  0 //offset in bytes
);
//OR
myBuffer.writeUInt16LE(0x2, 0);
//OR
myBuffer.writeUInt16LE(0x02, 0);

//fill the remaining 4 bytes with a 32 bit (4 byte) long unsigned int

//write a UInt32 (4 byte or long) as Big Endian
myBuffer.writeUInt32BE(
  16772812, //value to write
  2 //offset in bytes
);
//OR
myBuffer.writeUInt32BE(0xffeecc, 0);

//server
ipc.server.emit(socket, myBuffer);

//client
ipc.server.emit(myBuffer);
```

#### Server with the `cluster` Module

`@achrinza/node-ipc` can be used with Node.js' [cluster module](https://nodejs.org/api/cluster.html) to provide the ability to have multiple readers for a single socket. Doing so simply requires you to set the `unlink` property in the config to `false` and take care of unlinking the socket path in the master process:

##### Server

```javascript
const fs = require("fs");
const ipc = require("../../../@achrinza/node-ipc");
const cpuCount = require("os").cpus().length;
const cluster = require("cluster");
const socketPath = "/tmp/ipc.sock";

ipc.config.unlink = false;

if (cluster.isMaster) {
  if (fs.existsSync(socketPath)) {
    fs.unlinkSync(socketPath);
  }

  for (let i = 0; i < cpuCount; i++) {
    cluster.fork();
  }
} else {
  ipc.serve(socketPath, function () {
    ipc.server.on("currentDate", function (data, socket) {
      console.log(`pid ${process.pid} got: `, data);
    });
  });

  ipc.server.start();
  console.log(`pid ${process.pid} listening on ${socketPath}`);
}
```

##### Client

```javascript
const fs = require("fs");
const ipc = require("../../@achrinza/node-ipc");

const socketPath = "/tmp/ipc.sock";

//loop forever so you can see the pid of the cluster sever change in the logs
setInterval(function () {
  ipc.connectTo("world", socketPath, connecting);
}, 2000);

function connecting(socket) {
  ipc.of.world.on("connect", function () {
    ipc.of.world.emit("currentDate", {
      message: new Date().toISOString(),
    });
    ipc.disconnect("world");
  });
}
```

#### Licensed under MIT license

See the [MIT license](https://github.com/RIAEvangelist/@achrinza/node-ipc/blob/master/license) file.
