var Stack=require('../stack');
//create a new Stack instance
var stack=new Stack;
stack.autoRun=false;

for(var i=0; i<50; i++){
    //add a bunch of stuff to the stack
    stack.add(makeRequest.bind(stack,i));
}

stack.next();

function makeRequest(index){
    //do stuff
    console.log(`making LIFO request ${index}`);

    this.next();
}
