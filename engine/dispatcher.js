// global app event emitter

const {EventEmitter} = require("node:events");
const Dispatcher = new EventEmitter();

module.exports = Dispatcher;