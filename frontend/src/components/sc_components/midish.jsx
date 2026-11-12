
import { memo, useState, useEffect } from 'react';
import { useMediaQuery } from 'react-responsive'

import { useEngineStore }  from "@/services/engine";
import Modes from 'midish/playing_modes_json';

import * as MidishHttp from '@/lib/midish.js';
import * as Project from '@/lib/project.js';

import { toast } from 'sonner';
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Input } from "@/components/ui/input";

import { MidishSeek } from "@/components/sc_components/midishSeek";

function MidishTempoFactor({transport}){
	
	const [tempo, setTempo] = useState(transport.tempo_factor);
	
	useEffect(() => {
		setTempo(transport.tempo_factor);
	}, [transport.rev]);

	
	const onSubmit = (e)=>{
		e.preventDefault();
		const promise = MidishHttp.tempo_set_factor(tempo);
		toast.promise(promise, {
			loading:  `Updating tempo %`,
			success:  `Tempo % updated`,
			error: (err) => ({
				message: `Could not update tempo %`,
				description: err.message,
			}),
		});
	}
	
	return(
		<form onSubmit={onSubmit} className="grid grid-cols-[auto_2fr_auto] items-center gap-2">
			<strong>Tempo<i>(%)</i></strong>
			<Input onChange={ e=> setTempo(e.target.value)} type="number" min="50" max="200" value={tempo} />
			<Button type="submit">Update</Button>
		</form>
	)
}

function MidishTransport(){
	
    const transport = useEngineStore(
        (state) => state.engine?.project?.components?.midish?.transport
    );

	if(!transport) return null;

	const onPlay = ()=>{
		const promise = MidishHttp.transport_play();
		toast.promise(promise, {
			loading:  `Starting transport...`,
			success:  `Transport started`,
			error: (err) => ({
				message: `Could not start transport`,
				description: err.message,
			}),
		});
	}

	const onIdle = ()=>{
		const promise = MidishHttp.transport_idle();
		toast.promise(promise, {
			loading:  `Pausing transport...`,
			success:  `Transport paused`,
			error: (err) => ({
				message: `Could not pause transport`,
				description: err.message,
			}),
		});
	}
	const onStop = ()=>{
		const promise = MidishHttp.transport_stop();
		toast.promise(promise, {
			loading:  `Stopping transport...`,
			success:  `Transport stopped`,
			error: (err) => ({
				message: `Could not stop transport`,
				description: err.message,
			}),
		});
	}

	const onRecord = ()=>{
		const promise = MidishHttp.transport_record();
		toast.promise(promise, {
			loading:  `Starting record...`,
			success:  `Recording started`,
			error: (err) => ({
				message: `Could not start recording`,
				description: err.message,
			}),
		});
	}
	


	return(
		<div>
			<div className="grid grid-cols-[1fr_2fr] gap-2 items-center p-2 border">
			
				<MidishSeek/>

				<ButtonGroup className="justify-self-end" >
				
					<Button
						variant={ transport.mode === Modes.RECORD ? 'destructive' : 'outline' }
						onClick={onRecord}
						disabled={ 
							/*  disable when playing or recording  */
							transport.mode === Modes.RECORD 
							|| transport.mode === Modes.PLAY 
						}
					>Record</Button>
					
					<Button
						onClick={onPlay}
						disabled={ 
							/*  disable when playing or recording  */
							transport.mode === Modes.RECORD 
							|| transport.mode === Modes.PLAY 
						}
					>Play</Button>
					
					<Button
						onClick={onIdle}
						disabled={ 
							/*  disable when already idle  */
							transport.mode === Modes.IDLE 
						}
					>Pause</Button>
					
					<Button
						onClick={onStop}
						disabled={ 
							/*  disable when stopped  */
							transport.mode === Modes.STOP 
						}
					>Stop</Button>
					
					
				</ButtonGroup>
				
			</div> 
			
			<MidishTempoFactor transport={transport}/>
			
		</div>
	);
}

function MidishTrack({track}){
	
	const muted = track.flags.includes("mute");
	
	function onTrackMuteToggle(){
		const promise = MidishHttp.toggleTrackMute(track.name, !muted );
		toast.promise(promise, {
			loading:  `${muted ? "Un-m" : "M"}uting track ${track.name}...`,
			success:  `Track ${track.name} ${ muted ? "un-muted" : "muted" }`,
			error: (err) => ({
				message: `Could not ${ muted ? "un-mute" : "mute" } track ${track.name}`,
				description: err.message,
			}),
		});
	}
	
	return(
		<div className="grid grid-cols-[3fr_5em] gap-2 items-center p-2 border">
			<span>{track.name}</span>
			<Button onClick={onTrackMuteToggle}>{muted?"un-mute":"mute"}</Button>
		</div> 
	);
	
}

function MidishSession(){
	
    const session = useEngineStore(
        (state) => state.engine?.project?.components?.midish?.session
    );
	
	if(!session) return null;
	
	const onImportMidiFile = e =>{
		e.preventDefault();
		const formData = new FormData(e.target);
		const promise = MidishHttp.session_import_midi(formData);
		toast.promise(promise, {
			loading:  `Importing MIDI file...`,
			success:  `MIDI file imported`,
			error: (err) => ({
				message: `Could not import MIDI file`,
				description: err.message,
			}),
		});
	}
	
	
	return (

		<div className="flex flex-col gap-4">
			<div>
				<strong>Tracks</strong>
				<div className="flex flex-col gap-2">
					{ 
						session.tracks.map( (track)=> <MidishTrack key={track.name} track={track} />	)
					}
					<Button>Add Track</Button>
				</div>
			</div>
			
			<hr/>
			
			<form onSubmit={onImportMidiFile}>
				<strong>Import a MIDI file </strong><small>(will overwrite session)</small>
				<div className="flex flex-col gap-2">
					<Input 
						required
						accept=".mid,.midi,audio/midi,audio/x-midi"
						name="midi_file"
						type="file"
						className="min-h-[5lh]"
					/>
					<Button type="submit">Import</Button>
				</div>
			</form>
			
		</div>
		
	);
	
}


export const  MidishWidget = memo( ()=> {
	
    const component = useEngineStore(
        (state) => state.engine?.project?.components?.midish
    );
	
    const config = useEngineStore(
        (state) => state.engine?.project?.config?.components?.midish
    );
	

	
	return (
		<div className="grid gap-2">
			<MidishTransport />
			<MidishSession />
		</div>
	);
});