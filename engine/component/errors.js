
const {ScrapOrchestraError} = require("../../lib/errors.js");

class ComponentNotFoundError extends ScrapOrchestraError {
    constructor(message = "Component not found") {
        super("NOT_FOUND", message);
    }
}

class ComponentAlreadyInstalledError extends ScrapOrchestraError {
    constructor(message = "Component not found") {
        super("ALREADY_EXISTS", message);
    }
}

class ComponentInvalidError extends ScrapOrchestraError {
    constructor(message = "Invalid component") {
        super("FAILED", message);
    }
}

class ComponentUnexpectedlyTerminatedError extends ScrapOrchestraError {
    constructor(message = "Component unexpectedly terminated") {
        super("FAILED", message);
    }
}

class ComponentNotProperlyClosedError extends ScrapOrchestraError {
    constructor(message = "Component could not properly free its resources") {
        super("FAILED", message);
    }
}
class ComponentInitializationError extends ScrapOrchestraError {
    constructor(message = "Component could not be properly initialized") {
        super("FAILED", message);
    }
}
class ComponentInstallationError extends ScrapOrchestraError {
    constructor(message = "Component could not be properly installed in project") {
        super("FAILED", message);
    }
}

module.exports = {
	ComponentUnexpectedlyTerminatedError,
	ComponentNotProperlyClosedError,
	ComponentInvalidError,
	ComponentNotFoundError,
	ComponentAlreadyInstalledError,
	ComponentInstallationError,
	ComponentInitializationError
}