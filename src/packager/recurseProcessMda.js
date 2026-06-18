/* eslint-disable max-lines-per-function, complexity */
const path = require('path');
const { existsSync } = require('fs');
const { readFile } = require('fs').promises;
const babel = require('@babel/core');
const esbuild = require('esbuild');

let appDir;
let fullMda;
let remappedPaths;
let ensembleNames;
let promisesToAwait;
let generateTestIds;
let bundledSourceActions;

const getMappedPath = (traitPath, currentPath) => {
	if (!traitPath.startsWith('./'))
		return traitPath;

	traitPath = traitPath.slice(2);

	let levelsUp = 0;
	while (traitPath.startsWith('../')) {
		levelsUp++;
		traitPath = traitPath.slice(3);
	}

	const segments = currentPath.split('/');

	if (levelsUp > segments.length)
		levelsUp = segments.length;

	segments.length -= levelsUp;

	const prefix = segments.join('/');

	return prefix + (traitPath[0] === '/' || prefix === '' ? '' : '/') + traitPath;
};

const getCurrentPath = fullPath => {
	const start = 11;
	const jsonIndex = fullPath.indexOf('.json', start);
	const lastSlashBeforeJson = fullPath.lastIndexOf('/', jsonIndex);

	return fullPath.slice(start, lastSlashBeforeJson);
};

const init = ({
	fullMda: _fullMda,
	remappedPaths: _remappedPaths,
	ensembleNames: _ensembleNames,
	appDir: _appDir,
	generateTestIds: _generateTestIds
}) => {
	appDir = _appDir;
	fullMda = _fullMda;
	remappedPaths = _remappedPaths;
	ensembleNames = _ensembleNames;
	generateTestIds = _generateTestIds;

	promisesToAwait = [];
	bundledSourceActions = {};
};

const getPackagedFileParent = splitAccessor => {
	return splitAccessor.reduce((p, n) => {
		if (!p[n])
			p[n] = {};

		return p[n];
	}, fullMda.dashboard);
};

const getRemappedEntry = splitAccessor => {
	return remappedPaths.find(f => {
		return `dashboard\\${splitAccessor[0]}` === f.remappedPath.replace('/', '\\');
	});
};

const getEnsembleEntry = ensembleName => {
	return ensembleNames.find(f => ensembleName === f.name);
};

const getConfiguredEnsembleImport = importPath => {
	const [ensembleName, ...rest] = importPath.substr(1).split('/');
	const ensembleEntry = getEnsembleEntry(ensembleName);

	if (!ensembleEntry)
		return;

	return {
		ensembleEntry,
		ensembleName,
		rest
	};
};

const getConfiguredEnsembleBasePath = ({ ensembleEntry, ensembleName }) => {
	if (ensembleEntry.external)
		return ensembleEntry.path;

	return path.join(process.cwd(), 'node_modules', ensembleEntry.path ?? ensembleName);
};

const getSourceActionImportPath = ({ newPath, splitAccessor, fileName }) => {
	const remappedEntry = getRemappedEntry(splitAccessor);
	if (remappedEntry)
		return `${remappedEntry.path}/${splitAccessor.slice(1).join('/')}/${fileName}`;

	const firstSegment = splitAccessor[0];
	if (firstSegment?.[0] === '@') {
		const configuredEnsembleImport = getConfiguredEnsembleImport(firstSegment);
		if (configuredEnsembleImport) {
			const basePath = getConfiguredEnsembleBasePath(configuredEnsembleImport);

			return path.join(basePath, ...splitAccessor.slice(1), fileName);
		}
	}

	return path.join(process.cwd(), appDir, 'dashboard', newPath + '.js');
};

const getPackageNodeModulesPaths = entryPath => {
	return [
		path.join(process.cwd(), 'node_modules'),
		path.join(appDir ? path.resolve(process.cwd(), appDir) : process.cwd(), 'node_modules'),
		path.join(path.dirname(entryPath), 'node_modules')
	];
};

const getEnsembleImportPath = importPath => {
	const configuredEnsembleImport = getConfiguredEnsembleImport(importPath);
	if (!configuredEnsembleImport)
		return;

	const basePath = getConfiguredEnsembleBasePath(configuredEnsembleImport);

	return path.join(basePath, ...configuredEnsembleImport.rest);
};

const resolveJsImportPath = importPath => {
	if (!importPath)
		return;

	const possiblePaths = [
		importPath,
		`${importPath}.js`,
		`${importPath}.jsx`,
		path.join(importPath, 'index.js'),
		path.join(importPath, 'index.jsx')
	];

	return possiblePaths.find(existsSync);
};

const configuredEnsembleResolver = {
	name: 'configured-ensemble-resolver',
	setup (build) {
		build.onResolve({ filter: /^@[^/]+\/.*$/ }, args => {
			const resolvedPath = resolveJsImportPath(getEnsembleImportPath(args.path));
			if (!resolvedPath)
				return;

			return {
				path: resolvedPath
			};
		});
	}
};

const bundleSourceAction = async importPath => {
	if (bundledSourceActions[importPath] !== undefined)
		return bundledSourceActions[importPath];

	const { outputFiles } = await esbuild.build({
		entryPoints: [importPath],
		bundle: true,
		format: 'esm',
		platform: 'browser',
		write: false,
		nodePaths: getPackageNodeModulesPaths(importPath),
		plugins: [configuredEnsembleResolver]
	});

	bundledSourceActions[importPath] = outputFiles[0].text;

	return bundledSourceActions[importPath];
};

