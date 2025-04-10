/* eslint-disable max-lines-per-function, complexity */
const path = require('path');
const { readFile } = require('fs').promises;
const babel = require('@babel/core');

let appDir;
let fullMda;
let remappedPaths;
let ensembleNames;
let promisesToAwait;
let generateTestIds;

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
};

const addTestIdToNode = (mda, parentMda, fullPath) => {
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

	if (mda.inlineKeys !== undefined) {
		mda.inlineKeys.forEach(k => {
			mda[k] = mda[k].join(' ');
		});

		delete mda.inlineKeys;
	}
	if (mda.srcActions !== undefined) {
		if (!currentPath)
			currentPath = getCurrentPath(fullPath);

		let newPath = getMappedPath(mda.srcActions, currentPath);
		if (newPath[0] === '/')
			newPath = newPath.substr(1);

		const splitAccessor = newPath.split('/');
		const fileName = splitAccessor.pop() + '.js';
		
		const parentOfFile = splitAccessor.reduce((p, n) => {
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
				importPath = path.join(process.cwd(), 'node_modules', `${newPath.substr(1)}.js`);
			else
				importPath = path.join(process.cwd(), appDir, 'dashboard', newPath + '.js');
		}

		if (!parentOfFile[fileName]) {
			promisesToAwait.push((async () => {
				const fileString = (await readFile(importPath, 'utf-8'));

				parentOfFile[fileName] = fileString;
			})());
		}

		mda.srcActions = {
			path: newPath
		};
	} else if (mda.srcAction !== undefined) {
		if (!currentPath)
			currentPath = getCurrentPath(fullPath);

		let newPath = getMappedPath(mda.srcAction, currentPath);
		if (newPath[0] === '/')
			newPath = newPath.substr(1);

		const splitAccessor = newPath.split('/');
		const fileName = splitAccessor.pop() + '.js';
		
		const parentOfFile = splitAccessor.reduce((p, n) => {
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
				importPath = path.join(process.cwd(), 'node_modules', `${newPath.substr(1)}.js`);
			else
				importPath = path.join(process.cwd(), appDir, 'dashboard', newPath + '.js');
		}

		if (!parentOfFile[fileName]) {
			promisesToAwait.push((async () => {
				const fileString = (await readFile(importPath, 'utf-8'));

				parentOfFile[fileName] = fileString;
			})());
		}

		mda.srcAction = {
			path: newPath
		};
	}

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
	await Promise.all(promisesToAwait);
};

module.exports = {
	init,
	run: recurseProcessMda,
	waitForCompletion
};
