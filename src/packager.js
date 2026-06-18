/* eslint-disable max-len, max-lines-per-function, max-lines, complexity, no-console */

//Imports
const { extname, resolve, relative } = require('path');
const { readdir, readFile, writeFile } = require('fs').promises;
require('colors');

//Helpers
const recurseProcessMda = require('./packager/recurseProcessMda');
const markStaticAndPure = require('./packager/markStaticAndPure');

//Stage timing instrumentation
const stageTimings = [];
let stageMarkRef = process.hrtime.bigint();
const markStage = label => {
	const now = process.hrtime.bigint();
	stageTimings.push([label, Number(now - stageMarkRef) / 1e6]);
	stageMarkRef = now;
};
const resetStageClock = () => {
	stageMarkRef = process.hrtime.bigint();
};

const args = Object.fromEntries(
	process.argv.slice(2)
		.filter(e => e.indexOf('--') === 0)
		.map(e => {
			const [rawKey, value] = e.split('=');
			const key = rawKey.substr(2);

			return [
				key,
				value
			];
		})
);

const ignoreFolders = [
	'.git'
];

//Internals
let osSlash = '/';
let opusUiConfig;
let ensembleNames;
let remappedPaths = [];
//Resident state for watch-mode incremental rebuilds (populated by each full build).
let fileLocations = new Map();
let live = null;

//Canonical key for a file path, so chokidar paths and packager paths always match.
const normPath = p => {
	const abs = resolve(p).replaceAll('\\', '/');

	return osSlash === '\\' ? abs.toLowerCase() : abs;
};

const excludeEnsembles = args.excludeEnsembles === 'true';
const includePaths = args.includePaths === 'true';
const generateTestIds = args.generateTestIds === 'true';
const watch = ('watch' in args) && args.watch !== 'false';

const opusUiConfigFileName = '.opusUiConfig';
const opusUiConfigKeys = ['opusPackagerConfig', 'opusUiComponentLibraries', 'opusUiEnsembles', 'opusUiColorThemes'];

//Helpers
const remapPath = (path, couldContainEnsembles) => {
	if (!couldContainEnsembles || path === 'node_modules')
		return path;

	if (path.includes('node_modules')) {
		const subPath = path.substr(path.indexOf('node_modules') + 13);
		const hasEnsembleEntry = ensembleNames.some(f => f.path.includes(subPath) || subPath.includes(f.path));
		if (!hasEnsembleEntry)
			return;

		return path;
	}

	const possibleEnsembleEntry = ensembleNames.find(f => f.path.includes(path) || path.includes(f.path));
	if (!possibleEnsembleEntry)
		return;

	if (possibleEnsembleEntry.external && possibleEnsembleEntry.path === path) {
		remappedPaths.push({
			path,
			remappedPath: path.replace(possibleEnsembleEntry.path, `dashboard${osSlash}@${possibleEnsembleEntry.name}`)
		});
	}

	return path;
};

/* eslint-disable-next-line func-style */
async function* getFiles (path, couldContainEnsembles) {
	const config = opusUiConfig.opusPackagerConfig;
	let mappedPath = remapPath(path, couldContainEnsembles);
	if (!mappedPath)
		return;

	let dirents;
	try {
		dirents = await readdir(mappedPath, { withFileTypes: true });
	} catch (err) {
		if (err.code === 'ENOENT')
			return;

		throw err;
	}
	for (let i = 0, len = dirents.length; i < len; i++) {
		const dirent = dirents[i];
		const fullPath = resolve(mappedPath, dirent.name);

		if (dirent.isDirectory()) {
			if (dirent.name.indexOf('node_modules') !== -1 && config.isEnsemble)
				continue;
			else if (ignoreFolders.indexOf(dirent.name) !== -1)
				continue;
			else if (dirent.name === config.packagedDir)
				continue;

			yield* getFiles(fullPath, couldContainEnsembles);
		} else {
			if (extname(fullPath) !== '.json')
				continue;
			else if (fullPath.indexOf(config.packagedFileName + '.json') !== -1)
				continue;
			else if (fullPath.indexOf('package.json') !== -1)
				continue;
			else if (fullPath.indexOf('package-lock.json') !== -1)
				continue;

			yield fullPath;
		}
	}
}

