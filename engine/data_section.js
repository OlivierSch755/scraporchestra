class DataSection{
	
	#rev;
	#name = null; 
	
	constructor( name, default_values = {}  ){
		this.#rev = 0;
		this.#name = name;
		Object.assign(this, default_values);
	}
	
	get rev(){
		return this.#rev;
	}
	
	increaseRevision(){
		this.#rev++;
	}
	
	notifyChange(){
		// console.log(`component.midish.${this.#name}`, JSON.parse(JSON.stringify(this)))
		
		Dispatcher.emit(`component.midish.${this.#name}`, this);
	
	}
	
	toJSON(){
		return Object.assign( {rev : this.#rev}, this );
	}
}

module.exports = {DataSection};