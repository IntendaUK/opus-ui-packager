//Imports
const { resolve, join } = require('path');
const { readdir, readFile, writeFile } = require('fs').promises;

//Helpers
const fixRelativePaths = require('./packager/fixRelativePaths');
const applyInlineKeys = require('./packager/applyInlineKeys');

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

const opusUiConfigFileName = '.opusUiConfig';
const opusUiConfigKeys = ['opusPackagerConfig', 'opusUiComponentLibraries', 'opusUiEnsembles', 'opusUiColorThemes'];

//Helpers
const remapPath = (path, couldContainEnsembles) => {
	if (!couldContainEnsembles || path === 'node_modules')
		return path;

	if (path.includes('node_modules')) {
		const subPath = path.substr(path.indexOf('node_modules') + 13);
		const possibleEnsembleEntry = ensembleNames.find(f => f.path.includes(subPath) || subPath.includes(f.path));
		if (!possibleEnsembleEntry)
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
	let mappedPath = remapPath(path, couldContainEnsembles);
	if (!mappedPath)
		return;

	let dirents;

	dirents = await readdir(mappedPath, { withFileTypes: true });

	for (const dirent of dirents) {
		const res = resolve(mappedPath, dirent.name);

		if (dirent.isDirectory()) {
			if (
				(
					dirent.name.includes('node_modules') &&
					opusUiConfig.opusPackagerConfig.isEnsemble
				) ||
				ignoreFolders.includes(dirent.name) ||
				dirent.name === opusUiConfig.opusPackagerConfig.packagedDir
			)
				continue;

			yield* getFiles(res, couldContainEnsembles);
		} else if (res.split('.').pop() !== 'json')
			continue;
		else {
			if (
				res.includes(opusUiConfig.opusPackagerConfig.packagedFileName + '.json') ||
				res.includes('package.json') ||
				res.includes('package-lock.json')
			)
				continue;

			if (res.includes)

				yield res;
		}
	}
}

const init = async opusUiConfig => {
	if (`${process.cwd()}`.includes('\\'))
		osSlash = '\\';
	else
		osSlash = '/';

	ensembleNames = (opusUiConfig.opusUiEnsembles ?? []).map(f => {
		const fixedPath = (f.path ?? f).replaceAll('/', osSlash).replaceAll('\\', osSlash);

		return {
			external: f.external,
			name: f.name ?? f,
			path: fixedPath
		};
	});
};

const setPathsOnViewports = (obj, viewportPath) => {
	if (obj.type === 'viewport') {
		if (!obj.prps)
			obj.prps = {};

		obj.prps.path = viewportPath;
	}

	Object.values(obj).forEach(v => {
		if (typeof(v) !== 'object' || v === null)
			return;

		setPathsOnViewports(v, viewportPath);
	});
};

const processDir = async (dir, cwd, res, couldContainEnsembles = false) => {
	for await (let path of getFiles(`${dir}`, couldContainEnsembles)) {
		let file;
		file = (await readFile(path, 'utf-8'))
			.replaceAll('\r', '')
			.replaceAll('\n', '')
			.replaceAll('\t', '');

		let keyPath = path;

		if (ensembleNames.some(f => path.includes(f.path + osSlash))) {
			const remapped = remappedPaths.find(f => path.includes(f.path));
			if (remapped)
				keyPath = `${remapped.remappedPath}${osSlash}${path.replace(remapped.path + osSlash, '')}`;
			else
				keyPath = `dashboard${osSlash}@${path.replace(cwd + osSlash, '')}`;
		}
		keyPath = keyPath.replace(cwd, '');

		if (!path.includes(`${osSlash}theme${osSlash}`) && opusUiConfig.opusPackagerConfig.isEnsemble)
			keyPath = `dashboard\\@${opusUiConfig.opusPackagerConfig.ensembleName}\\${keyPath}`;

		const dirs = keyPath.split(/\/|\\/);
		const key = dirs.pop();

		let ensembleIsInDist = false;
		if (dirs[2] === 'dist') {
			ensembleIsInDist = true;
			dirs.splice(2, 1);
		}

		let accessor = res;
		dirs.forEach(d => {
			if (!accessor[d])
				accessor[d] = {};

			accessor = accessor[d];
		});

		let json;

		try {
			json = JSON.parse(file);
		} catch (e) {
			json = {
				type: 'label',
				prps: { cpt: `'${path}' is not valid JSON` }
			};
		}

		const viewportPath = dirs.join('/').replace('dashboard/', '');

		setPathsOnViewports(json, viewportPath);

		accessor[key] = json;
		if (ensembleIsInDist && dirs.length === 2 && key === 'config.json')
			json.ensembleIsInDist = true;
	}
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
	} catch (e) {}

	if (!isObjectLiteral(externalOpusUiConfig))
		return null;

	return externalOpusUiConfig;
};