const init = async useOpusUiConfig => {
	if (`${process.cwd()}`.includes('\\'))
		osSlash = '\\';
	else
		osSlash = '/';

	ensembleNames = (useOpusUiConfig.opusUiEnsembles ?? []).map(f => {
		const fixedPath = (f.path ?? f).replaceAll('/', osSlash).replaceAll('\\', osSlash);

		return {
			external: f.external,
			name: f.name ?? f,
			path: fixedPath
		};
	});
};

const setPathsOnComponents = (rootObj, path) => {
	const stack = [rootObj];

	while (stack.length > 0) {
		const currentObj = stack.pop();

		if (includePaths || currentObj.type === 'viewport') {
			if (!currentObj.prps)
				currentObj.prps = {};

			currentObj.prps.path = path.replaceAll('\\', '/');
		}

		for (const key of Object.keys(currentObj)) {
			const value = currentObj[key];

			if (
				typeof value === 'object' &&
				value !== null &&
				(
					value.prps !== undefined ||
					value.acceptPrps !== undefined ||
					value.traits !== undefined ||
					key === 'wgts'
				)
			)
				stack.push(value);
		}
	}
};

const processDir = async (dir, cwd, res, couldContainEnsembles = false) => {
	const tasks = [];

	for await (let path of getFiles(`${dir}`, couldContainEnsembles)) {
		const task = (async () => {
		 	let file = (await readFile(path, 'utf-8')).replace(/[\r\n\t]/g, '');

			let keyPath = path;
			let isRemapped = false;

			if (ensembleNames.some(f => path.includes(f.path + osSlash))) {
				const remapped = remappedPaths.find(f => path.includes(f.path));
				if (remapped) {
					isRemapped = true;
					keyPath = `${remapped.remappedPath}${osSlash}${path.replace(remapped.path + osSlash, '')}`;
				} else
					keyPath = `dashboard${osSlash}@${path.replace(cwd + osSlash, '')}`;
			}
			keyPath = keyPath.replace(cwd, '');

			if (!path.includes(`${osSlash}theme${osSlash}`) && opusUiConfig.opusPackagerConfig.isEnsemble)
				keyPath = `dashboard\\@${opusUiConfig.opusPackagerConfig.ensembleName}\\${keyPath}`;

			// Break the keyPath into directory segments and a final key.
			const dirs = keyPath.split(/\/|\\/);
			const key = dirs.pop();

			let ensembleIsInDist = false;
			if (dirs[2] === 'dist') {
				// Skip if remapped (to avoid overriding local changes).
				if (isRemapped)
					return;

				ensembleIsInDist = true;
				dirs.splice(2, 1);
			}

			//Remember where this file lands so a watch-mode change can re-splice it in place.
			fileLocations.set(normPath(path), { keyPath, dirs: dirs.slice(), key });

			// Walk through the directory structure on the `res` object.
			let accessor = res;
			dirs.forEach(d => {
				if (!accessor[d])
					accessor[d] = {};

				accessor = accessor[d];
			});

			// Parse the file content.
			let json;
			try {
				json = JSON.parse(file);
			} catch {
				json = {
					acceptPrps: {},
					type: 'label',
					prps: { cpt: `'${path}' is not valid JSON` }
				};
			}

			//Optionally set paths on the JSON components (always on viewports)
			setPathsOnComponents(json, keyPath);

			accessor[key] = json;

			if (ensembleIsInDist && dirs.length === 2 && key === 'config.json')
				json.ensembleIsInDist = true;
		})();

		tasks.push(task);
	}

	await Promise.all(tasks);

	return tasks.length;
};

const isObjectLiteral = value => {
	const res = typeof value === 'object' && value !== null && !Array.isArray(value);

	return res;
};

const buildExternalOpusUiConfigPath = opusAppPackageValue => {
	const defaultPath = opusUiConfigFileName;

	if (!opusAppPackageValue.opusUiConfig || !isObjectLiteral(opusAppPackageValue.opusUiConfig))
		return defaultPath;

	let externalOpusUiConfig = opusAppPackageValue.opusUiConfig.externalOpusUiConfig;
	if (!externalOpusUiConfig || typeof externalOpusUiConfig !== 'string')
		return defaultPath;

	return externalOpusUiConfig;
};

