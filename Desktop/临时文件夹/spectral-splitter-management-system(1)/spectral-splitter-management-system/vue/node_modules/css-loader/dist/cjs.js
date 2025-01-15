"use strict";

const loader = require("./index");
module.exports = loader.default;
module.exports.defaultGetLocalIdent = require("./utils").defaultGetLocalIdent;