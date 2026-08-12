# MIDI CONNECTIONS Component

**midi_connections** component is a session-oriented MIDI connection manager inspired by [midiminder](github.com/mzero/midiminder)

It does the following : 
* Expose available MIDI ports (anything that may be connected using ```aconnect```)
* Provide an API to create / remove connections. 
* Remember connections layout upon project reload. 
* Reconnect MIDI port automatically.
* Warn & Notify if any MIDI connection is missing. 


## Build 

To compile and install this, run ```make``` from this directory. 

It will compile a small custom utility ```/src/alsa_watch.c``` into ```/bin/alsa_watch```


## How does it work

When initializing during project load, this component spawns alsa_watch C utility.

The latter does nothing but subscribe to *asoundlib snd_seq* and print graph edges. 

The Node.js runtime reads (via sdtout) those graph edges and maintains a representation of the ALSA MIDI Sequencer graph state. It compares this inner graph to a user-defined set of *rules* that represents which MIDI connections are needed for the project. 

### Example of user-defined rule

```json
{
  "rules": [
    {
      "sender_client_name": "Oxygen 49",
      "sender_port_name": "Oxygen 49 MIDI 1",
      "receiver_client_name": "Sushi",
      "receiver_port_name": "listen:in",
      "optional": false
    }
  ]
}
```

This rule indicates that current project requires an Oxygen49 MIDI keyboard being connected to Sushi MIDI input. 

A rule can be flagged as optional. It means it will not throw a warning even if the connection it represents could not be made. This feature should be used for scenarios like: 
* You have a *light* and a *complete* version of a setup, the light version does not includes as many MIDI instruments as the complete one. 
* You want a friend to occasionally plug their MIDI instrument and join the music (drop-in/drop-out)
    * Project will recognize their device and do automatic reconnection
    * but project will not complain that MIDI instrument is missing after friend went back home.  



### Reacting to graph edges

When a graph edge occurs (that is to say when a USB MIDI device is connected, or when a software exposes a new virtual MIDI port), the updated graph is matched against the current set of rules. If any of the new port matches an existing rules, the connection is automatically made using a ```aconnect``` command.  

Graph edges may also represent a USB device being disconnected (or a software exposing a virtual MIDI port exiting). If this event invalidates a rule, the component will dispatch an **ERROR** event to notify that the expected connection graph is not (or no longer) fulfilled. 

When each and every rule is fulfilled, midi_connections component emits a **READY** event to notify that from *its point of view*, the project is safe for hitting play and start doing some music. 



## Lifecycle
### Installation phase
* Nothing

### Initialization phase
* ```bin/alsa_watch``` executable is spawned as a child process. 

### Save project phase
No action. 

### Close phase 
* Terminates alsa_watch process. 

## Config data 
User-defined rules are stored in the project config file. 

## Session data 
No session data.


## Caveats

MIDI ports are matched by name. This component will probably misbehave a lot if multiple devices or softwares expose non-unique names. 