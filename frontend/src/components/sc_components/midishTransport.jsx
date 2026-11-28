import { useRef, useState, useEffect, memo } from "react";
import { toast } from 'sonner';
import * as MidishHttp from '@/lib/midish.js';
import { useEngineStore }  from "@/services/engine";
import Modes from 'midish/playing_modes_json';

import { MidishSeek, MidishTempoFactor, MidishArmRecordingMode } from "@/components/sc_components/midishTransportDialogs";

import { ButtonGroup } from "@/components/ui/button-group"
import { Button } from "@/components/ui/button"

import { Play, Pause, Square as Stop, Circle as Record } from "lucide-react";


const MidishCurrentTempo = memo( ({className})=> {
	
	const measurePosition = useEngineStore(
		(state) => state.engine?.project?.components?.midish?.transport?.position?.position?.measure
	);
	
	const metaTrackEvents = useEngineStore(
		(state) => state.engine?.project?.components?.midish?.meta_track?.events
	);
	
	if(measurePosition === undefined || metaTrackEvents === undefined) return;
	
	// Here we figure out the current tempo and time signature at current measure position
	let current_state = null;
	let i = metaTrackEvents.length;

	while( i-- ){
		let event = metaTrackEvents[i];
		if( event.measure < measurePosition ){
			// if selected event is in the past, we only care about its final tempo state (the transition it represents happened before).
			current_state = {...event, startTempo : event.endTempo }; 
			break;
		}
		if( event.measure == measurePosition ){
			current_state = event;
			break;
		}
	}
	
	if(current_state === null) return;
	
	const { startTempo, endTempo, timeSignature } = current_state;
	
	// Format tempo string (in case there is a transition happening)
	let tempo_string;
	if( endTempo != startTempo  ){
		tempo_string = `${startTempo}..${endTempo}`;
	}
	else{
		tempo_string = startTempo;
	}
	
	return (
		<div className={className}>
			<div className="flex gap-2 h-full items-center">
				<div className="flex gap-1 p-1 border">
					<span>{timeSignature.beats}</span>
					<span>/</span>
					<span>{timeSignature.unit}</span>
				</div>
				<div className="border p-1">
					{tempo_string} <small>bpm</small>
				</div>
			</div>
		</div>
	);
})


function MidishTransportControls({className, transport}){
	
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

	return(
		<ButtonGroup className={className} >
		
	
			<MidishArmRecordingMode 
				variant={ transport.mode === Modes.RECORD && 'destructive'}
				disabled={ 
					/*  disable when playing or recording  */
					transport.mode === Modes.RECORD 
					|| transport.mode === Modes.PLAY 
				}
			/>
			
			<Button
				aria-label="Play"
				onClick={onPlay}
				disabled={ 
					/*  disable when playing or recording  */
					transport.mode === Modes.RECORD 
					|| transport.mode === Modes.PLAY 
				}
			> <Play/> </Button>
			
			
			
			
			<Button
				aria-label="Pause"
				onClick={onIdle}
				disabled={ 
					/*  disable when already idle  */
					transport.mode === Modes.IDLE 
				}
			><Pause/></Button>
			
			<Button
				aria-label="Stop"
				onClick={onStop}
				disabled={ 
					/*  disable when stopped  */
					transport.mode === Modes.STOP 
				}
			><Stop/></Button>
			
		</ButtonGroup>
	)
}

export function MidishTransport(){
	
    const transport = useEngineStore(
        (state) => state.engine?.project?.components?.midish?.transport
    );

	if(!transport) return null;

	return(
		<div className="grid grid-col gap-2">
		
			<div className="
				grid 
				md:flex
				gap-2 
				items-center
			">
			
				<div className="flex gap-2 justify-between md:justify-start">
					<MidishSeek className="w-20 grow" />
					<MidishTransportControls className="shrink-0" transport={transport} />
				</div>
				
				<div className="flex gap-2">
					<MidishCurrentTempo className="self-stretch" />
					<MidishTempoFactor className="grow" transport={transport}/>
				</div>
				
			</div> 

			
		</div>
	);
}
