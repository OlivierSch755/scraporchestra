import Alpine from '/js/lib/alpine.js';
import {Toaster} from '/js/services/toaster.js';
import { sushiStub } from '../sushi_client/client.js';


class SushiEditorToaster extends Toaster{
	handleCommandResponse( cr, { success, error } ){
		if( cr.status.status === sushiStub.CommandStatus.Status.SUCCESS ) {
			if(success) this.success(success);
			return true;
		}
		else{
			this.error(error);
			return false;
		}
	}
}


Alpine.store('status', new SushiEditorToaster(20));
export const AppStatus = Alpine.store('status');
