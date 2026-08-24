#!/usr/bin/env node

const repl = require('node:repl');
const util = require('node:util');
const path = require('node:path');

const Engine = require("./../engine.js");
const engine = new Engine();


console.log(`---------------- ENGINE CLI ----------------`);
console.log(engine);

const r = repl.start();

const historyFile = path.join(__dirname, '.repl_history');
r.setupHistory(historyFile, () => {});


Object.assign(r.context, {
  Engine, engine
});