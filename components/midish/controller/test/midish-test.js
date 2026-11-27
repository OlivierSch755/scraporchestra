const {describe,it,before,after} = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const fs = require("node:fs/promises");
const path = require('node:path');
const {once} = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');

const midifile_path = path.join( __dirname, "midi_files", "test.mid" );
const expected_tracks_number = 4;

const corrupted_midifile_path = path.join( __dirname, "midi_files", "corrupted.mid" )

const playing_modes = require("../modes.json")

const { MidishController } = require("../controller.js") ;
MidishController.bin = path.join(__dirname, '..','..', 'bin', 'midish') ;

const Dispatcher = require("engine/dispatcher");


async function expectEvents(emitter, eventName, minCount, duration = 1000) {
    let count = 0;

    const listener = () => count++;

    emitter.on(eventName, listener);

    try {
        await delay(duration);

        assert.ok(
            count >= minCount,
            `Expected at least ${minCount} "${eventName}" events within ${duration}ms, received ${count}`
        );
    } finally {
        emitter.off(eventName, listener);
    }
}

describe("Class composition", { concurrency: false },  () => {
	
	let controller;
	
	// before(async () => {});
	
	after(async () => {
		await controller?.close();
	});

	it("creates MidishController instance", async()=>{
		controller = new MidishController();
	})
	
	it("initializes MidishController instance", async()=>{
		await controller.init();
	})
	
	it("sends messages and gets responses", async()=>{
		
		const expected_ls_empty_output = [
			'outlist {',
			'\t# chan_name,  {devicenum, midichan}',
			'}',
			'inlist {',
			'\t# chan_name,  {devicenum, midichan}',
			'}',
			'filtlist {',
			'\t# filter_name',
			'}',
			'tracklist {',
			'\t# track_name,  default_filter,  used_channels,  flags',
			'}',
			'sysexlist {',
			'\t# sysex_name,  number_messages',
			'}',
			'curout nil',
			'curin nil',
			'curfilt nil',
			'curtrack nil',
			'cursysex nil',
			'curquant nil',
			'curev any {0..15 0..15}',
			'curpos 0',
			'curlen 0',
			'tap off',
			'tapev none'
		];
		
		let tests = 20;
		while(tests--){
			// send multiple quick commands to verify we get same result each time..
			const result = await controller.midishProcess.sendCommand("ls");
			assert.deepStrictEqual(result.data, expected_ls_empty_output);
		}
		
		
	})
	
	
})

describe("MIDI File import / export ", { concurrency: false, timeout:500 },  () => {
	
	let controller;
	let tmp_dir;
	
	before(async () => {
		
		tmp_dir = await fs.mkdtemp( path.join(os.tmpdir(), "midish_component_test") );
		controller = new MidishController();
		await controller.init();
	});
	
	after(async () => {
		try{
			await controller?.close();
		}
		finally{
			await fs.rm(tmp_dir, {
				recursive: true,
				force: true
			});
		}
	});

	it("import a midi file", async()=>{
		await assert.doesNotReject ( controller.sessionController.importMidiFile( midifile_path  ) );
        assert.equal(
            controller.session.tracks.length,
			expected_tracks_number,
            "Imported tracks should exist"
        );
	})
	
	it("export a midi file", async()=>{
		const export_path = path.join( tmp_dir, "export.mid" );
		await controller.sessionController.exportMidiFile( export_path  );
		
		const stat = await fs.stat( export_path );
		assert.ok(stat.isFile());
		
		
	})
	
})

describe("MIDI file Import error handling", { concurrency: false, timeout:500 },  () => {
	
	let controller;
	
	before(async () => {
		controller = new MidishController();
		await controller.init();
	});
	
	after(async () => {
		await controller?.close();
	});

	it("rejects importing non-existant midi file", async()=>{
		await assert.rejects(
			controller.sessionController.importMidiFile( "/tmp/path/that/do/not/exist.msh" )
		);
	})
	
	it("rejects importing corrupted midi file", async()=>{
		await assert.rejects(
			controller.sessionController.importMidiFile( corrupted_midifile_path )
		);
	})
	
	
	
})

