const express = require("express");
const path = require ("node:path");
const {ComponentWebController} = require("web/component_controller_class");

const public_path = path.resolve( __dirname, "public" )
const editor_public_path = path.resolve( __dirname, "..", "editor", "public" )

class MidiConnectionsWebController extends ComponentWebController {
	
	initRouter(){

		const { engine, web, Dispatcher } = this.application;
		const router = this.router;

		router.get( "/api/status" , (req, res) => {
			res.json( this.instance );
		});
		
		router.get( "/api/graph" , (req, res) => {
			res.json( this.instance.getGraphAndRules() );
		});
		
		router.post( "/api/disconnect/:sender/:receiver" , async (req, res) => {
			await this.instance.deleteRuleFromAddresses(req.params.sender, req.params.receiver);
			res.sendStatus( 200 );
		});
		
		router.post( "/api/connect/:sender/:receiver/:optional" , async (req, res) => {
			await this.instance.addRuleFromAddresses( req.params.sender, req.params.receiver, req.params.optional === "1" );
			res.sendStatus( 200 );
		});
		
		router.post( "/api/delete_rule/:id" , async (req, res) => {
			await this.instance.deleteRuleFromId(req.params.id);
			res.sendStatus( 200 );
		});
		
		router.use( express.static( public_path ) );
		
		Dispatcher.on("component.midi_connections.graph", graph =>{
			web.wssNotifyToSubscribed( "components.midi_connections.graph", graph ) 
		});
		
		Dispatcher.on("component.midi_connections.rules", rules =>{
			web.wssNotifyToSubscribed( "components.midi_connections.rules", rules ) 
		});
		
	}
	
}



module.exports = MidiConnectionsWebController;