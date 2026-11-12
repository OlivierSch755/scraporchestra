import * as MidishHttp from '@/lib/midish.js';


import { useState } from "react";
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



export function MidishSeek(){
	
    const {position} = useEngineStore(
        (state) => state.engine?.project?.components?.midish?.transport?.position
    );
	
	console.log(position)
	
	const [measure, setMeasure] = useState( position?.measure ?? 0 );
	const [open, setOpen] = useState(false);
	
	const safeSetMeasure = (val) =>{
		val = Number(val);
		if( val < 0 || Number.isSafeInteger(val) === false ){
			setMeasure(0);
			return;
		}
		setMeasure(val);
	}
	
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
			<Button onClick={ e => {
				setOpen(true)
				setMeasure(position.measure);
			} }>
				{ `${position.measure} : ${position.beat}` }
			</Button>
					
			{/*Dialog*/}
			<Dialog 
				open={open}
				onOpenChange={setOpen}
			>
				<DialogContent className="sm:max-w-3xl">
				
					<DialogHeader>
						<DialogTitle>Transport seek</DialogTitle>
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
									name="measure"
									className="col-span-4"
								/>
								
								<Button type="button" onClick={e=>safeSetMeasure(measure-5)}>-5</Button>
								<Button type="button" onClick={e=>safeSetMeasure(measure-1)}>-1</Button>
								
								<Button type="button" onClick={e=>safeSetMeasure(measure+1)}>+1</Button>
								<Button type="button" onClick={e=>safeSetMeasure(measure+5)}>+5</Button>
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
}