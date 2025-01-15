function Message() {
    Object.defineProperties(
        this, {
            data: {
                enumerable: true,
                get: getData,
                set: setData
            },
            type: {
                enumerable: true,
                get: getType,
                set: setType
            },
            load:{
                enumerable:true,
                writable:false,
                value:parse
            },
            JSON: {
                enumerable: true,
                get: getJSON
            }
        }
    );

    var type = '';
    var data = {};

    function getType() {
        return type;
    }

    function getData() {
        return data;
    }

    function getJSON() {
        return JSON.stringify(
            {
                type: type,
                data: data
            }
        );
    }

    function setType(value) {
        type = value;
    }

    function setData(value) {
        data = value;
    }

    function parse(message){
        try{
            var message=JSON.parse(message);
            type=message.type;
            data=message.data;
        }catch(err){
            var badMessage=message;
            type='error',
            data={
                message:'Invalid JSON response format',
                err:err,
                response:badMessage
            }
        }
    }
}

module.exports=Message;
