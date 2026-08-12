const express = require("express");
const path = require ("node:path");


function createEngineController( application ) {
	
	const { projectManager, engine, web , Dispatcher } = application;
	
    const router = express.Router();

	router.get( "/api/snapshot" , (req, res) => {
		res.set({
			"Cache-Control": "no-store",
			"Pragma": "no-cache",   
			"Expires": "0"
		});
		res.json( engine );
	});

	Dispatcher.on("engine.snapshot", (engine) =>{
		web.wssNotifyToSubscribed( "engine.snapshot", engine );
	})

	Dispatcher.on("engine.state", (state)=> {
		web.wssNotifyToSubscribed( "engine.state", state ) 
	});
	
	Dispatcher.on("project.state", (state)=> {
		web.wssNotifyToSubscribed( "project.state", state ) 
	});
	
	Dispatcher.on("component.state", (state)=> {
		web.wssNotifyToSubscribed( "component.state", state ) 
	});
	

	
	return router;
}

module.exports = createEngineController;



