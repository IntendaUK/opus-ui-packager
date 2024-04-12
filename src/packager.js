//Imports
const { resolve } = require('path');
const { readdir, readFile, writeFile, unlink } = require('fs').promises;

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
let ensembleNames;
let remappedPaths = [];

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
			if (ignoreFolders.includes(dirent.name))
				continue;

			yield* getFiles(res, couldContainEnsembles);
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

	ensembleNames = (packageFile.opusUiEnsembles ?? []).map(f => {
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

		const dirs = keyPath.split(/\/|\\/);
		const key = dirs.pop();

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
	}
};

//Packager
(async () => {
	let config;
	try {
		config = JSON.parse(await readFile('theme/packager.json', 'utf-8'));
	} catch (e) {}

	console.log('Packaging...');
	const res = {};

	let packageFile = {};
	try {
		packageFile = JSON.parse(await readFile('package.json', 'utf-8'));
	} catch (e) {}

	await init(packageFile);

	let packagedFileName = (packageFile.opusPackagerConfig?.packagedFileName ?? 'mdaPackage');

	if (args.output === 'js')
		packagedFileName = `${packagedFileName}.jsx`;
	else
		packagedFileName = `${packagedFileName}.json`;

	const appDir = packageFile.opusPackagerConfig?.appDir ?? '';
	const packagedDir = packageFile.opusPackagerConfig?.packagedDir ?? 'packaged';

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

	await processDir(appDir, cwd, res, false);
	if (!['', '.', './'].includes(appDir))
		await processDir('node_modules', `${process.cwd()}${osSlash}node_modules`, res, true);

	for (let e of ensembleNames) {
		if (!e.external)
			continue;

		await processDir(e.path, e.path, res, true);
	}

	delete res[''];

	const indexJson = res.dashboard['index.json'];

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
				else
					res.theme[themeFileName].ensembleLocation = `node_modules/${f.path}`;
			});
		}
	});

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

	fixRelativePaths(res);
	applyInlineKeys(res);

	let packagedFileContents = JSON.stringify(res);

	if (args.output === 'js')
		packagedFileContents = `/* eslint-disable */ const app = ${packagedFileContents}; export default app;`;

	await writeFile(`${packagedDir}/${packagedFileName}`, packagedFileContents);

	console.log('...completed');
})();
