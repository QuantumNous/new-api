/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Maël Nison @arcanis
*/

"use strict";

/** @typedef {import("./Resolver")} Resolver */
/** @typedef {import("./Resolver").ResolveStepHook} ResolveStepHook */
/** @typedef {import("./Resolver").ResolveRequest} ResolveRequest */
/**
 * @typedef {Object} PnpApiImpl
 * @property {function(string, string, object): string} resolveToUnqualified
 */

module.exports = class PnpPlugin {
	/**
	 * @param {string | ResolveStepHook} source source
	 * @param {PnpApiImpl} pnpApi pnpApi
	 * @param {string | ResolveStepHook} target target
	 */
	constructor(source, pnpApi, target) {
		this.source = source;
		this.pnpApi = pnpApi;
		this.target = target;
	}

	/**
	 * @param {Resolver} resolver the resolver
	 * @returns {void}
	 */
	apply(resolver) {
		/** @type {ResolveStepHook} */
		const target = resolver.ensureHook(this.target);
		resolver
			.getHook(this.source)
			.tapAsync("PnpPlugin", (request, resolveContext, callback) => {
				const req = request.request;
				if (!req) return callback();

				// The trailing slash indicates to PnP that this value is a folder rather than a file
				const issuer = `${request.path}/`;

				const packageMatch = /^(@[^/]+\/)?[^/]+/.exec(req);
				if (!packageMatch) return callback();

				const packageName = packageMatch[0];
				const innerRequest = `.${req.slice(packageName.length)}`;

				/** @type {string|undefined} */
				let resolution;
				/** @type {string|undefined} */
				let apiResolution;
				try {
					resolution = this.pnpApi.resolveToUnqualified(packageName, issuer, {
						considerBuiltins: false
					});
					if (resolveContext.fileDependencies) {
						apiResolution = this.pnpApi.resolveToUnqualified("pnpapi", issuer, {
							considerBuiltins: false
						});
					}
				} catch (/** @type {unknown} */ error) {
					if (
						/** @type {Error & { code: string }} */
						(error).code === "MODULE_NOT_FOUND" &&
						/** @type {Error & { pnpCode: string }} */
						(error).pnpCode === "UNDECLARED_DEPENDENCY"
					) {
						// This is not a PnP managed dependency.
						// Try to continue resolving with our alternatives
						if (resolveContext.log) {
							resolveContext.log(`request is not managed by the pnpapi`);
							for (const line of /** @type {Error} */ (error).message
								.split("\n")
								.filter(Boolean))
								resolveContext.log(`  ${line}`);
						}
						return callback();
					}
					return callback(/** @type {Error} */ (error));
				}

				if (resolution === packageName) return callback();

				if (apiResolution && resolveContext.fileDependencies) {
					resolveContext.fileDependencies.add(apiResolution);
				}
				/** @type {ResolveRequest} */
				const obj = {
					...request,
					path: resolution,
					request: innerRequest,
					ignoreSymlinks: true,
					fullySpecified: request.fullySpecified && innerRequest !== "."
				};
				resolver.doResolve(
					target,
					obj,
					`resolved by pnp to ${resolution}`,
					resolveContext,
					(err, result) => {
						if (err) return callback(err);
						if (result) return callback(null, result);
						// Skip alternatives
						return callback(null, null);
					}
				);
			});
	}
};
