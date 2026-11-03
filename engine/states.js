const RessourceState = {
	ERROR : 1,
	LOADING : 2,
	READY : 3,
	CLOSING : 4,
	CLOSED : 5
}

function validateState(state){
	if( !Object.values(RessourceState).includes(state) ) throw new TypeError("Invalid RessourceState : " + state);
}

module.exports = {
	RessourceState,
	validateState
}