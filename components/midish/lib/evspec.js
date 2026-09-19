
const reg = /(?<type>\S+)(\s{(?<devices>\S+)\s(?<channels>\S+)\}(\s(?<val_1>\S+))?(\s(?<val_2>\S+))?)?/;


class NoneEvent{
	
	type = "none";
	
	static fromJSON(ob){
		const ev = new this();
		Object.assign(ev,ob);
		return ev;
	}
	
	toJSON(){
		return({type : this.type})
	}
	toString(){
		return `{${this.type}}`
	}
	
	static fromString(string){
		
		const matches = reg.exec(string);
		const groups = matches.groups;
		const ev = new this();
		
		// verify type
		if(groups?.type !== ev.type){
			throw new TypeError("Wrong event type when parsing Midish string");
		}
		
		ev._raw = groups;
		return ev;
	}
}

class AnyEvent extends NoneEvent{
	
	_devices;
	_channels;

	type = "any"
	
	constructor(){
		super();
		this.devices = null;
		this.channels = null;
	}
	
	set devices( value ){
		this._devices = RangeValue.fromSetter(value);
	}
	
	get devices(){
		return this._devices;
	}
	
	set channels( value ){
		this._channels = RangeValue.fromSetter(value);
	}
	
	get channels(){
		return this._channels;
	}
	
	toJSON(){
		const j = super.toJSON();
		j.devices = this.devices;
		j.channels = this.channels;
		return j;
	}
	
	toString(){
		return `{${this.type} {${this.devices} ${this.channels}}}`
	}
	
	static fromString(string){
		const ev = super.fromString(string)
		const raw_data = ev._raw;
		ev.devices = RangeValue.fromString( raw_data.devices );
		ev.channels = RangeValue.fromString( raw_data.channels );
		return ev;
	}
}

class BendEvent extends AnyEvent{
	type = "bend";
}

class NoteEvent extends AnyEvent{
	
	_notes;
	type = "note"
	
	constructor(){
		super();
		this.notes = null
	}
	
	set notes( value ){
		this._notes = RangeValue8b.fromSetter(value);
	}
	
	get notes(){
		return this._notes;
	}
	
	toJSON(){
		const j = super.toJSON();
		j.notes = this.notes;
		return j;
	}
	
	toString(){
		return `{${this.type} {${this.devices} ${this.channels}} ${this.notes}}`
	}
	
	static fromString(string){
		const ev = super.fromString(string)
		const raw_data = ev._raw;
		ev.notes = RangeValue8b.fromString( raw_data.val_1 );
		return ev;
	}
}

class CtlEvent extends AnyEvent{
	
	_controls;
	type = "ctl";
	
	constructor(){
		super();
		this.controls = null;
	}
	
	set controls( value ){
		this._controls = RangeValue8b.fromSetter(value);
	}
	
	get controls(){
		return this._controls;
	}
	
	toJSON(){
		const j = super.toJSON();
		j.controls = this.controls;
		return j;
	}
	
	toString(){
		return `{${this.type} {${this.devices} ${this.channels}} ${this.controls}}`
	}
	
	static fromString(string){
		const ev = super.fromString(string)
		const raw_data = ev._raw;
		ev.controls = RangeValue8b.fromString( raw_data.val_1 );
		return ev;
	}
}

class XctlEvent extends CtlEvent{
	type = "xctl"
}

class XpcEvent extends AnyEvent{

	_bank;
	_patch;
	type = "xpc";

	constructor(){
		super();
		this.bank = null;
		this.patch = null;
	}

	set bank( value ){
		this._bank = RangeValue14b.fromSetter(value);
	}

	get bank(){
		return this._bank;
	}

	set patch( value ){
		this._patch = RangeValue8b.fromSetter(value);
	}

	get patch(){
		return this._patch;
	}

	toJSON(){
		const j = super.toJSON();
		j.bank = this.bank;
		j.patch = this.patch;
		return j;
	}

