# SUSHI Component

**sushi** component wraps around [Elk Audio Sushi](https://github.com/elk-audio/sushi) engine using GRPC.

Elk Audio OS is specifically designed to provide a low-latency kernel for Sushi (DSP engine & plugin host). 
Node.js runtime uses GRPC to manage Sushi and expose its features via the webUi. 

## Build 

As ScrapOrchestra is primarily intended to be used on ELK-Pi releases (which already includes sushi binaries), there is no build recipe here. 

However, as there are some minor bugs in current (1.2.0) release of Sushi that can hinder the component functions, you *may* find yourself needing to compile a version that is still in the ```develop``` branch of Sushi. See below for some examples : 

<details>

<summary>Crashes when Saving session</summary>

Sushi current version (1.2.0) has a known bug where some vst2X being present will cause Segfault upon saving session. 

This is fixed in commit [1574bc47](https://github.com/elk-audio/sushi/commit/1574bc47a085666449e27fef87bf181363ec7938)
So using ELK SDK you can already do something like this : (provided you got a working vst2sdk)

```sh
git clone https://github.com/elk-audio/sushi.git --recursive
git checkout develop
git submodule update --init --recursive
git checkout -b elk-vst2-fix 1574bc47
cmake   -DCMAKE_BUILD_TYPE=Release   -DSUSHI_AUDIO_BUFFER_SIZE=64   -DSUSHI_WITH_VST2=on   -DSUSHI_WITH_VST3=on   -DSUSHI_WITH_LV2=on   -DSUSHI_WITH_RASPA=on  -DSUSHI_LINK_WITH_PIPEWIRE=on  -DSUSHI_WITH_RPC_INTERFACE=on   -DSUSHI_WITH_LINK=on   -DSUSHI_WITH_UNIT_TESTS=off  -DSUSHI_VST2_SDK_PATH=path/to/sdk  ..
```

And then it is only a matter of moving the produced binary into ```/usr/bin/sushi_b64``` (or whatever buffer size you picked).

</details>


## Editor mode

User can manually start the editor mode of this component. 
Doing this will dynamically start a whole proxy/gateway API along the main Sushi process.
It does not require restarting Sushi. 

This enables webUi user to edit Sushi audio graph in real time, which greatly facilitates tasks like : 
* add / remove tracks
* inspect / edit audio routing
* inspect / edit midi routing 
* add / remove processors
* inspect / edit processor parameters and properties 
* interact with transport controller (tempo, time signature, play pause...)

To know more about the editor functions you should check its dedicated [readme](editor). 



## Lifecycle

### Installation phase
* Default configuration file ```empty.json``` is copied into the project directory as ```sushi_config.json```. 
    * This is exactly the ```empty.json``` usually found in ```/home/mind/config_files/empty.json```. 
    * You could edit it if you need a different default config when installing Sushi in a new project. 


### Initialization phase
* ```sushi``` executable is spawned as a child process. 
* It receives via command-line arguments : 
    * path to project ```sushi_config.json``` file 
    * optional directive to change OSC send port
    * optional directive to set audio driver (RASPA ```-r``` is the default setting and is currently not selectable anywhere)
* Child process is spawned with environment variables that can be set from the webUi. 
* Node.js runtime uses grpc-js implementation of ```client.waitForReady()``` as a signal that Sushi is done loading. 
* Once Sushi GRPC server is live, component performs a basic handshake by calling ```SystemController.GetSushiApiVersion()``` and verifies the API version matches its internal version. 
* If a file named ```sushi_session.bin``` exists in the project directory, it will be read and fed into Sushi via GRPC ```SessionController.RestoreSession(...)```.
* Send Ready event if everything succeeded. 


### Save project phase
Calls GRPC ```SessionController.saveSession(...)``` and save the binary data as ```sushi_session.bin``` in project directory. 

### Close phase 
* Terminates Sushi process. 
* Clear editor resources if opened. 

## Config data 
The following entries may be stored in the project configuration: 
* Audio driver (this is actually not implemented in the UI and should move to a global Sushi config in the future, so avoid relying on it)
* OSC send port ```--osc-send-port```
* User-defined environment variables

Not implemented yet: 
* Allow UI to edit the number of MIDI ports (via editing of ```sushi_config.json```)
* OSC receive port ```--osc-rcv-port```
* OSC receive port ```--osc-send-ip```
* Multicore ```--multicore-processing```

## Session data 
Component session is saved in project directory in a single file: ```sushi_session.bin```

