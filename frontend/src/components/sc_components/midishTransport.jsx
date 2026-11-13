import { toast } from 'sonner';
import * as MidishHttp from '@/lib/midish.js';
import { useEngineStore }  from "@/services/engine";
import Modes from 'midish/playing_modes_json';

import { MidishSeek, MidishTempoFactor } from "@/components/sc_components/midishTransportDialogs";

import { ButtonGroup } from "@/components/ui/button-group"
import { Button } from "@/components/ui/button"

import { Play, Pause, Square as Stop, Circle as Record } from "lucide-react";



export function MidishTransport(){
	
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
		<div className="grid grid-col gap-2">
		
			<div className="grid grid-cols-[1fr_2fr] gap-2 items-center">
			
				<MidishSeek/>

				<ButtonGroup className="justify-self-end" >
				
					<Button
						aria-label="Record"
						variant={ transport.mode === Modes.RECORD ? 'destructive' : 'outline' }
						onClick={onRecord}
						disabled={ 
							/*  disable when playing or recording  */
							transport.mode === Modes.RECORD 
							|| transport.mode === Modes.PLAY 
						}
					><Record/></Button>
					
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
				
			</div> 
			
			<MidishTempoFactor transport={transport}/>
			
		</div>
	);
}
