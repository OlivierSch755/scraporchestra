
// Notifications
export class Toaster {
	
	static toast_duration_ms = 6000;
	
	static install(){
		
		// Create an empty "constructed" stylesheet
		const sheet = new CSSStyleSheet();
		// Apply a rule to the sheet
		// sheet.replaceSync("a { color: red; }");
		
		sheet.insertRule(`:root { --toast-duration : ${this.toast_duration_ms}ms; }`);
		// Apply the stylesheet to a document
		document.adoptedStyleSheets.push(sheet);		
				
	}
	
	current_id = 0;
	current_messages = new Set();
	
	container = document;
	
	constructor(capacity) {
		this.capacity = capacity;
		this.buffer = new Array(capacity);
		this.size = 0;
		this.start = 0; // Index of the oldest element
	}
	
	push(toast) {
		toast.id = this.current_id++
		if (this.size < this.capacity) {
			this.buffer[(this.start + this.size) % this.capacity] = toast;
			this.size++;
		} else {
			this.buffer[this.start] = toast;
			this.start = (this.start + 1) % this.capacity;
		}
		this.last_message = toast;
		this.addCurrentMessage(toast)
	}

	get messages() {
		const result = [];
		for (let i = 0; i < this.size; i++) {
			const rb_index = (this.start + i) % this.capacity
			result.push( this.buffer[ rb_index ] );
		}
		return result;
	}

	addCurrentMessage(toast){
		
		let timeout;
		toast.duration = Toaster.toast_duration_ms;
		
		const current_messages = this.current_messages;
		const container = this.container;
		
		toast.remove =()=>{
			current_messages.delete(toast)
			clearTimeout(timeout);
		}
		
		this.current_messages.add(toast);
	
		timeout = setTimeout( 
			toast.remove,
			Toaster.toast_duration_ms
		);
		
	}
	
	success( message ){
		this.push( {type:"SUCCESS", message} )
	}

	info( message ){
		this.push( {type:"INFO", message} )
	}

	error( message ){
		this.push( {type:"ERROR", message} )
	}
  
  /*
	handleCommandResponse( cr, { success, error } ){
		// this needs to notify success or error to user
		if( cr.status.status === CommandResponseStatus.SUCCESS ) {
			this.success(success);
		}
		else{
			this.error(error);
		}
		
	}
  */
}

Toaster.install();

// Alpine.store('status', new Toaster(20));

// export const AppStatus = Alpine.store('status');

