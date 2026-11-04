import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"

import {
  Input
} from "@/components/ui/input"

import { Button } from "@/components/ui/button"



async function updateSushiConfig(config) {
	
	console.log(config)
	
	const response = await fetch(
		'/components/sushi/api/save_config',
		{ 
			method:'POST',
			headers: {"Content-Type": "application/json"},
			body: JSON.stringify( config ) 
		}
	);		
	if (!response.ok) {
		throw new Error(
			await response.text() || 'Could not update config'
		);
	}
};

export function SushiConfigurator({config}){
	
	if(!config) return null;
	
	const [open, setOpen] = useState(false);
	const [oscIp, setOscIp] = useState(config.osc_ip ?? "");

	const [envRows, setEnvRows] = useState(() =>
		Object.entries(config.env ?? {}).map(([key, value], index) => ({
			id: index,
			key,
			value
		}))
	);

	const [nextId, setNextId] = useState(envRows.length);

	function updateEnvRow(id, field, value) {
		setEnvRows(rows =>
			rows.map( 
				row => row.id === id ?	{...row,[field]: value} : row
			)
		);
	}

	function addEnvRow() {
		setEnvRows(rows => [...rows,
			{
				id: nextId,
				key: "",
				value: ""
			}
		]);
		setNextId(id => id + 1);
	}

	function removeEnvRow(id) {
		setEnvRows(rows => rows.filter(row => row.id !== id));
	}

	function onSubmit(e) {
		e.preventDefault();

		const env = Object.fromEntries(
			envRows
			.filter(row => row.key.trim() !== "")
			.map(row => [row.key.trim(), row.value])
		);

		const promise = updateSushiConfig({
			...config,
			osc_ip: oscIp,
			env
		});
		
		toast.promise(promise, {
			loading: `Updating Sushi configuration...`,
			success: `Sushi configuration updated.`,
			error: (err) => ({
				message: `Could update Sushi configuration`,
				description: err.message,
			}),
		});
		
		promise.then( r=> setOpen(false) );
	
	}
	
	const drivers = ['--raspa', '--jack','--portaudio' ];

	return (    
		<>
			{/*Button to open dialog*/}
			<Button className="w-full" onClick={()=>setOpen(true)}>Edit config</Button>
			
			{/*Dialog*/}
			<Dialog open={open} onOpenChange={setOpen} >
				<DialogContent className="sm:max-w-3xl">
				
					<DialogHeader>
						<DialogTitle>Sushi configuration</DialogTitle>
					</DialogHeader>
					
					<DialogDescription>
						Parameters below let you edit how ScrapOrchestra will launch Sushi. 
						Changing anything will require restarting Sushi to take effect.
						This is most commonly done by reopening the project.
					</DialogDescription>
					
					
					{/*
						Form inside dialog
						It would be nice to split this in separate react components.
					*/}
					<form className="flex flex-col gap-6" onSubmit={onSubmit} >

						{/*Edit env variables*/}
						<FieldSet className="w-full max-w-none gap-4">
						
							<FieldLegend>Environment variables</FieldLegend>
							
							<FieldDescription>
								Edit ENV to help Sushi locate plugins or to pass default values to plugins that support it. 
							</FieldDescription>
							
							<div className="grid grid-cols-[1fr_3fr_auto] gap-2 items-end">
								<FieldLabel id="sushi-env-key-label">Key</FieldLabel>
								<FieldLabel id="sushi-env-val-label">Value</FieldLabel>
								<span />
							</div>
							
							{envRows.map( row => (
								<div key={row.id} className="grid grid-cols-[1fr_3fr_auto] gap-2 items-end">
								
									<Field>
										<Input 
											aria-labelledby="sushi-env-key-label"
											type="text" 
											placeholder="Value" 
											value={row.key} 
											onChange={e => updateEnvRow(row.id, "key", e.target.value) }
										/>	
									</Field>
									<Field>
										<Input 
										    aria-labelledby="sushi-env-val-label"
											type="text" 
											placeholder="Value" 
											value={row.value} 
											onChange={e => updateEnvRow(row.id, "value", e.target.value) }
										/>
									</Field>
									
									<Button
										type="button"
										variant="destructive"
										size="icon"
										onClick={() => removeEnvRow(row.id)}
									>
										X
									</Button>

								</div>
							))}
							
							<Button type="button" onClick={addEnvRow}>Add ENV entry</Button>
							
						</FieldSet>
						
						{/*Edit Audio driver*/}
						<FieldSet className="w-full max-w-none gap-4">
						
							<FieldLegend>Audio Driver</FieldLegend>
							
							<FieldDescription>
								Which audio driver should be requested when spawning Sushi. 
								RASPA offers real-time performance with supported audio HATs. 
								Jack or portaudio can be usefull to work with a USB soundcard and external softwares (but this will increase latency).
							</FieldDescription>

							<Field>
								<Combobox items={drivers}>
									<ComboboxInput placeholder="Select a driver" />
									<ComboboxContent>
										<ComboboxList>
											{(item) => (
												<ComboboxItem key={item} value={item}>
													{item}
												</ComboboxItem>
										)}
										</ComboboxList>
									</ComboboxContent>
								</Combobox>
							</Field>
						</FieldSet>
						
						<footer className="border-t pt-4">
							<Button type="submit" className="w-full">Update Sushi configuration</Button>
						</footer>
					</form>
				
				</DialogContent>
			</Dialog>
		
		</>
	);
}
