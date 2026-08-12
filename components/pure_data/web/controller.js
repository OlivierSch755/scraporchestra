const express = require("express");
const path = require ("node:path");
const {ComponentWebController} = require("web/component_controller_class");

const public_path = path.resolve( __dirname, "public" )
const editor_public_path = path.resolve( __dirname, "..", "editor", "public" )

class PureDataWebController extends ComponentWebController {
	
	initRouter(){

	
		// using this.instance without any error handling
		// is relatively safe because error middleware after 
		// us know how to deal with Component.geInstanceByName(...) errors.

		const { engine, web, Dispatcher } = this.application;
		const router = this.router;

		router.get( "/api/status" , (req, res) => {
			res.json( this.instance );
		});
		
		router.post( "/api/editor/start" , async (req, res) => {
			this.instance.open_editor();
			res.sendStatus( 200 );
		});
		
		router.post( "/api/editor/stop" , async (req, res) => {
			this.instance.close_editor();
			res.sendStatus( 200 );
		});
		
		
		router.post( "/api/save_config" , async (req, res) => {
			this.instance.config = req.body;
			res.sendStatus( 200 );
		});
		
		
		
		// Not used for now
		/*
		router.post( "/api/restart" , async (req, res) => {
			await this.instance.user_restart();
			res.sendStatus( 200 );
		});
		
		router.post( "/api/stop" , async (req, res) => {
			await this.instance.user_close();
			res.sendStatus( 200 );
		});
		
		router.post( "/api/start" , async (req, res) => {
			await this.instance.initialize();
			res.sendStatus( 200 );
		});
		
		
		router.get( "/editor/proto.json" , (req, res) => {
			res.json ( this.instance.editor_backend.proxy.proto_json )
		});
		*/
		
		
		
		
		router.use( "/editor", express.static( editor_public_path ) );
		
		router.use( express.static( public_path ) );
		
		Dispatcher.on("component.pd.editor", state =>{
			web.wssNotifyToSubscribed( "component.pd.editor", state ) 
		});
		
	}
	
}



module.exports = PureDataWebController;