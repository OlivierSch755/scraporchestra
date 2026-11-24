const {spawn} = require("node:child_process");

const sushiWebUiBin = "/usr/bin/sushi-webui";

function startSushiEditorBackend(options = {}) {

    const port = options.port ?? 8081;
    const data_dir = options.data_dir ?? "/tmp/sushiui";
    const plugins_json = options.plugins_json ?? "/usr/share/sushi-webui/installed_plugins.json";
    const audio_dir = options.audio_dir ?? "/home/mind";
    const default_input = options.default_input ?? 1;
    const default_output = options.default_output ?? 1;

    const spawn_args = [
        "--listen", `:${port}`,
        "--transport", "zmq",
        "--data-dir", data_dir,
        "--plugin-list", plugins_json,
        "--audio-dir", audio_dir,
        "--default-input", `${default_input}`,
        "--default-output", `${default_output}`,
    ];

    const child = spawn(sushiWebUiBin, spawn_args);

    let connected = false;
    let stderrBuffer = "";

    let resolveConnected;
    let rejectConnected;

    const connectedPromise = new Promise((resolve, reject) => {
        resolveConnected = resolve;
        rejectConnected = reject;
    });

    const handleStdErr = (msg) => {
        const output = msg.toString();
        stderrBuffer += output;

        const lines = stderrBuffer.split("\n");
        stderrBuffer = lines.pop();

        for (const line of lines) {
            if (!connected && line.includes('msg="connected to sushi"')) {
                connected = true;
                resolveConnected();
            }
        }
    };

    child.stderr.on("data", handleStdErr);

    child.on("error", (err) => {
        rejectConnected(err);
    });

    child.on("exit", (code, signal) => {
        if (!connected) {
            rejectConnected(
                new Error(`Sushi exited before connecting (code=${code}, signal=${signal})`)
            );
        }
    });

    return {
        child,
        connected: connectedPromise,
        close: () => {
            child.stderr.off("data", handleStdErr);
            if (child.exitCode === null && child.signalCode === null){
                child.kill("SIGTERM");
            }
        }
    };
}

module.exports = {startSushiEditorBackend}