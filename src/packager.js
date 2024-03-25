//Helpers
const fixRelativePaths = require('./packager/fixRelativePaths');
const applyInlineKeys = require('./packager/applyInlineKeys');

// Add the string 'all' to this array to use only external ensembles
// or add the specific ensemble names you wish to load externally
let externalEnsembles = null;

//This is the path to the ensembles folder on your machine
let externalEnsemblesPath = null;

const arg = process.argv.slice(2);

process.chdir(arg[1] ?? process.cwd());

const ignoreFolders = [
	'.git'
];

//Imports
const { resolve } = require('path');
const { readdir, readFile, writeFile, unlink } = require('fs').promises;

//Internals
let osSlash = '/';
let ensembleNames;
let renamedFolders = [];

//Helpers
const remapPath = (path, matchWord = 'node_modules') => {
	if (!path.includes(`${matchWord}${osSlash}`))
		return path;

	const i = path.indexOf(matchWord) + matchWord.length + 1;
	let j = path.indexOf(osSlash, i);
	if (j === -1)
		j = undefined;

	const ensembleName = path.substring(i, j);
	if (!ensembleNames.includes(ensembleName))
		return;

	if (externalEnsembles.includes('all') || externalEnsembles.includes(ensembleName)) {
		let mappedPath = path.replace(process.cwd() + osSlash + matchWord, externalEnsemblesPath);

		return mappedPath;
	}

	return path;
};

/* eslint-disable-next-line func-style */
async function* getFiles (path) {
	let mappedPath = remapPath(path);
	if (!mappedPath)
		return;

	let dirents;

	try {
		dirents = await readdir(mappedPath, { withFileTypes: true });
	} catch (e) {
		const ensembleName = ensembleNames.find(n => mappedPath.includes(n));
		if (ensembleName) {
			const remappedPath = mappedPath
				.replace(
					ensembleName,
					ensembleName.replace(
						/\_[a-z]/g,
						(a, i) => {
							if (i === 2)
								return a;

							return a[1].toUpperCase();
						}
					)
				);

			renamedFolders.push({
				mappedPath,
				remappedPath
			});

			mappedPath = remappedPath;
		}

		dirents = await readdir(mappedPath, { withFileTypes: true });
	}

	for (const dirent of dirents) {
		const res = resolve(mappedPath, dirent.name);

		if (dirent.isDirectory()) {
			if (ignoreFolders.includes(dirent.name))
				continue;

			yield* getFiles(res);
		} else if (res.split('.').pop() !== 'json') 
			continue;
		 else {
			if (res.includes('mdaPackage') || res.includes('package.json'))
				continue;

			yield res;
		}
	}
}

const init = async packageFile => {
	if (`${process.cwd()}`.includes('\\'))
		osSlash = '\\';
	else
		osSlash = '/';

	if (osSlash === '/')
		externalEnsemblesPath = externalEnsemblesPath.replaceAll('\\', osSlash);
	else
		externalEnsemblesPath = externalEnsemblesPath.replaceAll('/', osSlash);

	ensembleNames = Object.keys(packageFile.dependencies ?? []);
};

const setPathsOnViewports = (obj, path) => {
	if (obj.type === 'viewport') {
		if (!obj.prps)
			obj.prps = {};

		obj.prps.path = path;
	}

	Object.entries(obj).forEach(([k, v]) => {
		if (typeof(v) !== 'object' || v === null)
			return;

		setPathsOnViewports(v, path);
	});
};

