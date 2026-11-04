const ResourceState = require("./states.json");

function validateState(state){
	if( !Object.values(ResourceState).includes(state) ) throw new TypeError("Invalid ResourceState : " + state);
}

module.exports = {
	ResourceState,
	RessourceState : ResourceState,
	validateState
}