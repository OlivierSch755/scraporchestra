/*
	Suite of test for Sushi component
*/


const {describe,it,before,after} = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const fs = require("node:fs/promises");
const path = require("node:path");

const {RessourceState} = require("engine/states");
const {createTestApp, createTestProject, loadTestProject} = require("./helpers/create-test-app");
const Sushi = require("components/sushi");

// Do a small override on the Sushi class so default config will use DUMMY driver instead of RASPA
;(()=>{
	const original_get_default_config_method = Sushi.get_default_config;
	Sushi.get_default_config = function(){
		const config = original_get_default_config_method();
		config.driver = "--dummy";
		return config;
	}
})();

const projectName = "test_project_sushi";



describe("Sushi component API", { concurrency: false }, () => {
	let ctx;
	
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
	
	async function assertComponentInstallation(){

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
		
		
		// verify config file has been written to project dir
		const expected_sushi_config_file_path = path.join(
			ctx.application.engine.project.dir,
			"sushi_config.json"
		)
		
		const stat = await fs.stat( expected_sushi_config_file_path );
		assert.ok(stat.isFile());
		
	}
	
	async function assertComponentUninstallation(){
		// verify Sushi is no longer installed in project	
		assert.equal(
			ctx.application.engine.project.components.sushi,
			undefined,
			"No Sushi component instance should be left in engine after removing component from project"
		);		
		assert.equal(
			ctx.application.engine.project.config.components.sushi,
			undefined,
			"Project config should no longer have any Sushi setting after removing component from project"
		);
		
		const expected_sushi_config_file_path = path.join(
			ctx.application.projectManager.getProjectPath(projectName),
			"sushi_config.json"
		)
		
		await assert.rejects(
			fs.stat(expected_sushi_config_file_path),
			{ code: "ENOENT" }
		);
		
		
	}
	
	before(async () => {
		ctx = await createTestApp();
		await createTestProject(ctx, projectName);
		await loadTestProject(ctx, projectName);
	});

	after(async () => {
		await ctx?.close();
	});


	
	it("tests component installation", async () => {
		await request(ctx.webServer.server)
			.post(`/projects/api/add_components`)
			.send(["sushi"])
			.set('Content-Type', 'application/json')
			.expect(200);
		await assertComponentInstallation();	
	});
	
	
	it("tests component uninstallation", async () => {
		await request(ctx.webServer.server)
			.post(`/projects/api/delete_component/sushi`)
			.expect(200);
		await assertComponentUninstallation();
	});
	
	it("starts and closes Sushi editor", async () => {
		
		await request(ctx.webServer.server)
			.post(`/projects/api/add_components`)
			.send(["sushi"])
			.set('Content-Type', 'application/json')
			.expect(200);
		await assertComponentInstallation();	
		
		const { editor } = await startSushiEditor();
		await request(ctx.webServer.server)
			.post(`/components/sushi/api/editor/stop`)
			.expect(200);
		await assertEditorClosed(editor);
	});
	

	it("verifies Sushi editor gets terminated when Sushi component is uninstalled", async () => {
		const { editor } = await startSushiEditor();
		await request(ctx.webServer.server)
			.post(`/projects/api/delete_component/sushi`)
			.expect(200);
			
		await assertComponentUninstallation();
		await assertEditorClosed(editor);
	});
	
	
});