const getOpusUiConfigFile = async externalOpusUiConfigPath => {
	let externalOpusUiConfig = null;

	try {
		const fetchedExternalOpusUiConfig = await readFile(externalOpusUiConfigPath, 'utf-8');
		if (!fetchedExternalOpusUiConfig)
			throw new Error();

		externalOpusUiConfig = JSON.parse(fetchedExternalOpusUiConfig);
	} catch {}

	if (!isObjectLiteral(externalOpusUiConfig))
		return null;

	return externalOpusUiConfig;
};

const buildOpusUiConfig = async opusAppPackageValue => {
	const res = {};

	// Start with opusUiConfig entries from package.json
	opusUiConfigKeys.forEach(k => {
		if (opusAppPackageValue[k])
			res[k] = opusAppPackageValue[k];
	});

	if (
		opusAppPackageValue.opusUiConfig &&
		isObjectLiteral(opusAppPackageValue.opusUiConfig)
	) {
		// Override opusUiConfig entries with those from opusUiConfig object in package.json
		opusUiConfigKeys.forEach(k => {
			if (opusAppPackageValue.opusUiConfig[k])
				res[k] = opusAppPackageValue.opusUiConfig[k];
		});
	}

	const externalOpusUiConfigPath = buildExternalOpusUiConfigPath(opusAppPackageValue);

	const externalOpusUiConfigData = await getOpusUiConfigFile(externalOpusUiConfigPath);

	if (externalOpusUiConfigData) {
		// Override opusUiConfig entries with those from external opusUiConfig file
		opusUiConfigKeys.forEach(k => {
			if (externalOpusUiConfigData[k])
				res[k] = externalOpusUiConfigData[k];
		});
	}

	return res;
};

//Serialize the assembled package and write it to disk.
const writeOutput = async (res, packagedDir, packagedFileName) => {
	let packagedFileContents = JSON.stringify(res);
	markStage('JSON.stringify');

	if (args.output === 'js')
		packagedFileContents = `/* eslint-disable */ const app = ${packagedFileContents}; export default app;`;

	await writeFile(`${packagedDir}/${packagedFileName}`, packagedFileContents);
	markStage('writeFile');

	return packagedFileContents;
};

//Print the per-stage timing breakdown for one build.
const printBreakdown = (totalFilesProcessed, bundleCount, packagedFileContents, elapsedMs) => {
	const breakdownTotal = stageTimings.reduce((sum, [, ms]) => sum + ms, 0);
	console.log('\n  Stage breakdown'.brightCyan + ` (${totalFilesProcessed} JSON files, ${bundleCount ?? 0} JS bundles, output ${~~(packagedFileContents.length / 1048576)}MB):`.cyan);
	stageTimings.forEach(([label, ms]) => {
		const pct = breakdownTotal ? (ms / breakdownTotal * 100) : 0;
		console.log(`    ${ms.toFixed(0).padStart(7)}ms  ${pct.toFixed(1).padStart(5)}%  ${label}`.cyan);
	});

	console.log(`\n...completed (${elapsedMs.toFixed(0)}ms)`.magenta);
};

