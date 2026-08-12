class RequestLimiter extends EventTarget {
	constructor(max = 10) {
		super();
		this.max = max;
		this.active = 0;
		this.queue = [];
		this.saturated = false;
	}
	
	updateState() {
		if (this.active >= this.max || this.queue.length > 0) {
			if(this.saturated) return;
			this.saturated = true;
			this.dispatchEvent(new Event("saturated"));
		} else {
			if(!this.saturated) return;
			this.saturated = false;
			this.dispatchEvent(new Event("not_saturated"));
		}
	}

	async run(fn) {
		if (this.active >= this.max) {
			await new Promise(resolve => this.queue.push(resolve));
		}
		this.active++;
		this.updateState();
		try {
			return await fn();
		} finally {
			this.active--;
			if (this.queue.length) {
				this.queue.shift()();
			}
			this.updateState();
		}
	}
}

module.exports.RequestLimiter = RequestLimiter;