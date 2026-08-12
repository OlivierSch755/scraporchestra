import Alpine from '/js/lib/alpine.js';


// basic component templating 
Alpine.directive('load_template', (el, { expression }, { cleanup }) => {
    let source = document.getElementById(expression);

    if ( !source || !(source instanceof HTMLTemplateElement) ) {
        console.warn(`Template ${expression} not found`);
        return;
    }
	
    let fragment = source.content.cloneNode(true);
	const child = fragment.firstElementChild;
    el.replaceWith(child);
	Alpine.initTree(child);
});

// basic dialog windows
Alpine.store('views', {});
export const AppViews = Alpine.store('views');

Alpine.data('dialog', (name) => {

	const dialog = {
		name,

		get value() {
			return AppViews?.[this.name];
		},

		close() {
			AppViews[this.name] = null;
		},

		init() {
			const modal = this.$el;

			modal.addEventListener("cancel", (event)=>{console.log(event)})

			modal.addEventListener('close', () => this.close());

			modal.addEventListener('cancel', (e) => {
				if (e.target !== modal) return;
				e.preventDefault();
				this.close();
			});

			this.$watch('value', (value) => {
				if (value && !modal.open) {
					modal.showModal();
					document.getElementById("toast")?.hidePopover() ;
					document.getElementById("toast")?.showPopover() ;
				}

				if (!value && modal.open) {
					modal.close();
				}
			});
			
			
			// Auto append close button
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'modal_close_btn';
			button.textContent = 'x';
			button.addEventListener('click', () => this.close());
			modal.prepend(button);
			

			
		}
	};
	
	const proto_getter = {};
	proto_getter[name] = {
		get(){
			return this.value;
		}
	}
	
	Object.defineProperties( dialog , proto_getter)
	return dialog;
});

// x-lock (useful for disabling buttons and inputs while store is busy )
Alpine.directive('lock', (el, {expression}) => {
    Alpine.effect(() => {
        el.disabled = Alpine.store(expression).requestInProgress
    });
});



export class LazyLoadingSection{
	
	constructor( pre_open = false, heading_level = 2, heading_text ){
		this.heading_text = heading_text;
		this.heading_level = heading_level;
		this.open = pre_open;
		this.loaded = false;
		this.loading = false;
	}
	
	async load(){
		this.loaded = true;
	};
	
	init(){
		const header_el = document.createElement( "header" );
		const heading_el = document.createElement( "h" + this.heading_level );
		heading_el.textContent = this.heading_text;
		const close_btn_el = document.createElement("button");
		
		const refreshCloseButton =()=>{
			const open = this.open;
			close_btn_el.classList.toggle("open", open);
			close_btn_el.classList.toggle("closed", !open);
			close_btn_el.setAttribute("aria-label", open ? "open" : "close");
			close_btn_el.setAttribute("aria-expanded", open ? "true" : "false");
		}
			
		this.$watch( "open", (value)=>{
			refreshCloseButton();
		});
		refreshCloseButton();
		
		close_btn_el.onclick = ()=>{
			this.open = !this.open;
			if( this.open && !this.loaded && !this.loading ) this.load();
		}
		
		if(this.open) this.load();
		
		header_el.append( heading_el, close_btn_el );
		this.$el.prepend(header_el);
		
	}
	
	
	
	
}

Alpine.data("togglable_section", function(){return new LazyLoadingSection(...arguments)})
