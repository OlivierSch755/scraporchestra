import Alpine from '/js/lib/alpine.js';
import { sushiStub, commandInterface } from '../sushi_client/client.js';
import { sushiStore } from './sushi.js';

import {AppViews} from '/js/lib/alpine_global.js'
import {AppStatus} from './status.js'

const parameterNextUpdate = new WeakMap();
const parameterBusy = new WeakSet();

class SushiEditorApi{
		
	requestInProgress = false;	
	
	async requestMoveProcessor( processor, source_track, dest_track, before_processor ){
		
		this.requestInProgress = true;
		
		const position = sushiStub.ProcessorPosition.create();
		if(before_processor) position.before_processor = before_processor;
		else position.add_to_back = true;
		
		const res = await commandInterface.AudioGraphController.moveProcessorOnTrack( {processor, source_track, dest_track, position }  )

		AppStatus.handleCommandResponse( res, {
			success : "Processor moved",
			error : "Could not move processor"
		});

		AppViews.moving_processor = null;  // this should be handled here
		
		this.requestInProgress = false;
		
	};

	async requestCreateTrack( createTrackRequest ){
		
		this.requestInProgress = true;
		
		const res = await commandInterface.AudioGraphController.createTrack(createTrackRequest);
		
		AppStatus.handleCommandResponse( res, {
			success : `Track created: ${createTrackRequest.name}`,
			error : "Could not create Track"
		});

		AppViews.create_track = null; // this should be handled here
		
		this.requestInProgress = false;
		
	};
	
	async requestCreatePreTrack( createPreTrackRequest ){
		
		this.requestInProgress = true;
		
		const res = await commandInterface.AudioGraphController.createPreTrack(createPreTrackRequest);
		
		AppStatus.handleCommandResponse( res, {
			success : `Pre Track created: ${createPreTrackRequest.name}`,
			error : "Could not create Pre Track"
		});

		AppViews.create_track = null; // this should be handled here
		
		this.requestInProgress = false;
		
	};
	
	async requestCreatePostTrack( createPostTrackRequest ){
		
		this.requestInProgress = true;
		
		const res = await commandInterface.AudioGraphController.createPostTrack(createPostTrackRequest);
		
		AppStatus.handleCommandResponse( res, {
			success : `Post Track created: ${createPostTrackRequest.name}`,
			error : "Could not create Post Track"
		});

		AppViews.create_track = null; // this should not be handled here
		this.requestInProgress = false;
	};
	
	async requestCreateMultibusTrack( createMultibusTrackRequest ){
		
		this.requestInProgress = true;
		
		const res = await commandInterface.AudioGraphController.createMultibusTrack(createMultibusTrackRequest);
		
		AppStatus.handleCommandResponse( res, {
			success : `Multibus Track created: ${createMultibusTrackRequest.name}`,
			error : "Could not create Multibus Track"
		});

		AppViews.create_track = null; // this should not be handled here
		
		this.requestInProgress = false;
		
	};
	
	
	

	async requestDeleteTrack( track ){
		
		this.requestInProgress = true;
		
		const res = await commandInterface.AudioGraphController.deleteTrack(track);
		
		AppStatus.handleCommandResponse( res, {
			success : `Track deleted: ${track.info.value?.name}`,
			error : `Could not delete track ${track.info.value?.name}`
		});
		
		this.requestInProgress = false;

	};
	
	async requestBypassProcessor( processor, bypassed, el = null ){
		
		this.requestInProgress = true;
		
		const res = await commandInterface.AudioGraphController.setProcessorBypassState({processor, value : bypassed });
		
		const ok = AppStatus.handleCommandResponse( res, {
			error : `Could not bypass processor ${processor.name}`
		});
		
		this.requestInProgress = false;
		
		return ok;
		
	}
	
	async requestAddProcessorOnTrack(plugin,track,before_processor){
		
		
		this.requestInProgress = true;
		
		const req = sushiStub.CreateProcessorRequest.create();
		
		if(before_processor){
			req.position  = {before_processor}
		}
		else {
			req.position  = {add_to_back : true}
		}
		
		const type = sushiStub.PluginType.Type[plugin.type];
		Object.assign(req, plugin)
		req.track = track;
		req.type = {type};
		
		console.log(req)
		
		const err = sushiStub.CreateProcessorRequest.verify(req);
		if(err) return AppStatus.error("Invalid plugin request");
		
		const res = await commandInterface.AudioGraphController.createProcessorOnTrack(req);
		AppStatus.handleCommandResponse( res, {
			success : `Processor created: ${plugin.name}`,
			error : `Could not create Processor ${plugin.name}`
		});
		
		this.requestInProgress = false;
		AppViews.adding_processor_on_track = null;
		
	}
	