//Packager
(async () => {
	let config;
	try {
		config = JSON.parse(await readFile('theme/packager.json', 'utf-8'));

		externalEnsembles = config.externalEnsembles;
		externalEnsemblesPath = arg[0] ?? config.externalEnsemblesPath;
	} catch (e) {
		externalEnsembles = [];
		externalEnsemblesPath = arg[0] ?? '';
	}

	console.log('Packaging...');
	const res = {};

	let packageFile = {};
	try {
		packageFile = JSON.parse(await readFile('package.json', 'utf-8'));
	} catch (e) {}

	await init(packageFile);

	const appDir = packageFile.opusPackagerConfig?.appDir ?? '';
	const packagedDir = packageFile.opusPackagerConfig?.packagedDir ?? 'packaged';
	const packagedFileName = (packageFile.opusPackagerConfig?.packagedFileName ?? 'mdaPackage') + '.json';

	while (true) {
		let ok = false;
		try {
			await unlink(`${packagedDir}${osSlash}${packagedFileName}`);
			ok = true;
		} catch (e) {
			if ((e + '').includes('no such file'))
				ok = true;
		}
		if (ok)
			break;
	}

	const cwd = `${process.cwd()}${appDir ? osSlash + appDir + osSlash : osSlash}`;

	for await (let path of getFiles(`./${appDir}`)) {
		let originalPath = path;

		const foundRenamed = renamedFolders.find(f => path.includes(f.remappedPath));
		if (foundRenamed)
			originalPath = originalPath.replace(foundRenamed.remappedPath, foundRenamed.mappedPath);

		if (path.includes('ensembles'))
			originalPath = originalPath.replace(externalEnsemblesPath, cwd + 'node_modules');

		let file;

		file = (await readFile(path, 'utf-8'))
			.replaceAll('\r', '')
			.replaceAll('\n', '')
			.replaceAll('\t', '');

		let accessor = res;

		const dirs = originalPath.replace(cwd, '').split(/\/|\\/);
		const key = dirs.pop();

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
				prps: {
					cpt: `'${path}' is not valid JSON`
				}
			};
		}

		const prpPath = originalPath
			.replace(cwd, '')
			.replace(`node_modules${osSlash}`, '@')
			.replace(`${osSlash}${key}`, '');

		setPathsOnViewports(json, prpPath);

		accessor[key] = json;
	}

	const indexJson = res.dashboard['index.json'];

	const ensembles = res.node_modules;
	if (ensembles) {
		Object.entries(ensembles).forEach(([k, v]) => {
			if (!ensembleNames.includes(k))
				return;

			res.dashboard['@' + k] = v;

			const ensembleConfig = v['config.json'];
			if (!ensembleConfig)
				return;

			if (ensembleConfig.themes) {
				ensembleConfig.themes.forEach(t => {
					if (!indexJson.themes.includes[t])
						indexJson.themes.push(t);

					const themeFileName = t + '.json';
					const theme = v.theme[themeFileName];

					const existingTheme = res.theme[themeFileName];

					if (!existingTheme)
						res.theme[themeFileName] = theme;
					else {
						Object.entries(theme).forEach(([kInner, vInner]) => {
							if (existingTheme[kInner] === undefined)
								existingTheme[kInner] = vInner;
						});
					}

					let ensembleLocation = `${process.cwd()}${osSlash}node_modules${osSlash}${k}`;
					if (externalEnsembles.includes('all') || externalEnsembles.includes(k))
						ensembleLocation = ensembleLocation.replace(`${process.cwd()}${osSlash}node_modules`, externalEnsemblesPath);

					res.theme[themeFileName].ensembleLocation = ensembleLocation;
				});
			}
		});
	}

	delete res.node_modules;
	delete res['package.json'];
	delete res['package-lock.json'];
	delete res['serve.json'];

	const themeEntries = Object.entries(res.theme);
	for (let [, theme] of themeEntries) {
		if (theme.themeConfig?.isFunctionTheme) {
			const entries = Object.entries(theme);
			for (let [k, v] of entries) {
				if (v.fn?.[0] !== '>')
					continue;

				const fnLocation = v.fn.replace('{ensembleLocation}', theme.ensembleLocation);

				let f = `${fnLocation.substr(1)}.js`;
				f = `${appDir ? appDir + osSlash : ''}${f}`;

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

	fixRelativePaths(res);
	applyInlineKeys(res);

	await writeFile(`${packagedDir}/${packagedFileName}`, JSON.stringify(res));

	console.log('...completed');
})();
