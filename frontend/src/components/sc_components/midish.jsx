
import { memo, useState, useEffect } from 'react';
// import { useMediaQuery } from 'react-responsive'

import { useEngineStore }  from "@/services/engine";

import * as MidishHttp from '@/lib/midish.js';
import * as Project from '@/lib/project.js';

import { toast } from 'sonner';
import { Button } from "@/components/ui/button"
// import { ButtonGroup } from "@/components/ui/button-group"
import { Input } from "@/components/ui/input";

import { MidishTransport } from "@/components/sc_components/midishTransport";
import { MidishTrack, MidishTrackCreation } from "@/components/sc_components/midishTracks";


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
					<MidishTrackCreation />
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