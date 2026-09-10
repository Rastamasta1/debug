/* eslint-env mocha */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

describe('package.json exports map', () => {
	it('has an "exports" field', () => {
		assert.ok(pkg.exports, 'expected package.json to have an "exports" field');
		assert.ok(Object.prototype.hasOwnProperty.call(pkg.exports, '.'), 'expected "exports" to have a "." entry');
	});

	it('the "." entry lists conditions in order: browser, node, default', () => {
		const dotExport = pkg.exports['.'];
		assert.deepStrictEqual(Object.keys(dotExport), ['browser', 'node', 'default']);
	});

	it('the "." entry conditions point at the correct files', () => {
		const dotExport = pkg.exports['.'];
		assert.strictEqual(dotExport.browser, './src/browser.js');
		assert.strictEqual(dotExport.node, './src/node.js');
		assert.strictEqual(dotExport.default, './src/index.js');
	});

	it('exposes "./package.json"', () => {
		assert.strictEqual(pkg.exports['./package.json'], './package.json');
	});

	it('leaves "main" and top-level "browser" untouched', () => {
		assert.strictEqual(pkg.main, './src/index.js');
		assert.strictEqual(pkg.browser, './src/browser.js');
	});
});

describe('exports map targets', () => {
	function collectStringTargets(node, skipKey) {
		const targets = [];
		for (const [key, value] of Object.entries(node)) {
			if (key === skipKey) {
				continue;
			}
			if (typeof value === 'string') {
				targets.push(value);
			} else if (value && typeof value === 'object') {
				targets.push(...collectStringTargets(value, skipKey));
			}
		}
		return targets;
	}

	it('every target exists on disk and is covered by "files"', () => {
		const targets = collectStringTargets(pkg.exports, './package.json');
		assert.ok(targets.length > 0, 'expected at least one exports target to check');

		for (const target of targets) {
			const relativePath = target.replace(/^\.\//, '');
			const absolutePath = path.join(__dirname, relativePath);
			assert.ok(fs.existsSync(absolutePath), `expected exports target "${target}" to exist on disk`);

			const covered = pkg.files.some(entry => relativePath === entry || relativePath.startsWith(entry + '/'));
			assert.ok(covered, `expected "files" to cover exports target "${target}"`);
		}
	});
});

describe('src/index.js require specifiers match exports map', () => {
	function collectRequireSpecifiers(source) {
		const specifiers = [];
		const requireRe = /require\(\s*(['"])(.*?)\1\s*\)/g;
		let match;
		while ((match = requireRe.exec(source)) !== null) {
			specifiers.push(match[2]);
		}
		return specifiers;
	}

	it('every require() specifier in src/index.js resolves to a file named by the exports map', () => {
		const indexPath = path.join(__dirname, 'src', 'index.js');
		const source = fs.readFileSync(indexPath, 'utf8');
		const specifiers = collectRequireSpecifiers(source);
		assert.ok(specifiers.length > 0, 'expected src/index.js to contain at least one require() call');

		const dotExport = pkg.exports['.'];
		const mapTargets = new Set(Object.values(dotExport).map(target => path.normalize(target.replace(/^\.\//, ''))));

		for (const specifier of specifiers) {
			const resolvedAbsolute = path.resolve(path.dirname(indexPath), specifier);
			const resolvedRelative = path.normalize(path.relative(__dirname, resolvedAbsolute));
			assert.ok(mapTargets.has(resolvedRelative), `expected require() specifier "${specifier}" (resolved to "${resolvedRelative}") to correspond to a target named by the exports map`);
		}
	});
});
