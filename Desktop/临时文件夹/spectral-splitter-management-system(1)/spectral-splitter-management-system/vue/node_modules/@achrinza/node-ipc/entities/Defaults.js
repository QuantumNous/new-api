'use strict';

/*eslint no-magic-numbers: ["error", { "ignore": [ 0] }]*/

/**
 * @module entities
 */

const os = require('os');

/**
 * @class Defaults
 * @description Defaults Entity
 */
class Defaults{

    /**
     * @constructor
     * @method constructor
     * @return {void}
     */
    constructor(){

        this.appspace='app.';
        this.socketRoot='/tmp/';
        this.id=os.hostname();

        this.encoding='utf8';
        this.rawBuffer=false;
        this.sync=false;
        this.unlink=true;

        this.delimiter='\f';

        this.silent=false;
        this.logDepth=5;
        this.logInColor=true;
        this.logger=console.log.bind(console);

        this.maxConnections=100;
        this.retry=500;
        this.maxRetries=Infinity;
        this.stopRetrying=false;

        this.IPType=getIPType();
        this.tls=false;
        this.networkHost = (this.IPType == 'IPv6') ? '::1' : '127.0.0.1';
        this.networkPort = 8000;

        this.readableAll = false;
        this.writableAll = false;

        this.interface={
            localAddress:false,
            localPort:false,
            family:false,
            hints:false,
            lookup:false
        }
    }
}

/**
 * method to get ip type
 *
 * @method getIPType
 * @return {string} ip type
 */
function getIPType() {
    const networkInterfaces = os.networkInterfaces();
    let IPType = '';
    if (networkInterfaces
        && Array.isArray(networkInterfaces)
        && networkInterfaces.length > 0) {
        // getting the family of first network interface available
        IPType = networkInterfaces [
            Object.keys( networkInterfaces )[0]
        ][0].family;
    }
    return IPType;
}

module.exports=Defaults;