	async requestDeleteProcessorFromTrack( processor, track ){
		
		this.requestInProgress = true;
		
		const res = await commandInterface.AudioGraphController.deleteProcessorFromTrack({track, processor});
		
		AppStatus.handleCommandResponse( res, {
			success : `Processor deleted: ${processor.info.value?.name}`,
			error : `Could not delete Processor ${processor.info.value?.name}`
		});
		
		this.requestInProgress = false;

	};
	
	async requestNoteOn(track_id,channel,note,velocity){
		
		
		this.requestInProgress = true;
		const res = await commandInterface.KeyboardController.sendNoteOn({track : {id:track_id}, channel, note, velocity})
		const ok = AppStatus.handleCommandResponse( res, {
			error : `Could not send noteon`
		});
		this.requestInProgress = false;
	}
	
	async requestNoteOff(track_id,channel,note,velocity){
		this.requestInProgress = true;
		const res = await commandInterface.KeyboardController.sendNoteOff({track : {id:track_id}, channel, note, velocity})
		const ok = AppStatus.handleCommandResponse( res, {
			error : `Could not send noteoff`
		});
		this.requestInProgress = false;
	}
	
	requestParameterSync(input, value) {
		
		input.pendingValue = Number(value);
		
		if (input.syncTimer) return;

		input.syncTimer = setTimeout(async () => {
			input.syncTimer = null;

			const value = input.pendingValue;
			input.pendingValue = undefined;

			await commandInterface.ParameterController.setParameterValue({
				parameter: input.parameter.identifier,
				value
			});
		}, 30);
	}
		
	
	async requestSetProcessorProgram(processorProgramSetRequest){
		const res = await commandInterface.ProgramController.setProcessorProgram(processorProgramSetRequest)
		const ok = AppStatus.handleCommandResponse( res, {
			success : `Program changed`,
			error : `Could not change Program`
		});
		this.requestInProgress = false;
	}	
		
		
	async requestSetPropertyValue(propertyValue){
		this.requestInProgress = true;
		const res = await CommandInterface.ParameterController.setPropertyValue(propertyValue);
		const ok = AppStatus.handleCommandResponse( res, {
			success : `Property Value updated`,
			error : `Could not update Property Value`
		});

		this.requestInProgress = false;
	}

	async requestDisconnectKbdInput(connection){
		this.requestInProgress = true;
		const res = await commandInterface.MidiController.disconnectKbdInput(connection)
		const ok = AppStatus.handleCommandResponse( res, {
			success : `MIDI connection removed`,
			error : `Could not remove MIDI connection`
		});
		this.requestInProgress = false;
	}
	
	async requestDisconnectKbdOutput(connection){
		this.requestInProgress = true;
		const res = await commandInterface.MidiController.disconnectKbdOutput(connection)
		const ok = AppStatus.handleCommandResponse( res, {
			success : `MIDI connection removed`,
			error : `Could not remove MIDI connection`
		});
		this.requestInProgress = false;
	}
	
	async requestConnectKbdInputToTrack(connection){
		this.requestInProgress = true;
		const res = await commandInterface.MidiController.connectKbdInputToTrack(connection)
		const ok = AppStatus.handleCommandResponse( res, {
			success : `MIDI connection created`,
			error : `Could not remove MIDI connection`
		});
		this.requestInProgress = false;
	}
	
	async requestConnectKbdOutputFromTrack(connection){
		this.requestInProgress = true;
		const res = await commandInterface.MidiController.connectKbdOutputFromTrack(connection)
		const ok = AppStatus.handleCommandResponse( res, {
			success : `MIDI connection created`,
			error : `Could not create MIDI connection`
		});
		this.requestInProgress = false;
	}

	async requestConnectPCToProcessor(connection){
		this.requestInProgress = true;
		const res = await commandInterface.MidiController.connectPCToProcessor(connection)
		const ok = AppStatus.handleCommandResponse( res, {
			success : `PC connection created`,
			error : `Could not create PC connection`
		});
		this.requestInProgress = false;
	}

	async requestDisconnectPC(connection){
		this.requestInProgress = true;
		const res = await commandInterface.MidiController.disconnectPC(connection)
		const ok = AppStatus.handleCommandResponse( res, {
			success : `PC connection removed`,
			error : `Could not remove PC connection`
		});
		this.requestInProgress = false;
	}

	async requestConnectCCToParameter(connection){
		this.requestInProgress = true;
		const res = await commandInterface.MidiController.connectCCToParameter(connection)
		const ok = AppStatus.handleCommandResponse( res, {
			success : `CC connection created`,
			error : `Could not create CC connection`
		});
		this.requestInProgress = false;
	}

