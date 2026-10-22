
const {RessourceState} = require("engine/states");
const { Component } =  require("engine/component/component");

class CrasherComponent extends Component{
	
	static crash_on_init = false;
	static crash_on_close = false;
	
	async initialize(){
		this.state = RessourceState.LOADING;
		
		if( CrasherComponent.crash_on_init ){
			throw new Error("Test-triggered error");
		}
		
		this.state = RessourceState.READY;
	}
	
	async close(){
		this.state = RessourceState.CLOSING;
		
		if( CrasherComponent.crash_on_close ){
			throw new Error("Test-triggered error");
		}
		
		this.state = RessourceState.CLOSED;
	}
	
	
	
}

module.exports = CrasherComponent