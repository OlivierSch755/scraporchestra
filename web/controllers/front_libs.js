const express = require("express");
const path = require ("node:path");

function createFrontLibrariesController(  ) {
	

	
    const router = express.Router();



	router.get("/alpine.js", async ( req, res ) => {
		res.sendFile(path.join(__dirname, "..", ".." , "node_modules", "alpinejs",  "dist", "module.esm.min.js" ));
	});
	
	router.get("/protobuf.js", async ( req, res ) => {
		res.sendFile(path.join(__dirname, "..", ".." , "node_modules", "protobufjs",  "dist", "light",  "protobuf.min.js" ));
	});
	

	return router;
}

module.exports = createFrontLibrariesController;
