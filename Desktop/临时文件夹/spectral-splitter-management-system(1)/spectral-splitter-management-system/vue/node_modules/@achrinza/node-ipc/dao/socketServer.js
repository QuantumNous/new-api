'use strict';

const net = require('net'),
    tls = require('tls'),
    fs = require('fs'),
    dgram = require('dgram'),
    EventParser = require('../entities/EventParser.js'),
    Message = require('js-message'),
    Events = require('event-pubsub');

let eventParser = new EventParser();

class Server extends Events{
    constructor(path,config,log,port){
        super();
        Object.assign(
            this,
            {
                config          : config,
                path            : path,
                port            : port,
                udp4            : false,
                udp6            : false,
                log             : log,
                server          : false,
                sockets         : [],
                emit            : emit,
                broadcast       : broadcast
            }
        );

        eventParser=new EventParser(this.config);

        this.on(
            'close',
            serverClosed.bind(this)
        );
    }

    onStart(socket){
        this.trigger(
            'start',
            socket
        );
    }

    stop(){
        this.server.close();
    }

    start(){
        if(!this.path){
            this.log('Socket Server Path not specified, refusing to start');
            return;
        }

        if(this.config.unlink){
            fs.unlink(
                this.path,
                startServer.bind(this)
            );
        }else{
            startServer.bind(this)();
        }
    }
}

function emit(socket, type, data){
    this.log('dispatching event to socket', ' : ', type, data);

    let message=new Message;
    message.type=type;
    message.data=data;

    if(this.config.rawBuffer){
        this.log(this.config.encoding)
        message=Buffer.from(type,this.config.encoding);
    }else{
        message=eventParser.format(message);
    }

    if(this.udp4 || this.udp6){

        if(!socket.address || !socket.port){
            this.log('Attempting to emit to a single UDP socket without supplying socket address or port. Redispatching event as broadcast to all connected sockets');
            this.broadcast(type,data);
            return;
        }

        this.server.write(
            message,
            socket
        );
        return;
    }

    socket.write(message);
}

function broadcast(type,data){
    this.log('broadcasting event to all known sockets listening to ', this.path,' : ', ((this.port)?this.port:''), type, data);
    let message=new Message;
    message.type=type;
    message.data=data;

    if(this.config.rawBuffer){
        message=Buffer.from(type,this.config.encoding);
    }else{
        message=eventParser.format(message);
    }

    if(this.udp4 || this.udp6){
        for(let i=1, count=this.sockets.length; i<count; i++){
            this.server.write(message,this.sockets[i]);
        }
    }else{
        for(let i=0, count=this.sockets.length; i<count; i++){
            this.sockets[i].write(message);
        }
    }
}

function serverClosed(){
    for(let i=0, count=this.sockets.length; i<count; i++){
        let socket=this.sockets[i];
        let destroyedSocketId=false;

        if(socket){
            if(socket.readable){
                continue;
            }
        }

        if(socket.id){
            destroyedSocketId=socket.id;
        }

        this.log('socket disconnected',destroyedSocketId.toString());

        if(socket && socket.destroy){
            socket.destroy();
        }

        this.sockets.splice(i,1);

        this.publish('socket.disconnected', socket, destroyedSocketId);

        return;
    }
}

function gotData(socket,data,UDPSocket){
    let sock=((this.udp4 || this.udp6)? UDPSocket : socket);
    if(this.config.rawBuffer){
        data=Buffer.from(data,this.config.encoding);
        this.publish(
            'data',
            data,
            sock
        );
        return;
    }

    if(!sock.ipcBuffer){
        sock.ipcBuffer='';
    }

    data=(sock.ipcBuffer+=data);

    if(data.slice(-1)!=eventParser.delimiter || data.indexOf(eventParser.delimiter) == -1){
        this.log('Messages are large, You may want to consider smaller messages.');
        return;
    }

    sock.ipcBuffer='';

    data=eventParser.parse(data);

    while(data.length>0){
        let message=new Message;
        message.load(data.shift());

        // Only set the sock id if it is specified.
        if (message.data && message.data.id){
            sock.id=message.data.id;
        }

        this.log('received event of : ',message.type,message.data);

        this.publish(
            message.type,
            message.data,
            sock
        );
    }
}

function socketClosed(socket){
    this.publish(
        'close',
        socket
    );
}

