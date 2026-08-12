# COMPONENTS 

In ScrapOrchestra, a **component** is a Node.js wrapper that manages another executable during the lifetime of a **project**.

A component's lifecycle has several common phases: 
* **Installation**, usually creating a default config and, optionally, a default session file in the project directory.
* **Initialization**, when the project starts, spawning the managed process, bootstrapping its configuration, and restoring a session.
* **Close**, all components are expected to gracefully terminate their managed processes when the parent project is closed.


A component may also be expected to:
* **Save** session data in the project directory so it may be recovered later. 
* **Save** its config in the project config file. 
* **Notify** the engine of errors that may occur during the component's lifetime. These may be startup errors (for example, a missing file) or runtime errors (for example, the managed process crashing).
* **Enter a optional editor mode** to help user configure component session. 

To use components, ScrapOrchestra engine relies on a common class definition ([base class](/engine/component/component.js), and its [extended version for external processes](/engine/component/process.js)) which acts as an instance factory for each project runtime. 



## Building components 
Components that need to build C code should have their own Makefile implementing:
* ```make``` download (if needed) and compile source code.
* ```make clean``` remove build artifacts and source code.
* ```make distclean``` remove compiled binaries, build artifacts, source code.

For example, you can navigate to the ```./midish``` subdirectory and run ```make``` to enable the **Midish** component for use in ScrapOrchestra projects.


The ``components`` directory also has its own Makefile, which can perform these operations for all components with a single command.

Each component should have its own README.md describing its mode of operation. Navigate to the respective component directory for more information.

> [!CAUTION]
> Removing components is not supported. If one of your projects require a specific component and you uninstall it with ```make distclean``` (or remove its installation files), the ScrapOrchestra engine will not prevent you from trying to load that project. This will result in an error.

## Session data vs. config data 

There are two places where a component may store persisted data: *Config data* and *Session data*.

Those are not the same thing from the component perspective. 

### Config data

Component *config data* is stored in the Project config file **project.json**. 

This file not only determines which components are installed in a project, but also provides a small data store for primitive values that are immediately needed to spawn a component process.

That is to say things like : 
* command-line arguments 
* environment variables

These definitely belong in the component's *config data*. 

Config data is made available by the engine as a plain javascript object. Components can freely edit it and the engine will automatically persist it when saving a project. 

### Session data

On the other hand *session data* represents local data used by the managed process. It usually exists in formats other than JSON and can have a larger memory footprint. 

The Engine has no knowledge of how this data should be recovered or fed back into the managed process. Loading and persisting this data is therefore the responsibility of the component. 

Loading session data should happen during the **initialization phase**. 

For example:
* a Sushi binary session saved on the filesystem
* a Midish session file (.msh) saved on the filesystem

These should be treated as *session data*.


## More stuff planned for the future 


### Small OSC transport 

Some components features would be greatly enriched if we did expose a small OSC server in addition to the regular web server. 

*Yes Sushi and PureData already have native OSC capabilities that are very convenient.*

But imagine being able to send a play / record command to Midish over OSC. How cool would that be.


