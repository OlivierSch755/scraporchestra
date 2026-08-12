import Alpine from '/js/lib/alpine.js';
import { sushiEditorApi } from './api.js'
import { sushiStore } from './sushi.js'
import { sushiStub } from '../sushi_client/client.js'; 
import { LazyLoadingSection } from '/js/lib/alpine_global.js';

const { SyncMode, PlayingMode, TimeSignature } = sushiStub;

const syncModes = Object.fromEntries( 
	Object.entries( SyncMode.Mode )
		.filter( ([k,v]) => k !== "DUMMY") 
);



Alpine.data("TransportSection", ()=>({
	
	syncModes,
	time_signature : TimeSignature.create({denominator : 0, numerator : 0}),
	sync_mode : SyncMode.create(),
	playing_mode : PlayingMode.create(),
	midi_clock_output : false,
	tempo : 0,
	versions : new Map(),
	ui_busy : new Map(),
	ui_active : true,
	
	ui_refresh(timestamp) {
		if(!this.ui_active) return;
		
		if( this.shouldUpdate( sushiStore.tempo ) ){
			this.tempo = sushiStore.tempo.value;
			this.versions.set(sushiStore.tempo, sushiStore.tempo.version );
		}
		
		
		if( this.shouldUpdate(sushiStore.playingMode)  ){
			this.playing_mode = sushiStore.playingMode.value;
			this.versions.set(this.playing_mode, sushiStore.playingMode.version );
			this.updatePlayBtn();
		}
		
		if( this.shouldUpdate(sushiStore.timeSignature)  ){
			this.time_signature = sushiStore.timeSignature.value;
			this.versions.set(this.time_signature, sushiStore.timeSignature.version );
		}
		
		if( this.shouldUpdate(sushiStore.syncMode) ){
			this.sync_mode = sushiStore.syncMode.value;
			this.versions.set(this.sync_mode, sushiStore.syncMode.version );
		}
		
		requestAnimationFrame(this.ui_refresh);
	},
	
	
	shouldUpdate(storeResource){
		const store_version = storeResource.version;
		const current_version = this.versions.get(storeResource);
		const busy = this.ui_busy.has(storeResource);
		return ( store_version > current_version && ! busy );
	},
	
	async init(){
		this.ui_refresh = this.ui_refresh.bind(this);

		this.time_signature = await sushiStore.timeSignature.load();
		this.versions.set(sushiStore.timeSignature, sushiStore.timeSignature.version );
		
		this.tempo = await sushiStore.tempo.load();
		this.versions.set(sushiStore.tempo, sushiStore.tempo.version );
		
		this.playing_mode = await sushiStore.playingMode.load();
		this.versions.set(sushiStore.playingMode, sushiStore.playingMode.version );
	
		this.$watch("sync_mode.mode", (value)=>{
			if(value === syncModes.LINK ){
				this.$refs.playBtn.disabled = true;
				this.$refs.playBtn.textContent = "Stop";
			}
			else {
				this.$refs.playBtn.disabled = false;
				this.updatePlayBtn();
			}
		})
		
		this.sync_mode = await sushiStore.syncMode.load();
		this.versions.set(sushiStore.syncMode, sushiStore.syncMode.version );
		
		this.loaded = true;
		
		this.ui_refresh();
	},
	
	updatePlayBtn(){
		const playBtn = this.$refs.playBtn;
	
		switch( this.playing_mode.mode ){
			case PlayingMode.Mode.STOPPED : 
				playBtn.textContent = "Play";
				playBtn.onclick = ()=> {
					this.ui_busy.set(sushiStore.playingMode, true);
					this.unlockField(sushiStore.playingMode); // we lock and unlock immediately to get the server debounce timeout to fire
					this.playing_mode.mode = PlayingMode.Mode.PLAYING;
					this.updatePlayBtn();
					sushiEditorApi.requestSetPlayingMode(this.playing_mode);
					
				}
			break
			case PlayingMode.Mode.PLAYING : 
				playBtn.textContent = "Stop";
				playBtn.onclick = ()=> {
					this.ui_busy.set(sushiStore.playingMode, true);
					this.unlockField(sushiStore.playingMode); // we lock and unlock immediately to get the server debounce timeout to fire
					this.playing_mode.mode = PlayingMode.Mode.STOPPED;
					this.updatePlayBtn();
					sushiEditorApi.requestSetPlayingMode(this.playing_mode);
				}
			break
		}
	},
	
	submit(event){
		const target = event.target;
		
		switch(target.name){
			case "numerator" : 
			case "denominator" : 
				sushiEditorApi.requestSetTimeSignature(this.time_signature);
				this.unlockField(sushiStore.timeSignature);
			break;
			case "tempo" : 
				sushiEditorApi.requestSetTempo(this.tempo);
				this.unlockField(sushiStore.tempo);
			break;
			case "sync_mode" : 
				sushiEditorApi.requestSetSyncMode(this.sync_mode);
				this.unlockField(sushiStore.syncMode);
			break;
			
		}
	},
	
	unlockField(key){
		clearTimeout( this.ui_busy.get(key) );
		const timeout = setTimeout( ()=> this.ui_busy.delete(key), 400);
		this.ui_busy.set(key, timeout) 
	},
	
	flagInput(element){
		const target = event.target;
		
		switch(target.name){
			case "numerator" : 
			case "denominator" : 
				this.ui_busy.set(sushiStore.timeSignature, true);
			break;
			case "tempo" : 
				this.ui_busy.set(sushiStore.tempo, true);
			break;
			case "sync_mode" : 
				this.ui_busy.set(sushiStore.syncMode, true);
			break;
		}
	},
	
	destroy(){
		this.ui_active = false;
	}
	
	
	
}));