function serverCreated(socket) {
    this.sockets.push(socket);

    if(socket.setEncoding){
        socket.setEncoding(this.config.encoding);
    }

    this.log('## socket connection to server detected ##');
    socket.on(
        'close',
        socketClosed.bind(this)
    );

    socket.on(
        'error',
        function(err){
            this.log('server socket error',err);

            this.publish('error',err);
        }.bind(this)
    );

    socket.on(
        'data',
        gotData.bind(this,socket)
    );

    socket.on(
        'message',
        function(msg,rinfo) {
            if (!rinfo){
                return;
            }

            this.log('Received UDP message from ', rinfo.address, rinfo.port);
            let data;

            if(this.config.rawSocket){
                data=Buffer.from(msg,this.config.encoding);
            }else{
                data=msg.toString();
            }
            socket.emit('data',data,rinfo);
        }.bind(this)
    );

    this.publish(
        'connect',
        socket
    );

    if(this.config.rawBuffer){
        return;
    }
}

function startServer() {
    this.log(
        'starting server on ',this.path,
        ((this.port)?`:${this.port}`:'')
    );

    if(!this.udp4 && !this.udp6){
        this.log('starting TLS server',this.config.tls);
        if(!this.config.tls){
            this.server=net.createServer(
                serverCreated.bind(this)
            );
        }else{
            startTLSServer.bind(this)();
        }
    }else{
        this.server=dgram.createSocket(
            ((this.udp4)? 'udp4':'udp6')
        );
        this.server.write=UDPWrite.bind(this);
        this.server.on(
            'listening',
            function UDPServerStarted() {
                serverCreated.bind(this)(this.server);
            }.bind(this)
        );
    }

    this.server.on(
        'error',
        function(err){
            this.log('server error',err);

            this.publish(
                'error',
                err
            );
        }.bind(this)
    );

    this.server.maxConnections=this.config.maxConnections;

    if(!this.port){
        this.log('starting server as', 'Unix || Windows Socket');
        if (process.platform ==='win32'){
            this.path = this.path.replace(/^\//, '');
            this.path = this.path.replace(/\//g, '-');
            this.path= `\\\\.\\pipe\\${this.path}`;
        }

        this.server.listen({
            path: this.path,
            readableAll: this.config.readableAll,
            writableAll: this.config.writableAll
        }, this.onStart.bind(this));

        return;
    }

    if(!this.udp4 && !this.udp6){
        this.log('starting server as', (this.config.tls?'TLS':'TCP'));
        this.server.listen(
            this.port,
            this.path,
            this.onStart.bind(this)
        );
        return;
    }

    this.log('starting server as',((this.udp4)? 'udp4':'udp6'));

    this.server.bind(
        this.port,
        this.path
    );

    this.onStart(
        {
            address : this.path,
            port    : this.port
        }
    );
}

function startTLSServer(){
    this.log('starting TLS server',this.config.tls);
    if(this.config.tls.private){
        this.config.tls.key=fs.readFileSync(this.config.tls.private);
    }else{
        this.config.tls.key=fs.readFileSync(`${__dirname}/../local-node-ipc-certs/private/server.key`);
    }
    if(this.config.tls.public){
        this.config.tls.cert=fs.readFileSync(this.config.tls.public);
    }else{
        this.config.tls.cert=fs.readFileSync(`${__dirname}/../local-node-ipc-certs/server.pub`);
    }
    if(this.config.tls.dhparam){
        this.config.tls.dhparam=fs.readFileSync(this.config.tls.dhparam);
    }
    if(this.config.tls.trustedConnections){
        if(typeof this.config.tls.trustedConnections === 'string'){
            this.config.tls.trustedConnections=[this.config.tls.trustedConnections];
        }
        this.config.tls.ca=[];
        for(let i=0; i<this.config.tls.trustedConnections.length; i++){
            this.config.tls.ca.push(
                fs.readFileSync(this.config.tls.trustedConnections[i])
            );
        }
    }
    this.server=tls.createServer(
        this.config.tls,
        serverCreated.bind(this)
    );
}

function UDPWrite(message,socket){
    let data=Buffer.from(message, this.config.encoding);
    this.server.send(
        data,
        0,
        data.length,
        socket.port,
        socket.address,
        function(err, bytes) {
            if(err){
                this.log('error writing data to socket',err);
                this.publish(
                    'error',
                    function(err){
                        this.publish('error',err);
                    }
                );
            }
        }
    );
}

module.exports=Server;
