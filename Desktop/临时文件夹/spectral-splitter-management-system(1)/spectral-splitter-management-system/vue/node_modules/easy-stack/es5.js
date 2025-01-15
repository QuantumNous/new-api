function Stack(){
    Object.defineProperties(
        this,
        {
            add:{
                enumerable:true,
                writable:false,
                value:addToStack
            },
            next:{
                enumerable:true,
                writable:false,
                value:run
            },
            clear:{
                enumerable:true,
                writable:false,
                value:clearStack
            },
            contents:{
                enumerable:false,
                get:getStack,
                set:setStack
            },
            autoRun:{
                enumerable:true,
                writable:true,
                value:true
            },
            stop:{
                enumerable:true,
                writable:true,
                value:false
            }
        }
    );

    var stack=[];
    var running=false;
    var stop=false;

    function clearStack(){
        stack=[];
        return stack;
    }

    function getStack(){
        return stack;
    }

    function setStack(val){
        stack=val;
        return stack;
    }

    function addToStack(){
        for(var i in arguments){
            stack.unshift(arguments[i]);
        }
        if(!running && !this.stop && this.autoRun){
            this.next();
        }
    }

    function run(){
        running=true;
        if(stack.length<1 || this.stop){
            running=false;
            return;
        }

        stack.shift().bind(this)();
    }
}
