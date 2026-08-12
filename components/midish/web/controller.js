const express = require("express");
const path = require ("node:path");
const multer = require ("multer");
const {ComponentWebController} = require("web/component_controller_class");


const public_path = path.resolve( __dirname, "public" )
const editor_public_path = path.resolve( __dirname, "..", "editor", "public" )


function isMidi(buffer) {
    // MIDI files start with the ASCII chunk identifier "MThd"
    return buffer.length >= 14 &&
           buffer.subarray(0, 4).toString("ascii") === "MThd";
}


class MidishController extends ComponentWebController {
	
	initRouter(){

		// using this.instance without any error handling
		// is relatively safe because error middleware after 
		// us know how to deal with Component.geInstanceByName(...) errors.

		const { engine, web, Dispatcher } = this.application;
		const router = this.router;

		router.get( "/api/status" , (req, res) => {
			res.json( this.instance );
		});
		
		router.get("/file/midi.json", async (req, res) => {
			const data = await this.instance.getCurrentMidiFileData();
			res.json(data);
		
		});
		
		
		router.post("/api/seek/:bar", async (req, res) => {
			await this.instance.controller?.goToMeasure(req.params.bar);
			res.sendStatus(200);
		});
		
		router.post("/api/select/:length", async (req, res) => {
			await this.instance.controller?.setSelectLength(req.params.length);
			res.sendStatus(200);
		});
		
		
		router.post("/api/play", async (req, res) => {
			await this.instance.controller?.play();
			res.sendStatus(200);
		});
		
		router.post("/api/stop", async (req, res) => {
			await this.instance.controller?.stop();
			res.sendStatus(200);
		});
		
		router.post("/api/metronome", async (req, res) => {
			await this.instance.controller?.setMetronome(req.body);
			res.sendStatus(200);
		});
		
		router.post("/api/mute/:track_name/:mute_state_str", async (req, res) => {
			
			const {mute_state_str, track_name} = req.params
			const mute_state = ( mute_state_str === "1" );
			
			await this.instance.controller?.toggleMute(track_name, mute_state );
			res.sendStatus(200);
		});
		
		router.post("/api/loop/:loop_mode_str", async (req, res) => {
			
			const {loop_mode_str} = req.params
			const loop_mode = ( loop_mode_str === "1" );
			
			await this.instance.controller?.toogleLoop(loop_mode );
			res.sendStatus(200);
		});
		
		

		
		
		router.get("/api/session.json", async (req, res) => {
			const data = await this.instance.controller?.getSessionData();
			res.json(data);
		});
		
		
		router.post("/api/slave/:mode", async (req, res) => {
			const slave = req.params.mode === "1"
			this.instance.config.slave = slave;
			await this.instance.controller?.setSlaveMode(slave);
			res.sendStatus(200);
		});
		
		
		router.post("/api/reset", async (req, res) => {
			const buffer = await this.instance.controller?.reset();
			res.sendStatus(200);
		});
		
		router.post("/api/add_filter/:filter_name", async (req, res) => {
			await this.instance.controller?.add_filter(req.params.filter_name);
			res.sendStatus(200);
		});
		
		router.get("/api/filter.json", async (req, res) => {
			const data = await this.instance.controller?.get_filter_def();
			res.json(data);
		});
		
		
		
		const upload = multer({
			storage: multer.memoryStorage(),
			limits: {
				fileSize: 10 * 1024 * 1024 // 10 MB
			},  
			fileFilter(req, file, cb) {
				const allowedMimeTypes = [
					"audio/midi",
					"audio/x-midi",
					"audio/mid",
					"application/x-midi",
					"application/octet-stream"
				];

				const ext = path.extname(file.originalname).toLowerCase();

				if (
					[".mid", ".midi"].includes(ext) &&
					allowedMimeTypes.includes(file.mimetype)
				) {
					cb(null, true);
				} else {
					cb(new Error("Invalid file type"));
				}
			}
		});

		router.post(
			"/api/import",
			upload.single("midi_file"),
			async (req, res) => {
				if (req.file) {
					// replace MIDI file
					if (!isMidi(req.file.buffer)) {
						return res.status(400).send("Invalid MIDI file");
					}
							
					await this.instance.importMidiFileFromBuffer(req.file.buffer);
				}
				res.sendStatus(200);
			}
		);
				
		router.use( express.static( public_path ) );

		Dispatcher.on("component.midish.notification", (notification) => {
			web.wssNotifyToSubscribed( "component.midish.notification", notification ) 
		});	
				
				
		

	}
	
}



module.exports = MidishController;