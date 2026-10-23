const express = require("express");
const path = require ("node:path");

const { addComponentsToProject } = require("engine/component/utils");

function createProjectsController( application ) {
	
	const { projectManager, engine, Dispatcher, web } = application;
	
    const router = express.Router();

	router.get("/", (req, res) => {
		res.sendFile(path.join(__dirname, "../public/projects.html"));
	});

	router.post("/api/create/:project_name", async ( req, res ) => {
		await projectManager.createProject( req.params.project_name, req.body );
		res.sendStatus(200);
	});

	router.post("/api/delete/:project_name", async ( req, res ) => {
		await projectManager.deleteProject( req.params.project_name );
		res.sendStatus(200);
	});

	router.post("/api/duplicate/:project_name", async ( req, res ) => {
		await projectManager.duplicateProject( req.params.project_name );
		res.sendStatus(200);
	});

	router.post("/api/rename/:project_name/:new_name", async ( req, res ) => {
		await projectManager.renameProject( req.params.project_name, req.params.new_name );
		res.sendStatus(200);
	});

	Dispatcher.on("project.new", (project_config)=> {
		web.wssNotifyToSubscribed( "project.new", project_config ) 
	});

	router.post("/api/autostart/set/:project_name",  async ( req, res ) => {
		const project_name = req.params.project_name;
		await application.setProjectAutoStart( project_name );
		res.sendStatus(200);
	});
	router.post("/api/autostart/clear",  async ( req, res ) => {
		await application.setProjectAutoStart( null );
		res.sendStatus(200);
	});
	
	router.get("/api/autostart", (req, res) => {
		res.json(application.config.auto_start_project);
	});

	router.post("/api/add_components",  async ( req, res ) => {
		const components_to_add = req.body;
		await engine.safeAddComponentsToProject(components_to_add );
		res.sendStatus(200);
	});

	router.post("/api/delete_component/:component_name",  async ( req, res ) => {
		const {component_name} = req.params;
		await engine.safeRemoveComponentFromProject(component_name );
		res.sendStatus(200);
	});

	router.post("/api/open/:project_name", async ( req, res ) => {
		const project_path = projectManager.getProjectPath( req.params.project_name );
		await engine.open_project(project_path);
		res.sendStatus(200);
	});
	
	router.get("/api/get/project/:project_name", async ( req, res ) => {
		const project = projectManager.getProject( req.params.project_name )
		res.json(project);
	});
	
	router.post("/api/save", async ( req, res ) => {
		const project = engine.project;
		await projectManager.saveProjectSession( project );
		res.sendStatus(200);
	});
	
	router.get("/api/get/config", async ( req, res ) => {
		res.json(engine.project?.config);
	});
	
	router.post("/api/close", async ( req, res ) => {
		await engine.close_project();
		res.sendStatus(200);
	});

	router.get( "/api/list" , (req, res) => {
		res.json( projectManager.projects );
	});

	return router;
}

module.exports = createProjectsController;