	async requestDisconnectCC(connection){
		this.requestInProgress = true;
		const res = await commandInterface.MidiController.disconnectCC(connection)
		const ok = AppStatus.handleCommandResponse( res, {
			success : `CC connection removed`,
			error : `Could not remove CC connection`
		});
		this.requestInProgress = false;
	}

	async requestSetMidiClockOutputEnabled(clk_output){
		
		console.log(clk_output)
		
		this.requestInProgress = true;
		const res = await commandInterface.MidiController.setMidiClockOutputEnabled(clk_output)
		const ok = AppStatus.handleCommandResponse( res, {
			success : `CLK output edited`,
			error : `Could not edit CLK output`
		});
		this.requestInProgress = false;
		return ok;
	}


	async requestSetTimeSignature(time_signature){
		this.requestInProgress = true;
		const res = await commandInterface.TransportController.setTimeSignature(time_signature);
		const ok = AppStatus.handleCommandResponse( res, {
			success : `Time signature updated`,
			error : `Could not update Time signature`
		});
		this.requestInProgress = false;
	}
	
	async requestSetTempo(value){
		this.requestInProgress = true;
		const res = await commandInterface.TransportController.setTempo({value});
		const ok = AppStatus.handleCommandResponse( res, {
			success : `Tempo updated`,
			error : `Could not update Tempo`
		});
		this.requestInProgress = false;
	}
	
	async requestSetSyncMode(sync_mode){
		this.requestInProgress = true;
		const res = await commandInterface.TransportController.setSyncMode(sync_mode);
		const ok = AppStatus.handleCommandResponse( res, {
			success : `Sync Mode updated`,
			error : `Could not update Sync Mode`
		});
		this.requestInProgress = false;
	}
	
	async requestSetPlayingMode(play_mode){
		this.requestInProgress = true;
		const res = await commandInterface.TransportController.setPlayingMode(play_mode);
		const ok = AppStatus.handleCommandResponse( res, {
			success : `Play Mode updated`,
			error : `Could not update Play Mode`
		});
		this.requestInProgress = false;
	}

	async requestConnectInputChannelToTrack(audio_connection){
		this.requestInProgress = true;
		const res = await commandInterface.AudioRoutingController.connectInputChannelToTrack(audio_connection);
		const ok = AppStatus.handleCommandResponse( res, {
			success : `Audio Input connected`,
			error : `Could not connect Audio Input`
		});
		this.requestInProgress = false;
		return ok;
	}

	async requestConnectOutputChannelFromTrack(audio_connection){
		this.requestInProgress = true;
		const res = await commandInterface.AudioRoutingController.connectOutputChannelFromTrack(audio_connection);
		const ok = AppStatus.handleCommandResponse( res, {
			success : `Audio Output connected`,
			error : `Could not connect Audio Output`
		});
		this.requestInProgress = false;
		return ok;
	}

	async requestDisconnectInput(audio_connection){
		this.requestInProgress = true;
		const res = await commandInterface.AudioRoutingController.disconnectInput(audio_connection);
		const ok = AppStatus.handleCommandResponse( res, {
			success : `Audio Input disconnected`,
			error : `Could not disconnect Audio Input`
		});
		this.requestInProgress = false;
		return ok;
	}

	async requestDisconnectOutput(audio_connection){
		this.requestInProgress = true;
		const res = await commandInterface.AudioRoutingController.disconnectOutput(audio_connection);
		const ok = AppStatus.handleCommandResponse( res, {
			success : `Audio Output disconnected`,
			error : `Could not disconnect Audio Output`
		});
		this.requestInProgress = false;
		return ok;
	}

	async requestDisconnectOutput(audio_connection){
		this.requestInProgress = true;
		const res = await commandInterface.AudioRoutingController.disconnectOutput(audio_connection);
		const ok = AppStatus.handleCommandResponse( res, {
			success : `Audio Output disconnected`,
			error : `Could not disconnect Audio Output`
		});
		this.requestInProgress = false;
		return ok;
	}

	async requestDisconnectAllInputsFromTrack(track){
		this.requestInProgress = true;
		const res = await commandInterface.AudioRoutingController.disconnectAllInputsFromTrack(track);
		const ok = AppStatus.handleCommandResponse( res, {
			success : `Audio Inputs disconnected`,
			error : `Could not disconnect Audio Inputs`
		});
		this.requestInProgress = false;
		return ok;
	}

	async requestDisconnectAllOutputsFromTrack(track){
		this.requestInProgress = true;
		const res = await commandInterface.AudioRoutingController.disconnectAllOutputsFromTrack(track);
		const ok = AppStatus.handleCommandResponse( res, {
			success : `Audio Outputs disconnected`,
			error : `Could not disconnect Audio Outputs`
		});
		this.requestInProgress = false;
		return ok;
	}


}

export const sushiEditorApi = new SushiEditorApi();

Alpine.store('api', sushiEditorApi );

