import * as MidishHttp from '@/lib/midish.js';

import { useRef, useState, useEffect, memo } from "react";
import { useEngineStore }  from "@/services/engine";
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

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


export const MidishSeek = memo( ({className})=> {
	
	const titleRef = useRef(null);
	
	const measurePosition = useEngineStore(
		(state) => state.engine?.project?.components?.midish?.transport?.position?.position?.measure
	);

	const beatPosition = useEngineStore(
		(state) => state.engine?.project?.components?.midish?.transport?.position?.position?.beat
	);
	
	const [measure, setMeasure] = useState( measurePosition ?? 0 );
	const [open, setOpen] = useState(false);
	
	const safeSetMeasure = (val) => {
		setMeasure(prev => {
			const next = Number(
				typeof val === "function" ? val(prev) : val
			);

			if (next < 0 || !Number.isSafeInteger(next)) {
				return 0;
			}

			return next;
		});
	};
	
	async function onSubmit(e){
		e.preventDefault();
		const promise = MidishHttp.transport_seek(measure);
		toast.promise(promise, {
			loading:  `Updating transport position`,
			success:  `Transport position updated`,
			error: (err) => ({
				message: `Could update transport position`,
				description: err.message,
			}),
		});
		setOpen(false);
	}
	
	
	
	return (
		<>
			<Button className={className}
				onClick={ e => {
				setOpen(true)
				setMeasure(measurePosition);
			} }>
				{ `${measurePosition} : ${beatPosition}` }
			</Button>
					
			{/*Dialog*/}
			<Dialog 
				open={open}
				onOpenChange={setOpen}
			>
				<DialogContent className="sm:max-w-3xl"  initialFocus={titleRef}>
				
					<DialogHeader>
						<DialogTitle tabIndex={-1} ref={titleRef}>Transport seek</DialogTitle>
					</DialogHeader>
					
					<form onSubmit={onSubmit}>
						<Field>
							<FieldLabel htmlFor="Measure">Measure</FieldLabel>
							<div className="grid grid-cols-4 gap-2">
							
								<Input 
									value={measure}
									inputMode="numeric"
									min="0"
									step="1"
									onChange={ e => safeSetMeasure(e.target.value) } id="Measure" type="number"
									className="col-span-4"
								/>
								
								<Button type="button" onClick={e=>safeSetMeasure( v => v - 5 )}>-5</Button>
								<Button type="button" onClick={e=>safeSetMeasure( v => v - 1 )}>-1</Button>
								<Button type="button" onClick={e=>safeSetMeasure( v => v + 1 )}>+1</Button>
								<Button type="button" onClick={e=>safeSetMeasure( v => v + 5 )}>+5</Button>
								
							</div>
						</Field>
					</form>

					
					
				   <DialogFooter>
					  <Button onClick={onSubmit} className="w-full">Go</Button>
					</DialogFooter>
					
				</DialogContent>
			</Dialog>
		</>
	);
})

export const MidishTempoFactor = memo( ({transport, className}) => {
	
	const [open, setOpen] = useState(false);
	const [tempo, setTempo] = useState(transport.tempo_factor ?? 100);
	const titleRef = useRef(null);

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
		setOpen(false);
	}
	
	const safeSetTempoFactor = (val) =>{
		setTempo( prev => {
			
			const next = Number ( typeof val === "function" ? val(prev) : val );
			if( Number.isSafeInteger(next) === false ){
				return 100;
			}
			if( next < 50 ){
				return 50;
			}
			if( next > 200 ){
				return 200;
			}	
			return next;
		})
		

	}
	
	return (
		<>
			<Button className={className} onClick={ e => {
				setOpen(true)
				setTempo(transport.tempo_factor ?? 100);
			} }>
				{transport.tempo_factor}
				%
			</Button>
					
			{/*Dialog*/}
			<Dialog 
				open={open}
				onOpenChange={setOpen}
			>
				<DialogContent className="sm:max-w-3xl"  initialFocus={titleRef}>
				
					<DialogHeader>
						<DialogTitle tabIndex={-1} ref={titleRef}>Tempo factor</DialogTitle>
					</DialogHeader>
					
					<form onSubmit={onSubmit}>
						<Field>
							<FieldLabel htmlFor="Tempo_factor">%</FieldLabel>
							<div className="grid grid-cols-4 gap-2">
							
								<Input 
									value={tempo}
									inputMode="numeric"
									min="0"
									step="1"
									onChange={ e => safeSetTempoFactor(e.target.value) } id="Tempo_factor" type="number"
									className="col-span-4"
								/>
								
								<Button type="button" onClick={e=>safeSetTempoFactor( v => v - 5 )}>-5</Button>
								<Button type="button" onClick={e=>safeSetTempoFactor( v => v - 1 )}>-1</Button>
								
								<Button type="button" onClick={e=>safeSetTempoFactor( v => v + 1 )}>+1</Button>
								<Button type="button" onClick={e=>safeSetTempoFactor( v => v + 5 )}>+5</Button>
							</div>
						</Field>
					</form>

				   <DialogFooter>
					  <Button type="submit" disabled={ tempo === transport.tempo_factor } onClick={onSubmit}>Update</Button>
					</DialogFooter>
					
				</DialogContent>
			</Dialog>
		</>
	);
	

})