describe("Track API", { concurrency: false },  () => {
	
	let controller;
	const test_track_name = "test_track_name";
	const renamed_track = "renamed_track";
	
	before(async () => {
		controller = new MidishController();
		await controller.init();
	});
	
	after(async () => {
		await controller?.close();
	});

	it("creates a new track", async()=>{
		await controller.trackController.createTrack(test_track_name);
		assert.ok( controller.session.tracks.find( ({name}) => name === test_track_name ) );
	})
	
	it("renames track", async()=>{
		await controller.trackController.renameTrack(test_track_name, renamed_track);
		
		assert.ok( 
			controller.session.tracks.find( ({name}) => name === renamed_track ),
			"renamed track should be listed in graph"
		);
		
		assert.ok( 
			controller.session.tracks.some( ({name}) => name === test_track_name ) === false , 
			"old track name should no longer be listed in graph"
		);
		
	})

	it("rejects duplicate track names", async()=>{
		await assert.rejects( controller.trackController.createTrack(renamed_track) );
		
	})
	

	it("deletes a track", async()=>{
		await controller.trackController.deleteTrack(renamed_track);
		assert.ok( !controller.session.tracks.find( ({name}) => name === renamed_track ) );
	})
	
	
})

describe("Playback API", { concurrency: false },  () => {
	
	let controller;
	let rev_before;
		
	const beat_notification_timeout = 3000;	
		
	function assertRevisionIncreased(){
		assert.ok(  
			controller.transport.rev > rev_before,
			"transport revision should have increased"
		);
		rev_before = controller.transport.rev;
	}
	
	function assertMode(mode){
		assert.equal( 
			mode, 
			controller.transport.mode,
			"public facing API should report playing mode as " + playing_modes[mode]
		);
	}
	
	before(async () => {
		controller = new MidishController();
		await controller.init();
		rev_before = controller.transport.rev;
	});
	
	after(async () => {
		await controller?.close();
	});

	it("handles playback mode requests", async()=>{
		
		await controller.transportController.userPlay();
		assertRevisionIncreased();
		assertMode( playing_modes.PLAY );

		await controller.transportController.userIdle();
		assertRevisionIncreased();
		assertMode( playing_modes.IDLE );

		await controller.transportController.userRecord()
		assertRevisionIncreased();
		assertMode( playing_modes.RECORD );
				
		await controller.transportController.userStop();
		assertRevisionIncreased();
		assertMode( playing_modes.STOP );
	
	})
	
	
	it("notifies position change when playing", {timeout: beat_notification_timeout }, async () => {

		// Increase tempo as much as we can so test is faster
		const tempo = 240;
		const tempo_set = await controller.midishProcess.sendCommand("t " + tempo);
		assert.ok(tempo_set.err.length === 0);
		
		
		// We want to verify we get on beat per measure
		// that means one notification each 60_000 / tempo 
		// and we add a small grace period of 20%
		const expected_notifs = 6;
		const timeout = (expected_notifs * (60_000 / tempo)) * 1.2;
		
		if(timeout > beat_notification_timeout){
			throw new Error("Test timeout window is smaller than beat timeout window. Test will fail regardless of actual success.")
		}
		
		
		const event_count_promises = expectEvents(
			Dispatcher,
			'component.midish.position',
			expected_notifs,
			timeout
		);
		
		await controller.transportController.userPlay();
		assertRevisionIncreased();
		assertMode(playing_modes.PLAY);
		await event_count_promises;
	});
		
})

describe("Concurrency robustness", { concurrency: false },  () => {
	
	let controller;
	const test_track_name = "test_track_name";
	
	before(async () => {
		controller = new MidishController();
		await controller.init();
	});
	
	after(async () => {
		await controller?.close();
	});

    it("handles concurrent MIDI import and track creation", async () => {

        const results = await Promise.allSettled([
            controller.sessionController.importMidiFile(midifile_path),
            controller.trackController.createTrack("concurrent_track")
        ]);

        assert.equal(
            results.filter(r => r.status === "rejected").length,
            0,
            "All concurrent operations should succeed"
        );

        assert.equal(
            controller.session.tracks.length,
			expected_tracks_number + 1, //  tracks in test file + 1 track we just created
            "Imported tracks should exist"
        );

        assert.ok(
            controller.session.tracks.some(
                ({ name }) => name === "concurrent_track"
            ),
            "Created track should exist"
        );

    });
	
	
	
})

