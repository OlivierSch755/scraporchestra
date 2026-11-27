import * as MidishHttp from '@/lib/midish.js';

import { useState, useEffect, memo } from "react";
import { useEngineStore }  from "@/services/engine";
import { toast } from 'sonner';

import { ScModal } from "@/components/ui/dialog"

import { LetterM, Settings, Save, Trash } from "lucide-react";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"


import {Input} from  "@/components/ui/input"
import {Button} from  "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"

export function MidishTrack({track}){
	
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
		<div className="grid grid-cols-[3fr_auto_auto] gap-2 items-center p-2 border">
			<span>{track.name}</span>
			<MidishTrackEdition track={track} />
			<Button 
				aria-label={
					`${muted?"Un-m":"M"}ute track ${track.nam}` 
				}
				title={`${muted?"Un-m":"M"}ute`}
				onClick={onTrackMuteToggle}
				variant={muted ? "selected" : "outline"}
			>
				<LetterM />
			</Button>
		</div> 
	);
}


const MidishTrackNameInput = memo( ({className, defaultValue, placeholder, onChange, id, value})=> {
	return 	(
		<Input 
			className={className}
			defaultValue={defaultValue}
			placeholder={placeholder}
			id={id}
			type="text"
			value={value}
			onChange={ e=> onChange(e.target.value) }
			onInvalid={ e => e.target.setCustomValidity(
				"Use only letters, numbers, dashes and underscores.\n31 characters max."
			)}
			required
			pattern="[A-Za-z0-9_\-]+"
			maxLength="31"
		/>
	);
})

const MidishTrackEdition = memo( ({className, track})=> {
	
	const [open, setOpen] = useState(false);
	const [trackName, setTrackName] = useState(track.name);

	async function onRename(e){
		e.preventDefault();
		const promise = MidishHttp.rename_track( track.name, trackName );
		toast.promise(promise, {
			loading:  `Renaming track`,
			success:  `Track renamed`,
			error: (err) => ({
				message: `Could not rename track`,
				description: err.message,
			}),
		});
	}
	
	async function onDelete(e){
		e.preventDefault();
		const promise = MidishHttp.delete_track( track.name );
		toast.promise(promise, {
			loading:  `Deleting track`,
			success:  `Track deleted`,
			error: (err) => ({
				message: `Could not delete track`,
				description: err.message,
			}),
		});
	}
	
	return (
		<>
			<Button className={className} 
				title="Configure"
				aria-label={`Configure track ${track.name}`}
				onClick={ e => setOpen(true) }>
				<Settings />
			</Button>

			<ScModal 
				open={open}
				setOpen={setOpen}
				header= <>Track <i>{track.name}</i></>
			>
				<div className="grid gap-2">
					<form onSubmit={onRename}>
						<div className="flex gap-2">
							<FieldLabel htmlFor="midish_track_rename">Name</FieldLabel>
							<div className="grow">
								<MidishTrackNameInput 
									onChange={ setTrackName } 
									value={trackName}
									placeholder={track.name}
									id="midish_track_rename"
								/>
							</div>
							<Button type="submit" disabled={trackName === track.name} aria-label={`Submit renaming track ${track.name} into ${trackName}`}>
								<Save />
							</Button>
						</div>
					</form>
					
					<form onSubmit={onDelete}>
						<div className="flex gap-2 items-center justify-between">
							<span>Delete track <i>{track.name}</i></span>
							<Button type="submit" title="Delete track" variant="destructive" aria-label={`Delete track ${track.name}`}>
								<Trash/>
							</Button>
						</div>
					</form>
				</div>
				
				
			</ScModal>
		</>
	);
})

export const MidishTrackCreation = memo( ({className})=> {
	
	const [open, setOpen] = useState(false);
	const [trackName, setTrackName] = useState("");
	
	async function onSubmit(e){
		e.preventDefault();
		const promise = MidishHttp.create_track(trackName);
		toast.promise(promise, {
			loading:  `Creating track`,
			success:  `Track created`,
			error: (err) => ({
				message: `Could not create track`,
				description: err.message,
			}),
		});
		setOpen(false);
	}
	
	return (
		<>
			<Button className={className}
				onClick={ e => setOpen(true) }>
				New track
			</Button>
				
			<ScModal 
				open={open}
				setOpen={setOpen}
				header="Create a MIDI track"
				footer= <Button onClick={onSubmit} className="w-full">Create</Button>
			>
			
				<form onSubmit={onSubmit}>
					<div className="flex gap-2">
						<FieldLabel htmlFor="midish_new_track_name">Name</FieldLabel>
						<div className="grow">
							<MidishTrackNameInput 
								value={trackName}
								onChange={ setTrackName } 
								placeholder="track name"
								id="midish_new_track_name"
							/>
						</div>
					</div>
				</form>
			
			</ScModal>
		</>
	);
})



