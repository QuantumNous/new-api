/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Ivan Kopeykin @vankop
*/

"use strict";

const path = require("path");
const DescriptionFileUtils = require("./DescriptionFileUtils");
const forEachBail = require("./forEachBail");
const { processImportsField } = require("./util/entrypoints");
const { parseIdentifier } = require("./util/identifier");
const { checkImportsExportsFieldTarget } = require("./util/path");

/** @typedef {import("./Resolver")} Resolver */
/** @typedef {import("./Resolver").JsonObject} JsonObject */
/** @typedef {import("./Resolver").ResolveRequest} ResolveRequest */
/** @typedef {import("./Resolver").ResolveStepHook} ResolveStepHook */
/** @typedef {import("./util/entrypoints").FieldProcessor} FieldProcessor */
/** @typedef {import("./util/entrypoints").ImportsField} ImportsField */

const dotCode = ".".charCodeAt(0);

module.exports = class ImportsFieldPlugin {
	/**
	 * @param {string | ResolveStepHook} source source
	 * @param {Set<string>} conditionNames condition names
	 * @param {string | string[]} fieldNamePath name path
	 * @param {string | ResolveStepHook} targetFile target file
	 * @param {string | ResolveStepHook} targetPackage target package
	 */
	constructor(
		source,
		conditionNames,
		fieldNamePath,
		targetFile,
		targetPackage
	) {
		this.source = source;
		this.targetFile = targetFile;
		this.targetPackage = targetPackage;
		this.conditionNames = conditionNames;
		this.fieldName = fieldNamePath;
		/** @type {WeakMap<JsonObject, FieldProcessor>} */
		this.fieldProcessorCache = new WeakMap();
	}

	/**
	 * @param {Resolver} resolver the resolver
	 * @returns {void}
	 */
	apply(resolver) {
		const targetFile = resolver.ensureHook(this.targetFile);
		const targetPackage = resolver.ensureHook(this.targetPackage);

		resolver
			.getHook(this.source)
			.tapAsync("ImportsFieldPlugin", (request, resolveContext, callback) => {
				// When there is no description file, abort
				if (!request.descriptionFilePath || request.request === undefined) {
					return callback();
				}

				const remainingRequest =
					request.request + request.query + request.fragment;
				const importsField =
					/** @type {ImportsField|null|undefined} */
					(
						DescriptionFileUtils.getField(
							/** @type {JsonObject} */ (request.descriptionFileData),
							this.fieldName
						)
					);
				if (!importsField) return callback();

				if (request.directory) {
					return callback(
						new Error(
							`Resolving to directories is not possible with the imports field (request was ${remainingRequest}/)`
						)
					);
				}

				/** @type {string[]} */
				let paths;

				try {
					// We attach the cache to the description file instead of the importsField value
					// because we use a WeakMap and the importsField could be a string too.
					// Description file is always an object when exports field can be accessed.
					let fieldProcessor = this.fieldProcessorCache.get(
						/** @type {JsonObject} */ (request.descriptionFileData)
					);
					if (fieldProcessor === undefined) {
						fieldProcessor = processImportsField(importsField);
						this.fieldProcessorCache.set(
							/** @type {JsonObject} */ (request.descriptionFileData),
							fieldProcessor
						);
					}
					paths = fieldProcessor(remainingRequest, this.conditionNames);
				} catch (/** @type {unknown} */ err) {
					if (resolveContext.log) {
						resolveContext.log(
							`Imports field in ${request.descriptionFilePath} can't be processed: ${err}`
						);
					}
					return callback(/** @type {Error} */ (err));
				}

				if (paths.length === 0) {
					return callback(
						new Error(
							`Package import ${remainingRequest} is not imported from package ${request.descriptionFileRoot} (see imports field in ${request.descriptionFilePath})`
						)
					);
				}

				forEachBail(
					paths,
					/**
					 * @param {string} p path
					 * @param {(err?: null|Error, result?: null|ResolveRequest) => void} callback callback
					 * @returns {void}
					 */
					(p, callback) => {
						const parsedIdentifier = parseIdentifier(p);

						if (!parsedIdentifier) return callback();

						const [path_, query, fragment] = parsedIdentifier;

						const error = checkImportsExportsFieldTarget(path_);

						if (error) {
							return callback(error);
						}

						switch (path_.charCodeAt(0)) {
							// should be relative
							case dotCode: {
								/** @type {ResolveRequest} */
								const obj = {
									...request,
									request: undefined,
									path: path.join(
										/** @type {string} */ (request.descriptionFileRoot),
										path_
									),
									relativePath: path_,
									query,
									fragment
								};

								resolver.doResolve(
									targetFile,
									obj,
									"using imports field: " + p,
									resolveContext,
									callback
								);
								break;
							}

							// package resolving
							default: {
								/** @type {ResolveRequest} */
								const obj = {
									...request,
									request: path_,
									relativePath: path_,
									fullySpecified: true,
									query,
									fragment
								};

								resolver.doResolve(
									targetPackage,
									obj,
									"using imports field: " + p,
									resolveContext,
									callback
								);
							}
						}
					},
					/**
					 * @param {null|Error} [err] error
					 * @param {null|ResolveRequest} [result] result
					 * @returns {void}
					 */
					(err, result) => callback(err, result || null)
				);
			});
	}
};
