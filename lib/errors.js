class ScrapOrchestraError extends Error {
    constructor(code, message, options) {
        super(message, options);
        this.name = this.constructor.name;
        this.code = code;
    }
}

module.exports = {
    ScrapOrchestraError
};