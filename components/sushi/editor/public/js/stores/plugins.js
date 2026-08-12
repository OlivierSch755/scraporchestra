import Alpine from '/js/lib/alpine.js';
import data from "../../installed_plugins_target.json" with { type: "json" };
import { sushiStub } from '../sushi_client/client.js';
import {sushiStore} from './sushi.js';


let id = 0;
const sortableRegistry = [];

Object.entries(data.plugins).forEach( ([editor,byCategory]) => {
	Object.entries(byCategory).forEach( ([category, plugins])=>{
		Object.values(plugins).forEach( plugin => {
			const plugin_item = {};
			Object.assign(plugin_item, plugin)
			plugin_item.type = plugin_item.type?.toUpperCase() ?? "INTERNAL";
			plugin_item.category = category;
			plugin_item.editor = editor;
			plugin_item.id = id ++;
			sortableRegistry.push(plugin_item);
		} )
	} )

} )

const internal_plugins_uids = [
	"sushi.testing.passthrough",
	"sushi.testing.gain",
	"sushi.testing.equalizer",
	"sushi.testing.mono_summing",
	"sushi.testing.sample_delay",
	"sushi.testing.stereo_mixer",
	"sushi.testing.send",
	"sushi.testing.return",
	"sushi.testing.freeverb",
	"sushi.testing.sampleplayer",
	"sushi.testing.arpeggiator",
	"sushi.testing.transposer",
	"sushi.testing.step_sequencer",
	"sushi.testing.peakmeter",
	"sushi.testing.cv_to_control",
	"sushi.testing.control_to_cv",
	"sushi.testing.wav_writer",
	"sushi.testing.wav_streamer"
];

Alpine.data("pluginView", ()=>({
	filter: '',
	sortBy: 'name',
	sortDirection: 'asc',

	get plugins() {
		let plugins = sortableRegistry;

		// Filter
		if (this.filter) {
			const q = this.filter.toLowerCase();

			plugins = plugins.filter(plugin =>
				plugin.name.toLowerCase().includes(q) ||
				plugin.category.toLowerCase().includes(q) ||
				plugin.editor.toLowerCase().includes(q) ||
				plugin.type.toLowerCase().includes(q)
			);
		}

		// Sort
		plugins.sort((a, b) => {
			let av = a[this.sortBy];
			let bv = b[this.sortBy];

			av = typeof av === 'string' ? av.toLowerCase() : av;
			bv = typeof bv === 'string' ? bv.toLowerCase() : bv;

			if (av < bv) return this.sortDirection === 'asc' ? -1 : 1;
			if (av > bv) return this.sortDirection === 'asc' ? 1 : -1;
			return 0;
		});

		return plugins;
	},

	set sort(newSortBy){
		if( this.sortBy === newSortBy){
			this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc'
		}
		else{
			this.sortBy = newSortBy;
			this.sortDirection = 'asc';
		}
	},
	
	
}))

const PluginTypes = Object.fromEntries( 
	Object.entries(
		sushiStub.PluginType.Type
	)
	.filter( ([k,v]) => k !== "DUMMY" )
);

Alpine.data("pluginAdder", (track)=>({
	
	track : track,
	selected_plugin : null,
	plugin_factory : sushiStub.CreateProcessorRequest.create({
		type : sushiStub.PluginType.create({type:PluginTypes.INTERNAL}),
		track : track,
	}),
	PluginTypes,
	internal_plugins_uids,
	nameTakenError : false,
	loaded : false,
	
	async verifyUniqueName(processor){
		const unique = await sushiStore.isProcessorNameUnique(processor);
		if(unique){
			this.nameTakenError = false;
			return processor;
		}
		this.nameTakenError = true;
		return null;
	},
	
	// convenience method to help making plugin name unique when adding from the plugin store
	async forceUniqueNameOnProcessor(processor){
		const unique = await sushiStore.isProcessorNameUnique(processor);
		
		if(unique) return processor;
		
		let name;
		let unique_name_found = false;
		let suffix = 1;
		while( unique_name_found === false ){
			name = `${processor.name}_${suffix}`;
			unique_name_found = ! sushiStore.processors.value.some( p => p.info.value?.name === name);
			suffix++;
		}
	
		const transformed_processor = structuredClone(Alpine.raw(processor));
		transformed_processor.name = name;
		return transformed_processor;
	}

	
}));

export const AppPlugins = Alpine.store('plugins');
