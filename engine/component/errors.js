
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
    constructor(message = "Component could not properly free its resources", options) {
        super("FAILED", message, options);
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

class ComponentNotInstalledError extends ScrapOrchestraError {
    constructor(message = "Component binary is missing, please reinstall it globally") {
        super("FAILED", message);
    }
}

class ComponentUnknownError extends ScrapOrchestraError {
    constructor(message = "Unknown component error", options) {
        super("FAILED", message, options);
    }
}

module.exports = {
	ComponentUnknownError,
	ComponentUnexpectedlyTerminatedError,
	ComponentNotProperlyClosedError,
	ComponentInvalidError,
	ComponentNotFoundError,
	ComponentAlreadyInstalledError,
	ComponentInstallationError,
	ComponentInitializationError,
	ComponentNotInstalledError
}