	toString(){
		return `{${this.type} {${this.devices} ${this.channels}} ${this.bank} ${this.patch}}`
	}
	
	static fromString(string){
		const ev = super.fromString(string)
		const raw_data = ev._raw;
		ev.bank = RangeValue14b.fromString( raw_data.val_1 );
		ev.patch = RangeValue8b.fromString( raw_data.val_2 );
		return ev;
	}
}

class NrpnEvent extends AnyEvent{

	_param_number;
	type = "nrpn";

	constructor(){
		super();
		this.param_number = null;
	}

	set param_number( value ){
		this._param_number = RangeValue14b.fromSetter(value);
	}

	get param_number(){
		return this._param_number;
	}

	toJSON(){
		const j = super.toJSON();
		j.param_number = this.param_number;
		return j;
	}

	toString(){
		return `{${this.type} {${this.devices} ${this.channels}} ${this.param_number}}`
	}
	
	static fromString(string){
		const ev = super.fromString(string)
		const raw_data = ev._raw;
		ev.param_number = RangeValue14b.fromString( raw_data.val_1 );
		return ev;
	}
}

class RangeValue{
	
	_start = 0;
	_end = 0;
	
	min = 0;
	max = 15;
	
	constructor(){
		this.start = this.min;
		this.end = this.max;
	}
	
	set start(value){
		if( value < this.min || value > this.max ){
			throw new RangeError(`Event start value must be between ${this.min} and ${this.max}`);
		}
		this._start = value;
	}
	
	static fromSetter(value){
		
		const rv = new this();
		
		if( value === null ){
			 rv.start = rv.min;
			 rv.end = rv.max;
		}
		
		if( typeof value === "number" ){
			rv.start = rv.end = value;
		}
		
		if( typeof value === "object" ){
			Object.assign(rv, value)
		}
		
		return rv;
	}

	static fromString(string){
		const [start,end] = string.split("..").map(Number);
		const rv = new this();
		rv.start = start;
		rv.end = end;
		return rv;
	}

	get start(){
		return this._start
	}
	
	set end(value){
		if( value < this.min || value > this.max ){
			throw new RangeError(`Event end value must be between ${this.min} and ${this.max}`);
		}
		this._end = value;
	}
	
	get end(){
		return this._end
	}
	
	isSingleValue(){
		return this.start === this.end;
	}
	
	toString(){
		if( this.isSingleValue() ){
			return `${this.start}`;
		}
		else return `${this.start}..${this.end}`
	}
	
	toJSON(){
		return ( {
			start : this.start,
			end : this.end	
		} )
	}
}

class RangeValue8b extends RangeValue{
	max = 127;
}

class RangeValue14b extends RangeValue{
	max = 16383;
}

class RangeValueUnlimited extends RangeValue{
	max = Infinity;
}



const Types = {
	"none" : NoneEvent,
	"any" : AnyEvent,
	"bend" : BendEvent,
	"note" : NoteEvent,
	"ctl" : CtlEvent,
	"xctl" : XctlEvent,
	"xpc" : XpcEvent,
	"nrpn" : NrpnEvent,
}


function getConstructorByTypeName(name){
	return Types[name];
}

function hydrateEvent(object){
	const Type = getConstructorByTypeName(object.type);
	if(!Type){
		throw new TypeError("Could not parse Midish event type");
	}
	return Type.fromJSON(object);
}

function hydrateString(string){
	const type_name = reg.exec(string)?.groups?.type;
	const Type = getConstructorByTypeName(type_name);
	if(!Type){
		throw new TypeError("Could not parse Midish event type");
	}
	return Type.fromString(string);
}


module.exports = {
	hydrateEvent,
	hydrateString,
	RangeValueUnlimited,
	
	NoneEvent,
	AnyEvent,
	BendEvent,
	NoteEvent,
	CtlEvent,
	XctlEvent,
	XpcEvent,
	NrpnEvent,
	
	Types,
	getConstructorByTypeName
}