//Build one full package from the current working directory.
const runBuild = async () => {
	const buildStart = process.hrtime.bigint();
	console.log('Packaging...'.brightMagenta);
	stageTimings.length = 0;
	resetStageClock();

	const res = {};
	remappedPaths = [];
	fileLocations = new Map();

	let packageFile = {};
	try {
		packageFile = JSON.parse(await readFile('package.json', 'utf-8'));
	} catch {}

	opusUiConfig = await buildOpusUiConfig(packageFile);

	await init(opusUiConfig);
	markStage('read package.json + config + init');

	let packagedFileName = (opusUiConfig.opusPackagerConfig?.packagedFileName ?? 'mdaPackage');

	if (args.output === 'js')
		packagedFileName = `${packagedFileName}.jsx`;
	else
		packagedFileName = `${packagedFileName}.json`;

	const appDir = opusUiConfig.opusPackagerConfig?.appDir ?? '';
	const packagedDir = opusUiConfig.opusPackagerConfig?.packagedDir ?? 'packaged';

	const cwd = `${process.cwd()}${appDir ? osSlash + appDir + osSlash : osSlash}`;

	const promises = [
		processDir(appDir === '' ? './' : appDir, cwd, res, false)
	];

	if (!excludeEnsembles) {
		if (
			!['', '.', './'].includes(appDir) &&
			!opusUiConfig.opusPackagerConfig.isEnsemble &&
			//Only worth scanning node_modules if some ensemble is actually installed there.
			ensembleNames.some(e => !e.external)
		) {
			promises.push(
				processDir('node_modules', `${process.cwd()}${osSlash}node_modules`, res, true)
			);
		}
		promises.push(
			...ensembleNames
			  .filter(e => e.external)
			  .map(e => processDir(e.path, e.path, res, true))
		);
	}

	const fileCounts = await Promise.all(promises);
	const totalFilesProcessed = fileCounts.reduce((sum, n) => sum + (n || 0), 0);
	markStage('read + parse + setPaths (processDir)');

	delete res[''];

	const indexJson = res.dashboard?.['index.json'];

	if (!excludeEnsembles) {
		ensembleNames.forEach(f => {
			let entry = res.dashboard;

			let keyPath = f.path;

			const remapped = remappedPaths.find(r => r.path === f.path);
			if (remapped)
				keyPath = remapped.remappedPath;

			const split = keyPath.split(osSlash);
			if (!remapped)
				split[0] = `@${split[0]}`;
			else
				split.splice(0, 1);

			split.forEach(s => {
				entry = entry[s];
			});

			const ensembleConfig = entry['config.json'];
			if (!ensembleConfig)
				return;

			if (ensembleConfig.themes) {
				ensembleConfig.themes.forEach(t => {
					if (!indexJson.themes.includes[t])
						indexJson.themes.push(t);

					const themeFileName = t + '.json';
					const theme = entry.theme[themeFileName];

					const existingTheme = res.theme[themeFileName];

					if (!existingTheme)
						res.theme[themeFileName] = theme;
					else {
						Object.entries(theme).forEach(([kInner, vInner]) => {
							if (existingTheme[kInner] === undefined)
								existingTheme[kInner] = vInner;
						});
					}

					if (f.external)
						res.theme[themeFileName].ensembleLocation = f.path;
					else if (ensembleConfig.ensembleIsInDist)
						res.theme[themeFileName].ensembleLocation = `node_modules/${f.path}/dist`;
					else
						res.theme[themeFileName].ensembleLocation = `node_modules/${f.path}`;
				});
			}
		});
	}

	delete res.node_modules;
	delete res['package.json'];
	delete res['package-lock.json'];
	delete res['serve.json'];
	markStage('merge ensemble themes');

	//Resolve a freetext theme asset path. Mirrors the function-theme convention: a
	// `{ensembleLocation}` placeholder is substituted with the owning ensemble's location
	// (absolute for external ensembles), otherwise the path is taken relative to appDir.
	const resolveThemeAssetPath = (rawPath, ensembleLocation) =>
		rawPath.includes('{ensembleLocation}')
			? rawPath.replaceAll('{ensembleLocation}', ensembleLocation ?? '')
			: `${appDir ? appDir + osSlash : ''}${rawPath}`;

	if (!opusUiConfig.opusPackagerConfig.isEnsemble) {
		const themeEntries = Object.entries(res.theme);
		for (let [, theme] of themeEntries) {
			if (theme.themeConfig?.isFunctionTheme) {
				const entries = Object.entries(theme);
				for (let [k, v] of entries) {
					if (v.fn?.[0] !== '>')
						continue;

					let f = v.fn.replace('{ensembleLocation}', theme.ensembleLocation).substr(1) + '.js';
					if (!theme.ensembleLocation)
						f = `${cwd}${f}`;

					const convertedFileString = (await readFile(f, 'utf-8'))
						.replaceAll('\r', ' ')
						.replaceAll('\n', ' ')
						.replaceAll('\t', ' ');

					theme[k].fn = convertedFileString;
				}
			} else if (theme.themeConfig?.isFreeTextTheme) {
				const entries = Object.entries(theme);
				for (let [k, v] of entries) {
					if (v.indexOf && v.indexOf('>>') === 0) {
						theme[k] = {};

						const folder = resolveThemeAssetPath(v.substr(2), theme.ensembleLocation);

						const dirents = await readdir(folder, { withFileTypes: true });

						for (const { name: fileName } of dirents) {
							const fileString = (await readFile(`${folder}${osSlash}${fileName}`, 'utf-8'));

							theme[k][fileName.split('.')[0]] = fileString;
						}

						continue;
					}

					if (v[0] !== '>')
						continue;

					const f = resolveThemeAssetPath(v.substr(1), theme.ensembleLocation);

					const convertedFileString = (await readFile(f, 'utf-8'));

					theme[k] = convertedFileString;
				}
			}
		}
	}

	markStage('inline theme JS/freetext files');

	recurseProcessMda.init({
		appDir,
		fullMda: res,
		remappedPaths,
		generateTestIds,
		ensembleNames
	});
	recurseProcessMda.run(res);

	const bundleCount = await recurseProcessMda.waitForCompletion();
	markStage('recurseProcessMda + bundle source actions');

	//Mark static/pure components (whole-app pass: needs the full reference graph).
	const staticCounts = markStaticAndPure(res);
	markStage('markStaticAndPure');
	console.log(`...static: ${staticCounts.static} (pure: ${staticCounts.pure}, promoted via reference scan: ${staticCounts.promoted})`.magenta);

	const packagedFileContents = await writeOutput(res, packagedDir, packagedFileName);

	const elapsedMs = Number(process.hrtime.bigint() - buildStart) / 1e6;
	printBreakdown(totalFilesProcessed, bundleCount, packagedFileContents, elapsedMs);

	//Publish resident state so watch-mode incremental rebuilds can patch this same tree.
	live = { res, packagedDir, packagedFileName };

	return res;
};

