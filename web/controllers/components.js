
const express = require("express");
const path = require ("node:path");
const { getAllComponents, getEngineLoadedComponent } = require("engine/component/utils");


/*
Components class definition can set their has_web_controller static property 
this signals that they can provide routing for interacting over the webapp
we load their middleware and route that into our server
*/

async function createComponentsController( application ) {
	
	const { projectManager, engine } = application;
	

    const router = express.Router();

	router.get("/", (req, res) => {
		res.sendFile(path.join(__dirname, "../public/components.html"));
	});
	
	
	
	router.get("/list.json", (req, res) => {
		res.json( application.components );
	});
	
	
	
	// each component can have its own web controller interface
	// that we register dynamically here 
	
	Object.entries( application.components ).forEach( ( [ component_name, component ] )=>{
		
		if( component.has_web_controller !== true ) return;
		
		const component_web_controller = require(`components/${component_name}/web/controller`);
	
		// this returns an express middleware provided by the component
		const component_controller = new component_web_controller( application, component_name );
		
		router.use(`/${component_name}`, component_controller.router );
		
	});
	
	
	return router;
}




module.exports = createComponentsController;
