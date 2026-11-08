const MODES = require("./modes.json");

class MidishSubController{
	
	static MODES = MODES;
	
    constructor(controller) {
        this.controller = controller;
    }

    get session() {
        return this.controller.session;
    }
	
	// use this when sure that having stderr lines in our command response means command failed
	async sendCheckedCommand(cmd) {
		const result = await this.sendCommand(cmd);

		if (result.err?.length) {
			throw new Error(result.err.join("\n"));
		}

		return result;
	}
	
	/*
		Otherwise use this for commands that may just emit warnings (like import) but succeed nonetheless 
		Mind that it usually mean that success has to be asserted in other more derivative ways... 
	*/
    sendCommand(cmd) {
        return this.controller.midishProcess.sendCommand(cmd);
    }
	
    enqueueOperation(operation) {
        return this.controller.enqueueOperation(operation);
    }

    refreshSessionUnsafe() {
        return this.controller.sessionController.refreshSessionUnsafe();
    }
}


module.exports = {MidishSubController}