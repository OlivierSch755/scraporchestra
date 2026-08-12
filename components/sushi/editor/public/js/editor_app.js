import Alpine from '/js/lib/alpine.js';
import '/js/lib/alpine_global.js';

import './stores/status.js';
import './stores/sushi.js';
import './stores/parameterlist.js';
import './stores/api.js';
import './stores/plugins.js';
import './stores/midi.js';
import './stores/transport.js';
import './stores/audioconnections.js';
import './stores/track.js';

import './events/processor_updates.js';
import './events/track_updates.js';
import './events/parameter_updates.js';
import './events/property_updates.js';
import './events/transport_updates.js';

Alpine.start();
window.Alpine = Alpine;