const {spawn} = require("node:child_process");


const sushiWebUiBin = "/usr/bin/sushi-webui";

function startSushiEditorBackend( options = {} ){
	
	
	
	const port = options?.port ?? 8081
	const data_dir = options?.data_dir ?? "/tmp/sushiui"
	const plugins_json = options?.plugins_json ?? "/usr/share/sushi-webui/installed_plugins.json"
	const audio_dir = options?.audio_dir ?? "/home/mind"
	const default_input = options?.default_input ?? 1
	const default_output = options?.default_output ?? 1
	
	const spawn_args = [
		`--dev`,
		`--listen`, `:${port}`,
		`--transport`, `zmq`,
		`--data-dir`, `${data_dir}`,
		`--plugin-list`, `${plugins_json}`,
		`--audio-dir`, `${audio_dir}`,
		`--default-input`, `${default_input}`,
		`--default-output`, `${default_output}`,
	];
	
	const child = spawn(sushiWebUiBin, spawn_args );
	
	const debug_string = ( ()=>{
		let txt = sushiWebUiBin;
		let args = "";
		spawn_args.forEach(arg=> args += ( " " + arg ));
		return txt + args
	} )();
		
	const handleStdErr = (msg) =>{
		console.log( 'SUSHI UI Err', msg.toString() )
	}	
		
	child.stderr.on("message", handleStdErr )
		
	return({
		child,
		close : ()=>{
            if (child.exitCode === null && child.signalCode === null) {
                child.kill("SIGTERM");
            }
		}
	});
	
	
	
}

module.exports = {startSushiEditorBackend}