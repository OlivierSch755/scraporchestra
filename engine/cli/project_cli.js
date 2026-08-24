#!/usr/bin/env node

const repl = require('node:repl');
const util = require('node:util');
const path = require('node:path');

const { Project } = require("./../project.js");
let project;


console.log(`---------------- PROJECT CLI ----------------`);
let optional_project_path = process.argv[2];

if(optional_project_path){
	project = new Project(optional_project_path);
	console.log(project);
} else {
	console.log("load a project via ` new project( some_absolute_path ) `");
}


const r = repl.start();

const historyFile = path.join(__dirname, '.repl_history');
r.setupHistory(historyFile, () => {});


Object.assign(r.context, {
  Project, project
});