// This is a default template class for Component web router/controller


const express = require("express");
class ComponentWebController{
	
	constructor(application,name){
		this.application = application;
		this.name = name;
		this.router = new express.Router();
		this.initRouter();
	}

	get instance(){
		return this.application.getComponentInstanceByName(this.name);
	}
	
	initRouter(){}
	
}

module.exports = {ComponentWebController};