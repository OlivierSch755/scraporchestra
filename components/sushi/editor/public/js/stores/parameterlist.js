import Alpine from '/js/lib/alpine.js';
import { sushiEditorApi } from './api.js'
import { sushiStub } from '../sushi_client/client.js'; 

const parametersTypes = sushiStub.ParameterType.Type;

class ParameterList{
	
	editing = false;
	
	constructor(processor){
		
		this.ui_active = true;
		this.children = [];
		this.processor = processor;
		this.stopEdit = this.stopEdit.bind(this);
		this.ui_refresh = this.ui_refresh.bind(this);
		this.handleInput = this.handleInput.bind(this);
		this.inputs = [];
		
	}
	
	stopEdit(event){
		if(event.target instanceof HTMLInputElement){
			const input = event.target;
			// this timeout tries to avoid input replaying its own change when server notifies back with updated values
			// it is no very robust nor elegant
			clearTimeout(input.timeout);
			input.timeout = setTimeout( ()=> input.user_edited = false, 400);
		}
	}
	
	
	handleInput(event){
		if( event.target instanceof HTMLInputElement ){
			const input = event.target;
			input.user_edited = true;
			let value;
			if(input.is_checkbox){
				value = input.checked ? 1 : 0;
			}
			else {
				value = input.value;
			}

			sushiEditorApi.requestParameterSync(input, value)
		}
	}
	
	ui_refresh(timestamp) {
		if(!this.ui_active) return;
		
		for(let label of this.children){
			
			const param = label.input.parameter;
			if(!param.state.loaded) continue;
			
			const input = label.input;
			const norm = param.state.value.normalized_value;

			// we should provide each input with a wrapper and 
			// let it contain the logic rather than nesting if blocks here

			if(!input.user_edited){

				if(input.is_checkbox &&  !!parseInt(norm) !== input.checked ){
					input.checked = !!parseInt(norm);
				}

				else if( norm.toString() !== input.value){
					input.value = norm;
				}

			}
			if( !input.is_checkbox && label.formatted_text.textContent !== param.state.value.formatted_value){
				 label.formatted_text.textContent = param.state.value.formatted_value
			}
			
		}
		
		this.animation_frame = requestAnimationFrame(this.ui_refresh);
	
	}

	
	async init(){
		
		const parameters = await this.processor.parameters.load();
		
		
		const container = this.$el;
		
		container.addEventListener( "input", this.handleInput )
		container.addEventListener( "change", this.stopEdit )
		
		
		const options = {
			root: container.closest("dialog") ?? null,
			rootMargin: "20% 0px 20% 0px",
			scrollMargin: "0px",
			threshold: 1.0,
		};
		
		this.observer = new IntersectionObserver(entries => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				const parameter = entry.target.input.parameter;
				parameter.state.load()
				.then( x=> this.observer.unobserve(entry.target) )
				.then( x=>{
					entry.target.setAttribute("loaded",true)
					const values = parameter.state.value
					const input = entry.target.input;
					input.value = values.normalized_value;
					if(!input.is_checkbox){
						entry.target.formatted_text.innerText = values.formatted_value;
					}
					else{
						input.checked = !!values.normalized_value;
					}
				} )
			}
		}, options);

		const parameters_el = [];
		parameters.forEach( parameter => {
			
			if( parameter.info.value.automatable === false ) return;
			
			const label = document.createElement("label");
			label.classList.add("parameter")
			this.observer.observe(label);
			
			
			
			const input = document.createElement("input");
			

			switch(parameter.info.value.type.type){
				
				case parametersTypes.INT : 
				case parametersTypes.FLOAT : 
					input.type = "range";
					input.step = "0.005";
					input.min = 0;
					input.max = 1;
				break;	
				case parametersTypes.BOOL : 
					input.type = "checkbox";
					input.is_checkbox = true;
				break;
			}
			
			input.parameter = parameter;
			
			label.input = input;

			const label_text = document.createElement("span");
			label_text.innerText = parameter.info.value.label;

			label.append(input, label_text);

			if(!input.is_checkbox){
				
				const unit = document.createElement("span");
				unit.innerText = parameter.info.value.unit;
				const formatted_value = document.createElement("span");
			
				label.append(unit, formatted_value );
				label.formatted_text = formatted_value;
			}



			this.children.push(label);
			
			parameters_el.push(label);
			
		} )
		container.append(...parameters_el)
		
		this.animation_frame = requestAnimationFrame(this.ui_refresh);
		
	}
	
	destroy(){
		cancelAnimationFrame(this.animation_frame);
		this.observer.disconnect();
		this.ui_active = false;
	}
	
	
}

Alpine.data("parameterList", (processor)=> new ParameterList(processor) )

