/*
	Suite of test for basic project lifecycle API
*/


const {describe,it,before,after} = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const fs = require("node:fs/promises");
const path = require("node:path");

const {RessourceState} = require("engine/states");
const {createTestApp} = require("./helpers/create-test-app");

const projectName = "test_project";

describe("Project lifecycle API", { concurrency: false },  () => {
	
	let ctx;
	let loaded_project;
	
	before(async () => {
		ctx = await createTestApp();
	});

	after(async () => {
		await ctx?.close();
	});

	it("creates an empty project", async () => {
		await request(ctx.webServer.server)
			.post(`/projects/api/create/${projectName}`)
			.expect(200);
		
		const stat = await fs.stat( path.join(ctx.root, "projects", projectName ) );
		assert.ok(stat.isDirectory());
	});
	
	it("rejects duplicate project creation", async () => {
		await request(ctx.webServer.server)
			.post(`/projects/api/create/${projectName}`)
			.expect(409);
	});
	
	it("rejects invalid characters in project name", async () => {
		const invalid_project_name = "*$.test";
		await request(ctx.webServer.server)
			.post(`/projects/api/create/${invalid_project_name}`)
			.expect(400);
	});
	
	it("rejects deleting a project that does not exist", async () => {
		const non_project = "I_do_not_exist";
		await request(ctx.webServer.server)
			.post(`/projects/api/delete/${non_project}`)
			.expect(404);
	});
	
	
	it("loads project", async () => {
		await request(ctx.webServer.server)
			.post(`/projects/api/open/${projectName}`)
			.expect(200);
			
		assert.equal(ctx.application.engine.project.name, projectName );
		assert.equal(ctx.application.engine.project.state, RessourceState.READY );
		assert.equal(ctx.application.engine.state, RessourceState.READY );
		
		loaded_project = ctx.application.engine.project;
	});
	
	it("closes project", async () => {
		await request(ctx.webServer.server)
			.post(`/projects/api/close`)
			.expect(200);
			
		assert.equal(ctx.application.engine.project, null );
		assert.equal(ctx.application.engine.state, RessourceState.CLOSED );
		assert.equal(loaded_project.state, RessourceState.CLOSED );
		
	});
	
	it("saves project", async () => {
		// Reload project
		await request(ctx.webServer.server)
			.post(`/projects/api/open/${projectName}`)
			.expect(200);
			
		// Write something in project config
		const test_property_to_save = {
			some_value : 14,
			some_other_value : "I like potato",
			some_nested_values : {
				some_nested_value : false,
				some_other_nested_value : "Carrot is also nice",
			}
		}
		
		const project_before_save = ctx.application.engine.project;
		
		project_before_save.config.test_property = test_property_to_save;
		
		// Save project
		await request(ctx.webServer.server)
			.post(`/projects/api/save`)
			.expect(200);
			
		// Close project
		await request(ctx.webServer.server)
			.post(`/projects/api/close`)
			.expect(200);
			
		// Reload project
		await request(ctx.webServer.server)
			.post(`/projects/api/open/${projectName}`)
			.expect(200);
			
		// Verify project config was not lost in the process
		const project_after_save = ctx.application.engine.project;
		
		assert.ok( project_after_save !== project_before_save, "Both projects should point to separate references" );
		
		assert.ok( project_after_save.config , "Config property was lost after save/reload" );
		
		assert.deepStrictEqual( 
			project_before_save.config.test_property, 
			project_after_save.config.test_property,
			"Recovered config should be equal to saved config"
		);	
	});
	
	it("deletes project", async () => {
		await request(ctx.webServer.server)
			.post(`/projects/api/delete/${projectName}`)
			.expect(200);
			
		await assert.rejects(
			fs.stat(path.join(ctx.root, "projects", projectName)),
			{ code: "ENOENT" }
		);
	});
	
	it("rejects loading a project that does not exist", async () => {
		await request(ctx.webServer.server)
			.post(`/projects/api/delete/${projectName}`)
			.expect(404);
	});
	
});

describe("Project discovery API", { concurrency: false },  () => {
		
	let ctx;
	let root;
	let project_1_name = "project_test_1";
	let project_2_name = "project_test_2";
	
	before(async () => {
		
		// Create a first app context with a random root directory.
		// Keep_root is set to true, so root directory won't be deleted when ctx closes.
		// We need to re-use it in order to verify projects persistance.
		ctx = await createTestApp( {keep_root : true} ); 
		
		root = ctx.root; // store root directory
	});

	after(async () => {
		await ctx?.close();
	});

	it("gets a list of existing projects",  async () => {
		
		// Use the app to create 2 projects
		await request(ctx.webServer.server)
			.post(`/projects/api/create/${project_1_name}`)
			.expect(200);
		
		await request(ctx.webServer.server)
			.post(`/projects/api/create/${project_2_name}`)
			.expect(200);
		
		// close app
		await ctx.close();
		
		// open new app on same directory
		ctx = await createTestApp({root});
		
		const result = await request(ctx.webServer.server)
			.get(`/projects/api/list`)
			.expect(200);
			
		// check response contains both projects names
		assert( result.body.includes(project_1_name)  )
		assert( result.body.includes(project_2_name)  )
		
	});
	
})