const processSourceAction = (mda, key, fullPath, currentPath) => {
	if (mda[key] === undefined)
		return;

	if (!currentPath.value)
		currentPath.value = getCurrentPath(fullPath);

	let newPath = getMappedPath(mda[key], currentPath.value);
	if (newPath[0] === '/')
		newPath = newPath.substr(1);

	const splitAccessor = newPath.split('/');
	const fileName = splitAccessor.pop() + '.js';
	const parentOfFile = getPackagedFileParent(splitAccessor);
	const importPath = getSourceActionImportPath({
		newPath,
		splitAccessor,
		fileName
	});

	if (!parentOfFile[fileName]) {
		promisesToAwait.push((async () => {
			parentOfFile[fileName] = await bundleSourceAction(importPath);
		})());
	}

	mda[key] = {
		path: newPath
	};
};

const addTestIdToNode = (mda, parentMda, fullPath) => {
	const hasTestId = (
		mda.prps?.attrs?.includes('data-testid') ||
		mda.prps?.['data-testid'] !== undefined
	);

	if (hasTestId)
		return;

	const shouldAddTestId = (
		(
			mda.type &&
			//Don't give to script actions
			mda.value === undefined &&
			mda.storeAsVariable === undefined
		) ||
		mda.traits ||
		(
			mda.acceptPrps &&
			(
				mda.type ||
				mda.wgts
			)
		)
	);

	if (!shouldAddTestId)
		return;

	let testId = fullPath;
	if (testId.indexOf('/dashboard/') === 0)
		testId = testId.substr(11);

	if (testId.endsWith('/index.json'))
		testId = testId.substr(0, testId.length - 11);

	if (testId.endsWith('.json'))
		testId = testId.substr(0, testId.length - 5) + '/';

	testId = testId
		.replaceAll('wgts/', 'w/')
		.replaceAll('visual/', 'v/')
		.replaceAll('functional/', '')
		.replace('.json', '');

	if (!mda.prps)
		mda.prps = {};

	if (!mda.prps.attrs)
		mda.prps.attrs = [];

	mda.prps.attrs.push('data-testid');

	mda.prps['data-testid'] = testId;
};

const recurseProcessMda = (mda, parentMda, fullPath = '') => {
	let currentPath;
	const currentPathRef = {};

	if (mda.inlineKeys !== undefined) {
		mda.inlineKeys.forEach(k => {
			mda[k] = mda[k].join(' ');
		});

		delete mda.inlineKeys;
	}
	processSourceAction(mda, 'srcActions', fullPath, currentPathRef);
	processSourceAction(mda, 'srcAction', fullPath, currentPathRef);

	if (currentPathRef.value)
		currentPath = currentPathRef.value;

	if (mda.src !== undefined && mda.prps !== undefined) {
		if (!currentPath)
			currentPath = getCurrentPath(fullPath);

		const newPath = getMappedPath(mda.src, currentPath);

		const splitAccessor = newPath.split('/');
		const fileName = splitAccessor.pop() + '.jsx';

		const parentOfFile = splitAccessor.reduce((p, n) => {
			if (!n)
				return p;

			if (!p[n])
				p[n] = {};

			return p[n];
		}, fullMda.dashboard);

		const remappedEntry = remappedPaths.find(f => `dashboard\\${splitAccessor[0]}` === f.remappedPath.replace('/', '\\'));
		let importPath;
		if (remappedEntry)
			importPath = `${remappedEntry.path}/${splitAccessor.slice(1).join('/')}/${fileName}`;
		else {
			if (ensembleNames.some(f => splitAccessor[0] === `@${f.name}`))
				importPath = path.join(process.cwd(), 'node_modules', `${newPath.substr(1)}.jsx`);
			else 
				importPath = path.join(process.cwd(), appDir, 'dashboard', newPath + '.jsx');
		}

		if (!parentOfFile[fileName]) {
			promisesToAwait.push((async () => {
				const fileString = (await readFile(importPath, 'utf-8'));

				const { code } = babel.transformSync(fileString, {
					presets: ['@babel/preset-react'],
					sourceType: 'module'
				});

				parentOfFile[fileName] = code;
			})());
		}

		mda.src = {
			path: newPath,
			loadFromMda: true
		};
	}

	Object.entries(mda).forEach(([k, v]) => {
		if (v !== null && typeof(v) === 'object')
			recurseProcessMda(v, mda, fullPath + '/' + k);
	});

	if (!parentMda || (!parentMda.acceptPrps && !parentMda.traitPrps)) {
		const { traits, trait } = mda;

		if (traits && typeof(traits) !== 'string' && traits.map !== undefined) {
			if (!currentPath)
				currentPath = getCurrentPath(fullPath);

			const len = traits.length;
			for (let i = 0; i < len; i++) {
				const t = traits[i];

				if (typeof(t) === 'string' && t.indexOf('./') === 0) {
					traits[i] = getMappedPath(t, currentPath);

					continue;
				} else if (typeof(t.path) !== 'string')
					continue;

				const newPath = getMappedPath(t.path, currentPath);

				t.path = newPath;
			}
		} else if (trait && trait.indexOf('./') === 0) {
			const pathArray = fullPath
				.substring(11, fullPath.lastIndexOf('.json') + 5)
				.split('/');

			pathArray.pop();

			mda.trait = getMappedPath(trait, pathArray.join('/'));
		}
	}

	if (generateTestIds)
		addTestIdToNode(mda, parentMda, fullPath);
};

const waitForCompletion = async () => {
	const count = promisesToAwait.length;
	await Promise.all(promisesToAwait);
	//Clear so an incremental rebuild only ever awaits its own freshly-scheduled bundles,
	// while the bundle-content cache (bundledSourceActions) is kept across rebuilds.
	promisesToAwait.length = 0;

	return count;
};

module.exports = {
	init,
	run: recurseProcessMda,
	waitForCompletion
};
