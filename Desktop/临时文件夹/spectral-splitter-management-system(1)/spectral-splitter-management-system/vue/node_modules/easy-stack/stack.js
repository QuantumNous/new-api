class Stack{
    constructor(){
        this.stack=[];
        this.autoRun=true;
        this.running=false;
        this.stop=false;
    }

    clear(){
        this.stack=[];
        return this.stack;
    }

    contents(val){
        if(val){
          this.stack=val;
        }
        return this.stack;
    }

    add(...callbacks){
        this.stack.push(...callbacks);
        if(!this.running && !this.stop && this.autoRun){
            this.next();
        }
    }

    next(){
        this.running=true;
        if(this.stack.length<1 || this.stop){
            this.running=false;
            return;
        }

        this.stack.pop().bind(this)();
    }
}

module.exports=Stack;
