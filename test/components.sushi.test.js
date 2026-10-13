/*
	Suite of test for basic project lifecycle API
*/


const {describe,it,before,after} = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const fs = require("node:fs/promises");
const path = require("node:path");

const Sushi = require("components/sushi");

// Do a small override on the Sushi class so default config will use dummy driver instead of RASPA
;(()=>{
	const original_get_default_config_method = Sushi.get_default_config;
	Sushi.get_default_config = function(){
		const config = original_get_default_config_method();
		config.driver = "--dummy";
		return config;
	}
})();

const {RessourceState} = require("engine/states");


const {
	createTestApp
} = require("./helpers/create-test-app");

const projectName = "test_project_sushi";





describe("Sushi component API", { concurrency: false }, () => {
	let ctx;
	let loaded_project;
	
	
	// helpers
	async function startSushiEditor() {
		await request(ctx.webServer.server)
			.post("/components/sushi/api/editor/start")
			.expect(200);

		const sushi = ctx.application.engine.project.components.sushi;
		const editor = sushi.editor_backend;

		assert.ok(
			editor.proxy.ok,
			"Sushi gRPC Proxy should report readiness"
		);

		assert.equal(
			editor.proxy.stream_multiplexer.active,
			true,
			"gRPC stream multiplexer should have been activated"
		);

		assert.equal(
			sushi.state,
			RessourceState.READY,
			"Sushi component should be in ready state"
		);

		return { sushi, editor };
	}
	
	// helpers
	async function assertEditorClosed(editor){
		assert.equal(
			editor.proxy.closed, 
			true,
			"Sushi GRPC Proxy should have been closed upon closing editor"
		);	
		
		assert.equal(
			editor.proxy.stream_multiplexer.active, 
			false,
			"gRPC stream multiplexer should have been disabled upon closing editor"
		);	

		assert.equal(
			editor.proxy.asyncValidator.tearing_down, 
			true,
			"AsyncValidator should at least have started its teardown procedure upon closing editor"
		);	
	}	
	
	
	
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
	
	it("loads project", async () => {
		await request(ctx.webServer.server)
			.post(`/projects/api/open/${projectName}`)
			.expect(200);
			
		assert.equal(ctx.application.engine.project.name, projectName );
		assert.equal(ctx.application.engine.project.state, RessourceState.READY );
		assert.equal(ctx.application.engine.state, RessourceState.READY );
		
	});
	
	it("installs Sushi in project", async () => {
		await request(ctx.webServer.server)
			.post(`/projects/api/add_components/${projectName}`)
			.send(["sushi"])
			.set('Content-Type', 'application/json')
			.expect(200);
			
		const sushi_component_instance = ctx.application.engine.project.components.sushi;
		
		// verify Sushi is installed in project	
		assert.ok(
			sushi_component_instance instanceof Sushi,
			"Project should hold a Sushi instance after component installation"
		);		
		
		assert.deepStrictEqual(
			ctx.application.engine.project.config.components.sushi,
			Sushi.get_default_config(),
			"Sushi component should have written its default configuration in project config during installation"
		);

		// verify Sushi is running
		assert.equal(
			sushi_component_instance.state,
			RessourceState.READY,
			"Sushi component should be in ready state after installation request completed"
		);		
		
	});
	
	it("starts and closes Sushi editor", async () => {
		const { editor } = await startSushiEditor();
		await request(ctx.webServer.server)
			.post(`/components/sushi/api/editor/stop`)
			.expect(200);
		await assertEditorClosed(editor);
	});
	

	it("verifies Sushi editor gets terminated when Sushi component is uninstalled", async () => {
		const { editor } = await startSushiEditor();
		await request(ctx.webServer.server)
			.post(`/projects/api/delete_component/${projectName}/sushi`)
			.expect(200);
		await assertEditorClosed(editor);
	});
	
	
});