//Re-process a single changed component file in place: re-parse it, splice its subtree into
// the resident tree, and run the per-file (local) resolution pass over just that subtree.
// Returns false if the file can't be read (vanished mid-event) so the caller can fall back.
const processChangedFile = async p => {
	const loc = fileLocations.get(normPath(p));

	let file;
	try {
		file = (await readFile(p, 'utf-8')).replace(/[\r\n\t]/g, '');
	} catch {
		return false;
	}

	let json;
	try {
		json = JSON.parse(file);
	} catch {
		json = {
			acceptPrps: {},
			type: 'label',
			prps: { cpt: `'${p}' is not valid JSON` }
		};
	}

	setPathsOnComponents(json, loc.keyPath);

	//Splice the fresh subtree into the resident tree at its recorded location.
	let parent = live.res;
	loc.dirs.forEach(d => {
		if (!parent[d])
			parent[d] = {};

		parent = parent[d];
	});
	parent[loc.key] = json;

	//Resolve traits/src/srcActions for just this subtree (bundles for unchanged source
	// actions are already present in the tree, so esbuild is skipped for them).
	recurseProcessMda.run(json, parent, `/${loc.dirs.join('/')}/${loc.key}`);

	return true;
};

//Only plain component/trait files under `dashboard` are safe to patch surgically. Theme
// files (also merged into `res.theme` and inlined during the theme stage), ensemble
// `config.json` (drives theme merge), adds/deletes and `.js` source actions fall back to a
// full rebuild.
const isIncrementalEligible = (event, p) => {
	if (event !== 'change' || !p.endsWith('.json'))
		return false;

	const loc = fileLocations.get(normPath(p));
	if (!loc)
		return false;

	return (
		loc.dirs[0] === 'dashboard' &&
		!loc.dirs.includes('theme') &&
		loc.key !== 'config.json'
	);
};

