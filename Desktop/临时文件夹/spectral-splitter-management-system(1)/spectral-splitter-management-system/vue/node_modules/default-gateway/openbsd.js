"use strict";

const {isIP} = require("net");
const execa = require("execa");
const dests = new Set(["default", "0.0.0.0", "0.0.0.0/0", "::", "::/0"]);

const args = {
  v4: ["-rn", "-f", "inet"],
  v6: ["-rn", "-f", "inet6"],
};

const parse = stdout => {
  let result;

  (stdout || "").trim().split("\n").some(line => {
    const results = line.split(/ +/) || [];
    const target = results[0];
    const gateway = results[1];
    const iface = results[7];
    if (dests.has(target) && gateway && isIP(gateway)) {
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
  const {stdout} = await execa("netstat", args[family]);
  return parse(stdout);
};

const sync = family => {
  const {stdout} = execa.sync("netstat", args[family]);
  return parse(stdout);
};

module.exports.v4 = () => promise("v4");
module.exports.v6 = () => promise("v6");

module.exports.v4.sync = () => sync("v4");
module.exports.v6.sync = () => sync("v6");