const buildOpusUiConfig = async opusAppPackageValue => {
	const opusUiConfig = {};

	// Start with opusUiConfig entries from package.json
	opusUiConfigKeys.forEach(k => {
		if (opusAppPackageValue[k]) opusUiConfig[k] = opusAppPackageValue[k];
	});

	if (opusAppPackageValue.opusUiConfig && isObjectLiteral(opusAppPackageValue.opusUiConfig)) {
		// Override opusUiConfig entries with those from opusUiConfig object in package.json
		opusUiConfigKeys.forEach(k => {
			if (opusAppPackageValue.opusUiConfig[k]) opusUiConfig[k] = opusAppPackageValue.opusUiConfig[k];
		});
	}

	const externalOpusUiConfigPath = buildExternalOpusUiConfigPath(opusAppPackageValue);

	const externalOpusUiConfigData = await getOpusUiConfigFile(externalOpusUiConfigPath);

	if (externalOpusUiConfigData) {
		// Override opusUiConfig entries with those from external opusUiConfig file.
		opusUiConfigKeys.forEach(k => {
			if (externalOpusUiConfigData[k]) opusUiConfig[k] = externalOpusUiConfigData[k];
		});
	}

	return opusUiConfig;
};

//Packager
(async () => {
	if (args.devmode === 'true')
		await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay

	console.log('Packaging...');
	const res = {};

	let packageFile = {};
	try {
		packageFile = JSON.parse(await readFile('package.json', 'utf-8'));
	} catch (e) {}

	opusUiConfig = await buildOpusUiConfig(packageFile);

	await init(opusUiConfig);

	let packagedFileName = (opusUiConfig.opusPackagerConfig?.packagedFileName ?? 'mdaPackage');

	if (args.output === 'js')
		packagedFileName = `${packagedFileName}.jsx`;
	else
		packagedFileName = `${packagedFileName}.json`;

	const appDir = opusUiConfig.opusPackagerConfig?.appDir ?? '';
	const packagedDir = opusUiConfig.opusPackagerConfig?.packagedDir ?? 'packaged';

	const cwd = `${process.cwd()}${appDir ? osSlash + appDir + osSlash : osSlash}`;

	await processDir(appDir === '' ? './' : appDir, cwd, res, false);
	if (!['', '.', './'].includes(appDir) && !opusUiConfig.opusPackagerConfig.isEnsemble)
		await processDir('node_modules', `${process.cwd()}${osSlash}node_modules`, res, true);

	for (let e of ensembleNames) {
		if (!e.external)
			continue;

		await processDir(e.path, e.path, res, true);
	}

	delete res[''];

	const indexJson = res.dashboard?.['index.json'];

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

	delete res.node_modules;
	delete res['package.json'];
	delete res['package-lock.json'];
	delete res['serve.json'];

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

						let folder = v.substr(2);
						folder = `${appDir ? appDir + osSlash : ''}${folder}`;

						const dirents = await readdir(folder, { withFileTypes: true });

						for (const { name: fileName } of dirents) {
							const fileString = (await readFile(`${folder}${osSlash}${fileName}`, 'utf-8'));

							theme[k][fileName.split('.')[0]] = fileString;
						}

						continue;
					}

					if (v[0] !== '>')
						continue;

					const f = `${appDir ? appDir + osSlash : ''}${v.substr(1)}`;

					const convertedFileString = (await readFile(f, 'utf-8'));

					theme[k] = convertedFileString;
				}
			}
		}
	}

	fixRelativePaths(res);
	applyInlineKeys(res);

	let packagedFileContents = JSON.stringify(res);

	if (args.output === 'js')
		packagedFileContents = `/* eslint-disable */ const app = ${packagedFileContents}; export default app;`;

	await writeFile(`${packagedDir}/${packagedFileName}`, packagedFileContents);

	console.log('...completed');
})();