//Incremental rebuild: re-process only the changed files, then re-run the global passes
// (static/pure marking, serialize, write) that must see the whole tree. Returns false to
// signal the caller should fall back to a full rebuild.
const runIncremental = async paths => {
	const buildStart = process.hrtime.bigint();
	stageTimings.length = 0;
	resetStageClock();
	console.log(`Repackaging (${paths.length} changed file(s))...`.brightMagenta);

	for (const p of paths) {
		/* eslint-disable-next-line no-await-in-loop */
		const ok = await processChangedFile(p);
		if (!ok)
			return false;
	}
	markStage('reparse + splice changed files');

	await recurseProcessMda.waitForCompletion();
	markStage('recurseProcessMda (changed subtrees)');

	const staticCounts = markStaticAndPure(live.res);
	markStage('markStaticAndPure');
	console.log(`...static: ${staticCounts.static} (pure: ${staticCounts.pure}, promoted via reference scan: ${staticCounts.promoted})`.magenta);

	const packagedFileContents = await writeOutput(live.res, live.packagedDir, live.packagedFileName);

	const elapsedMs = Number(process.hrtime.bigint() - buildStart) / 1e6;
	printBreakdown(fileLocations.size, '·', packagedFileContents, elapsedMs);

	return true;
};

//Build once, then keep the process alive and rebuild on source changes. Staying resident
// avoids per-save node startup, module loading and esbuild-service respawn, and keeps the
// esbuild service warm. Rebuilds are serialized (one at a time) and debounced so a burst of
// saves coalesces into a single build.
const startWatch = async () => {
	const chokidar = require('chokidar');

	//Initial full build (populates module-level config/ensemble state used below).
	await runBuild();

	let packageFile = {};
	try {
		packageFile = JSON.parse(await readFile('package.json', 'utf-8'));
	} catch {}

	const appDir = opusUiConfig.opusPackagerConfig?.appDir ?? '';
	const packagedDir = opusUiConfig.opusPackagerConfig?.packagedDir ?? 'packaged';

	//Watch the app, every external ensemble, and the config files. Non-external ensembles
	// live in node_modules (ignored below); they don't change during local dev.
	const watchPaths = [
		appDir ? resolve(process.cwd(), appDir) : process.cwd(),
		...ensembleNames.filter(e => e.external).map(e => e.path),
		resolve(process.cwd(), 'package.json'),
		resolve(process.cwd(), buildExternalOpusUiConfigPath(packageFile))
	];

	const watcher = chokidar.watch(watchPaths, {
		ignoreInitial: true,
		ignored: [
			/[/\\]node_modules[/\\]/,
			/[/\\]\.git[/\\]/,
			resolve(process.cwd(), packagedDir)
		],
		//Wait for writes to settle so we never read a half-written file.
		awaitWriteFinish: { stabilityThreshold: 80, pollInterval: 20 }
	});

	const pendingChanges = new Map();
	let building = false;
	let queued = false;
	let debounceTimer = null;

	const runQueued = async () => {
		debounceTimer = null;

		if (building) {
			queued = true;

			return;
		}

		const changes = [...pendingChanges.entries()];
		pendingChanges.clear();
		if (changes.length === 0)
			return;

		building = true;
		try {
			//Surgical update only if every change is an eligible in-place edit; otherwise
			// (adds, deletes, theme/config/js, unknown files) do a safe full rebuild.
			const allEligible = changes.every(([p, ev]) => isIncrementalEligible(ev, p));

			const done = allEligible && await runIncremental(changes.map(([p]) => p));
			if (!done)
				await runBuild();
		} catch (err) {
			console.log(`...build failed: ${err.message}`.red);
		}
		building = false;

		if (queued) {
			queued = false;
			triggerBuild();
		}
	};

	/* eslint-disable-next-line func-style */
	function triggerBuild () {
		if (debounceTimer)
			clearTimeout(debounceTimer);

		debounceTimer = setTimeout(runQueued, 60);
	}

	watcher
		.on('all', (event, changedPath) => {
			pendingChanges.set(changedPath, event);
			console.log(`\n${event}: ${relative(process.cwd(), changedPath)}`.grey);
			triggerBuild();
		})
		.on('error', err => console.log(`...watch error: ${err.message}`.red));

	console.log(`\nWatching ${watchPaths.length} roots for changes (Ctrl+C to stop)...`.brightGreen);
};

//Entry point
(async () => {
	if (args.devmode === 'true')
		await new Promise(innerRes => setTimeout(innerRes, 2000));

	if (watch)
		await startWatch();
	else
		await runBuild();
})();
