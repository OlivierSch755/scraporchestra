const Dispatcher = require("./dispatcher");

const separator = ".";

class DataSection{
	
	#rev;
	#name = null; 
	#prefix = "";
	#path = "";
	
	constructor( prefix, name, default_values = {}, rev = 0 ){
		this.#rev = rev;
		this.#name = name;
		this.#prefix = prefix;
		this.#path = `${this.#prefix}${separator}${this.#name}`;
		Object.assign(this, default_values);
	}
	
	get rev(){
		return this.#rev;
	}
	
	increaseRevision(){
		this.#rev++;
	}
	
	notifyChange(){
		// console.log(this.#path,this)
		Dispatcher.emit(this.#path,this);
	}
	
	toJSON(){
		return Object.assign( {rev : this.#rev}, this );
	}
}

module.exports = {DataSection};