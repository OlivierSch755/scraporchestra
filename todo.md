# Current task 


--------

## CLIENT

* ⬜️ 	Do something on client when ws connection lost.
* ⬜️ 	Decide how / when we close dialogs after submitting stuff in UI. It's not consistent.

## SUSHI 

* ⬜️	Engine will crash if sushi is already running when loading project (technically it's just about catching error now since state is handled)

			see : 
			```
				EngineDegradedError {
					message: 'Engine could not close project properly.',
					cause: ProjectNotOpenedError {
					message: 'Cannot close a project that has not been initialized'
					...
			```
			
* ⬜️	Explore whether webapp could easily enable / disable [bluetooth audio streaming](https://elk-audio.github.io/elk-docs/html/embedded/working_with_elk_board.html#bluetooth-audio-streaming).

### Stuff to maybe report 

* ⬜️ 	DisconnectAllInputs does seem to disconnect only first input instead of all. Not sure if this is my implementation or sushi itself. Need to investigate. 
	
* ⬜️ 	Setting a CC on a track or processor that is above 119 (Channel Mode Messages) will crash Sushi
	*	See https://anotherproducer.com/online-tools-for-musicians/midi-cc-list/ section Channel Mode Messages

### EDITOR 

* ⬜️	Should implement a MIDI "All Sound Off" command somewhere (CC 120) 


#### UI

* ⬜️	Adding audio connection dialog modal do not close on success
* ⬜️	Bool parameters are crazy
* ⬜️	Parameters implementation in general need more thinking (int vs float..., do something with domain values ?)
* ⬜️	Would be nice to get a list of copy/pastable OSC addresses 

## PURE DATA

* ⬜️	Pure data editor is kinda hacky, see if something better can be done. 
	*	Bela project has a web based editor but
		*	I'm not sure it's very maintained. 
		*	It's only replicating pure data UI in a webpage (not mobile friendly, probably even less acessible).
		*	Pretty sure it needs locking pure data version. I've seen the pd-gui protocol have gaps between versions that make free upgrading unlikely.  

## MIDI CONNECTIONS

* ⬜️	Should filter out connections events from midish-bridge inner ports

* ⬜️	Stale state on component deletion : 
	*	Add pure data to project
	*	Add midish -> pd midi link to config
	*	Remove pd from project
	*	component error (expected)
	*	but remove midish -> pd midi link from config
	*	still error ??
	*	(Not even sure I can replicate that 100% of the time.)

## COMPONENTS

* ⬜️	Maybe should pgrep binaries before launching projects to make sure Sushi is not already running & such. Would avoid some trouble but may cause more.

* ⬜️	Need to guard against a lot of user actions. You can definitely crash stuff by clicking on close project while project is still loading. 

## ENGINE CORE

* ⬜️	Project still does not react to its component state changing mid flight.

* ⬜️	Work on engine "degraded" state


## PROJECT LIST
	
* ⬜️	Need a feature for cloning a project

## MIDISH (MIDI TRANSPORT)

* ✅		Add midish as a component and add a tiny UI
	* loop mode
	* basic edition maybe ? 
	* mute tracks

* ⬜️	Filters edition 

* ⬜️ 	Bug : sometimes on project load, session will not correctly populate the UI (rare)

* ⬜️	 Slave mode need more work

## A bit more OSC

* ⬜️ 	At least midish component would greatly benefit from being able to receive some OSC commands
	*	a simple play / pause cmd would be useful in many situations


## About networking 

At some point it would be nice to have some convenience features regarding network configuration. 

If I recall correctly, Volumio does roughly this to ensure network availability : 
* If a wired ethernet cable provides network, use that. 
* Otherwise try to connect to a known wifi.
* Fallback to creating local wifi hotspot with hostapd.

Elk Audio also provides a network configuration utility over bluethooth. I have had no success with it so far but if I do, I should document it. 



## DISTRIBUTION 

* ⬜️ 	Do a release at some point. This will need more thinking about licencing. It would be convenient to package all components in one go instead of relying on makefiles but that requires careful inspection.

