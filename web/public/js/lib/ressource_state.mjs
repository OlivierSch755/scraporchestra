var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var require_states = __commonJS({
  "../engine/states.js"(exports, module) {
    const RessourceState = {
      ERROR: 1,
      LOADING: 2,
      READY: 3,
      CLOSING: 4,
      CLOSED: 5
    };
    function validateState(state) {
      if (!Object.values(RessourceState).includes(state)) throw new TypeError("Invalid RessourceState : " + state);
    }
    module.exports = {
      RessourceState,
      validateState
    };
  }
});
export default require_states();
