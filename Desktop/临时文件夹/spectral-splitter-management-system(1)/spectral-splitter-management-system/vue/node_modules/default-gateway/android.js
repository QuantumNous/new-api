"use strict";

const {isIP} = require("net");
const execa = require("execa");

const args = {
  v4: ["-4", "r"],
  v6: ["-6", "r"],
};

const parse = stdout => {
  let result;

  (stdout || "").trim().split("\n").some(line => {
    const [_, gateway, iface] = /default via (.+?) dev (.+?)( |$)/.exec(line) || [];
    if (gateway && isIP(gateway)) {
      result = {gateway, interface: (iface ? iface : null)};
      return true;
    }
  });

  if (!result) {
    throw new Error("Unable to determine default gateway");
  }

  return result;
};

const promise = async family => {
  const {stdout} = await execa("ip", args[family]);
  return parse(stdout, family);
};

const sync = family => {
  const {stdout} = execa.sync("ip", args[family]);
  return parse(stdout);
};

module.exports.v4 = () => promise("v4");
module.exports.v6 = () => promise("v6");

module.exports.v4.sync = () => sync("v4");
module.exports.v6.sync = () => sync("v6");
