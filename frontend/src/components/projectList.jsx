import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import * as Project from '../services/project.js';

import { Button } from "@/components/ui/button"
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/button-group"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"

import {
  Input ,
} from "@/components/ui/input"


function ProjectRenameForm({project_name, onSubmit, disabled}){
	
	const [newName, setNewName] = useState(project_name);
		
	async function submit(e) {
		e.preventDefault();
		onSubmit(newName);
	}
	
	return (
		<form onSubmit={submit}>
			<Input
				autoFocus
				value={newName}
				onChange={e => setNewName(e.target.value)}
				placeholder="Project name"
			/>

			<div className="flex justify-end gap-2 mt-4">
				<Button type="submit" disabled={!newName.trim() || disabled} >
					Confirm
				</Button>
			</div>
		</form>
	)
}

function NewProjectModalBtnDialog({onReload}){
	
	const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
	
	function onSubmitCreate(new_project_name) {
		const promise = Project.create(new_project_name);
		toast.promise(promise, {
			loading: `Creating project ${new_project_name}...`,
			success: `Project ${new_project_name} created`,
			error: (err) => ({
				message: `Could not create project ${new_project_name}`,
				description: err.message,
			}),
		});
		promise.then(()=>setNewProjectModalOpen(false)).finally(onReload);
	}
	
	return (
		<>
			<Button variant="outline" onClick={()=>setNewProjectModalOpen(true)}>New project</Button>
			<Dialog open={newProjectModalOpen} onOpenChange={setNewProjectModalOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Creating a new project</DialogTitle>
					</DialogHeader>
					<ProjectRenameForm project_name="" onSubmit={onSubmitCreate} disabled={false} />
				</DialogContent>
			</Dialog>
		</>
	)
}

function SelectProjectAutoStartBtnDialog({projects,onReload}){
	
	const [projectAutostartModalOpen, setProjectAutostartModalOpen] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState(null);
	const [currentAutostart, setCurrentAutostart] = useState(null);
	
	async function loadAutoStartData( abortController = {signal : null} ){
		
		try {
			setIsLoading(true);
			setError(null);
			const data = await Project.getAutostart({
				signal: abortController?.signal
			});
			setCurrentAutostart(data);
		} catch (err) {
			if (err.name === 'AbortError') return;
			setError(err.message);
		} finally {
			if (!abortController?.signal?.aborted) {
				setIsLoading(false);
			}
		}
	}
	
	// Fetch current autostarting project
	useEffect(() => {
		if(!projectAutostartModalOpen) return;
		const abortController = new AbortController();
		loadAutoStartData(abortController);
		return () => {
			abortController.abort();
		};
	}, [projectAutostartModalOpen]);
	
	function onSubmit(e) {
		e.preventDefault();
		const project_name = currentAutostart;
		const promise = Project.setAutostart(project_name);
		toast.promise(promise, {
			loading: `Setting project ${project_name} as Autostart...`,
			success: `${project_name} will now start with application`,
			error: (err) => ({
				message: `Could set project ${project_name}  as Autostart`,
				description: err.message,
			}),
		});
		promise.then(onReload);
	}
	
	
	if(error){
		return(<div>Error, could not load autostart</div>)
	}
	
	
	return (
		<>
			<Button variant="outline" onClick={()=>setProjectAutostartModalOpen(true)}>Autostart</Button>
			<Dialog open={projectAutostartModalOpen} onOpenChange={setProjectAutostartModalOpen}>
				{isLoading && (
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Loading...</DialogTitle>
						</DialogHeader>
					</DialogContent>
				)}
				
				{!isLoading && (
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Select a project to start with application</DialogTitle>
						</DialogHeader>
						
						<form onSubmit={onSubmit}>
							<Combobox 
								items={projects} 
								value={currentAutostart}
								onValueChange={setCurrentAutostart}
							>
							  <ComboboxInput placeholder="Select a project" />
							  <ComboboxContent>
								<ComboboxEmpty>No items found.</ComboboxEmpty>
								<ComboboxList>
								  {(item) => (
									<ComboboxItem key={item} value={item}>
									  {item}
									</ComboboxItem>
								  )}
								</ComboboxList>
							  </ComboboxContent>
							</Combobox>
							
							<div className="flex justify-end gap-2 mt-4">
								<Button type="submit" disabled={!currentAutostart || !currentAutostart?.trim()} >
									Confirm
								</Button>
							</div>
							
							
						</form>
						<div className="flex justify-end gap-2 mt-4">
							<Button
								type="button"
								variant="outline"
								onClick={()=>setProjectAutostartModalOpen(false)}
							>
								Cancel
							</Button>	
						</div>
						
					</DialogContent>
				)}
			
					
				</Dialog>
				
		</>
	)
}





function ProjectActionsDialog({project_name, open, setOpen, onReload }){
	
	const [busy, setBusy] = useState(false);
	const [currentView, setCurrentView] = useState("actions");
	const [newName, setNewName] = useState(project_name);
	
	useEffect( ()=>{  setCurrentView("actions")}, [open] )
	
	
	function handleDuplicate() {
		setBusy(true);
		const promise = Project.duplicate(project_name);
		toast.promise(promise, {
			loading: `Duplicating project ${project_name}...`,
			success: `Project ${project_name} duplicated`,
			error: (err) => ({
				message: `Could not duplicate project ${project_name}`,
				description: err.message,
			}),
		});
		promise.then(onReload).finally(()=>setBusy(false))
	}
	
	function handleDelete() {
		setBusy(true);
		const promise = Project.remove(project_name);
		toast.promise(promise, {
			loading: `Deleting project ${project_name}...`,
			success: `Project ${project_name} deleted`,
			error: (err) => ({
				message: `Could not delete project ${project_name}`,
				description: err.message,
			}),
		});
		promise.then(onReload).finally(()=>setBusy(false))
	}
	
	function onSubmitRename(newName){
		setBusy(true);
		const promise = Project.rename(project_name, newName);
			toast.promise(promise, {
				loading: `Renaming project ${project_name}...`,
				success: `Project ${project_name} renamed`,
				error: (err) => ({
					message: `Could not rename project ${project_name} to ${newName}`,
					description: err.message,
				}),
			});
			promise.then(onReload).finally(()=>{setBusy(false)})
			setCurrentView("actions");
	}
		
	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent>
			
			{currentView === "actions" && (
				<>
					<DialogHeader>
						<DialogTitle>Project Actions</DialogTitle>
						<DialogDescription>
							{project_name}
						</DialogDescription>
					</DialogHeader>

					<Button
						type="button"
						variant="outline"
						onClick={() => setCurrentView("rename")}
					>Rename</Button>
					
					<Button
						disabled={busy}
						type="button"
						variant="outline"
						onClick={handleDuplicate}
					>Duplicate</Button>
					
					<Button
						type="button"
						variant="outline"
						onClick={() => setCurrentView("confirm_delete")}
					>Delete</Button>
					
				</>
			)}
				
			{currentView === "rename" && (
				<>
					<DialogHeader>
						<DialogTitle>Renaming project</DialogTitle>
						<DialogDescription>
							{project_name}
						</DialogDescription>
					</DialogHeader>

					<ProjectRenameForm project_name={project_name} onSubmit={onSubmitRename} disabled={busy} />
				</>
			)}
			
			{currentView === "confirm_delete" && (
				<>
					<DialogHeader>
						<DialogTitle>Confirm deletion of project {project_name}</DialogTitle>
						<DialogDescription>This action is irreversible and unsaved data will be lost.</DialogDescription>
					</DialogHeader>
					
					<Button
						disabled={busy}
						type="button"
						variant="outline"
						onClick={handleDelete}
					>Yes delete project {project_name}</Button>

				</>
			)}
				
				<div className="flex justify-end gap-2 mt-4">
					<Button
						type="button"
						variant="outline"
						onClick={() => {
							if(currentView === "actions") setOpen(false);
							else setCurrentView("actions");
						}}
					>
						Back
					</Button>	
				</div>
				
				
			</DialogContent>
		</Dialog>
	);
}

