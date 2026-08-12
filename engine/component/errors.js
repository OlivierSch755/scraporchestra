
class ComponentError {
	constructor(message){
		this.message = message;
	}
};

class ComponentNotLoadedError extends ComponentError {};

class ComponentInvalidError extends ComponentError {};

class ComponentNotFoundError extends ComponentError {};

class ComponentUnexpectedlyTerminatedError extends ComponentError {};

class ComponentNotProperlyClosedError extends ComponentError {};


module.exports = {
	ComponentError,
	ComponentUnexpectedlyTerminatedError,
	ComponentNotProperlyClosedError,
	ComponentInvalidError,
	ComponentNotFoundError,
	ComponentNotLoadedError
}