
const {RessourceState} = require("engine/states");
const { Component } =  require("engine/component/component");

class CrasherComponent extends Component{
	async initialize(){
		this.state = RessourceState.LOADING;
		throw new Error("Test-triggered error");
	}
}

module.exports = CrasherComponent