function ProjectListItem({project_name, onReload}){
	
	const [renameDialogOpen, setRenameDialogOpen] = useState(false);
	const [projectActionsDialogOpen, setProjectActionsDialogOpen] = useState(false);
	
	function handleLoad() {
		const promise = Project.open(project_name);
		toast.promise(promise, {
			loading: `Loading project ${project_name}...`,
			success: `Project ${project_name} loaded`,
			error: (err) => ({
				message: `Could not load project ${project_name}`,
				description: err.message,
			}),
		});
	}
	
	return (
		<>
			<Item variant="outline">
				<ItemContent>
					<ItemTitle>{project_name}</ItemTitle>
				</ItemContent>
				<ItemActions>
					<Button variant="outline" onClick={handleLoad}>Load</Button>
					<Button variant="outline" onClick={()=>setProjectActionsDialogOpen(true)}>More</Button>
				</ItemActions>
			</Item>
			<ProjectActionsDialog project_name={project_name} open={projectActionsDialogOpen} setOpen={setProjectActionsDialogOpen} onReload={onReload} />
		</>
	);
}

export function ProjectList(){
	
	const [projects, setProjects] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState(null);

	async function loadProjects( abortController = {signal : null} ){
		try {
			setIsLoading(true);
			setError(null);
			const data = await Project.fetchProjectList({
				signal: abortController?.signal
			});
			setProjects(data);
			
		} catch (err) {
			if (err.name === 'AbortError') return;
			setError(err.message);
		} finally {
			if (!abortController?.signal?.aborted) {
				setIsLoading(false);
			}
		}
	}
	
	// Fetch list of existing projects
	useEffect(() => {
		const abortController = new AbortController();
		loadProjects(abortController);
		return () => {
			abortController.abort();
		};
	}, []);
	
	let content;
	
	if(error){
		content = <div>Error:<br/><p>{error}</p></div>;
	}
	else {
		content = projects.map( 
			project_name => < ProjectListItem 
				project_name={project_name} 
				onReload={loadProjects}
				key={project_name} 
			/>
		);
	}
	
	return (
		<section className="flex flex-col gap-6">
			<header>
				<h2 className="text-2xl font-bold">Projects</h2>
			</header>
			
			{isLoading && (<div>Loading...</div>) }
			
			<ItemGroup className="flex w-full max-w-md flex-col gap-6">
				{content}
			</ItemGroup>
			
			<footer>
				<ButtonGroup>
					<NewProjectModalBtnDialog onReload={loadProjects} />
					<SelectProjectAutoStartBtnDialog projects={projects} onReload={loadProjects} />
				</ButtonGroup>
			</footer>
		</section>
	);
	
}
