#!/usr/bin/env npx ts-node
/**
 * Benchmark suite for @rocket.chat/message-parser
 *
 * Measures parsing performance (ops/sec) across various message categories.
 * Run with: `yarn bench` from packages/message-parser/
 *
 * Uses a custom loader (pegjs-register.js) to compile .pegjs at runtime — no build needed.
 */

import assert from 'node:assert/strict';

import { Bench } from 'tinybench';

import { parsePeggy } from '../src';
import type { Options } from '../src';
import { parse as parseChevrotain } from '../src/parsers/chevrotain';
import { parse as parseHandwritten } from '../src/parsers/handwritten';

// ── Options presets ────────────────────────────────────────────────────────

const fullOptions: Options = {
	colors: true,
	emoticons: true,
	katex: {
		dollarSyntax: true,
		parenthesisSyntax: true,
	},
};

// ── Fixture type ───────────────────────────────────────────────────────────

type Fixture = {
	name: string;
	input: string;
	options?: Options;
};

type BenchCategory = {
	name: string;
	kind: 'normal' | 'stress';
	time?: number;
	warmupTime?: number;
	fixtures: Fixture[];
};

type ParserBenchmark = {
	name: 'peggy' | 'chevrotain' | 'handwritten';
	parse: (input: string, options?: Options) => unknown;
};

type BenchRow = {
	category: string;
	kind: BenchCategory['kind'];
	fixture: string;
	parser: ParserBenchmark['name'];
	hz: number;
	meanMs: number;
	p99Ms: number;
	samples: number;
};

type RelativeRow = {
	fixture: string;
	peggyHz: number;
	chevrotainHz: number;
	handwrittenHz: number;
	chevrotainSpeedup: number;
	handwrittenSpeedup: number;
};

const parserBenchmarks: ParserBenchmark[] = [
	{ name: 'peggy', parse: parsePeggy },
	{ name: 'chevrotain', parse: parseChevrotain },
	{ name: 'handwritten', parse: parseHandwritten },
];

const scopeArgIndex = process.argv.indexOf('--scope');
const scope = scopeArgIndex === -1 ? 'all' : (process.argv[scopeArgIndex + 1] ?? 'all');

// ── Categories ─────────────────────────────────────────────────────────────

const categories: BenchCategory[] = [
	{
		name: 'Plain Text',
		kind: 'normal',
		fixtures: [
			{ name: 'short', input: 'Hello world' },
			{
				name: 'medium',
				input: 'The quick brown fox jumps over the lazy dog. This is a typical message one might send in a chat application.',
			},
			{ name: 'long', input: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(20).trim() },
		],
	},
	{
		name: 'Emphasis / Formatting',
		kind: 'normal',
		fixtures: [
			{ name: 'bold', input: '**Hello world**' },
			{ name: 'italic', input: '_Hello world_' },
			{ name: 'strike', input: '~~Hello world~~' },
			{ name: 'nested', input: '**bold _italic_ and ~~strike~~**' },
			{ name: 'deep nesting', input: 'plain **__~~strikeitalicbold~~__**' },
			{ name: 'multiple', input: '**bold** normal _italic_ normal ~~strike~~ **more bold** _more italic_' },
		],
	},
	{
		name: 'URLs & Links',
		kind: 'normal',
		fixtures: [
			{ name: 'single', input: 'Check out https://rocket.chat for more info' },
			{ name: 'multiple', input: 'Visit https://rocket.chat or https://github.com/RocketChat/Rocket.Chat or https://open.rocket.chat' },
			{ name: 'markdown link', input: '[Rocket.Chat](https://rocket.chat)' },
			{ name: 'autolinked domain', input: 'Visit rocket.chat for more info' },
			{ name: 'with path', input: 'See https://github.com/RocketChat/Rocket.Chat/tree/develop/packages/message-parser for details' },
		],
	},
	{
		name: 'Emoji',
		kind: 'normal',
		fixtures: [
			{ name: 'single shortcode', input: ':smile:', options: fullOptions },
			{ name: 'triple shortcode (BigEmoji)', input: ':smile::heart::rocket:', options: fullOptions },
			{ name: 'single unicode', input: '😀', options: fullOptions },
			{ name: 'triple unicode (BigEmoji)', input: '😀🚀🌈', options: fullOptions },
			{ name: 'in text', input: 'Hello :smile: world :heart: test :rocket: done', options: fullOptions },
			{ name: 'mixed', input: 'Great job :thumbsup: 🎉 keep going :rocket:', options: fullOptions },
		],
	},
	{
		name: 'Mentions',
		kind: 'normal',
		fixtures: [
			{ name: 'single user', input: '@admin' },
			{ name: 'multiple users', input: '@admin @user1 @moderator' },
			{ name: 'channel', input: '#general' },
			{ name: 'mixed', input: 'Hey @admin check #general and @user1' },
		],
	},
	{
		name: 'Code',
		kind: 'normal',
		fixtures: [
			{ name: 'inline', input: 'Use `console.log()` for debugging' },
			{ name: 'block', input: '```javascript\nconst x = 1;\nconsole.log(x);\n```' },
			{ name: 'multi inline', input: 'Use `Array.map()` and `Array.filter()` and `Array.reduce()`' },
		],
	},
	{
		name: 'Structured Blocks',
		kind: 'normal',
		fixtures: [
			{ name: 'ordered list', input: '1. First item\n2. Second item\n3. Third item' },
			{ name: 'unordered list', input: '- First item\n- Second item\n- Third item' },
			{ name: 'task list', input: '- [x] Done task\n- [ ] Pending task\n- [x] Another done' },
			{ name: 'blockquote', input: '> This is a quoted message\n> with multiple lines' },
			{ name: 'heading', input: '# Hello World' },
			{ name: 'heading multi-level', input: '# H1\n## H2\n### H3\n#### H4' },
			{ name: 'spoiler', input: '||This is a spoiler||' },
			{ name: 'spoiler with formatting', input: '||**bold** and _italic_ spoiler||' },
		],
	},
	{
		name: 'KaTeX (Math)',
		kind: 'normal',
		fixtures: [
			{ name: 'inline', input: 'Easy as \\(E = mc^2\\), right?', options: { katex: { parenthesisSyntax: true } } },
			{
				name: 'block',
				input: `\\[
      \\f\\relax{x} = \\int_{-\\infty}^\\infty
      \\f\\hat\\xi\\,e^{2 \\pi i \\xi x}
      \\,d\\xi
    \\]`,
				options: { katex: { parenthesisSyntax: true } },
			},
		],
	},
	{
		name: 'Adversarial / Stress',
		kind: 'stress',
		time: 2000,
		warmupTime: 500,
		fixtures: [
			{
				name: 'adversarial emphasis',
				input:
					'**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__**_**__',
			},
			{
				name: 'adversarial mixed',
				input: `This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some. , REPEATx2 This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some. REPEAT x3 This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some. REPEAT x4 This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some. REPEATx 5 This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some. , REPEAT x6 This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some. this can go long for some time, repeat x7 This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some. ,repeat x8 This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some.`,
			},
			{ name: 'repeated specials', input: '****____~~~~||||````####>>>>' },
			{
				name: 'long with formatting',
				input: '**bold** _italic_ ~~strike~~ `code` @user #channel :smile: https://example.com '.repeat(10).trim(),
			},
		],
	},
	{
		name: 'Real-World Messages',
		kind: 'normal',
		fixtures: [
			{ name: 'simple', input: 'Hey team, the deploy is done ✅' },
			{
				name: 'medium',
				input:
					'@admin I pushed the fix to `develop` branch. Check https://github.com/RocketChat/Rocket.Chat/pull/12345 for details. :thumbsup:',
			},
			{
				name: 'complex',
				input:
					'**Release Notes v7.0**\n- [x] Fix #12345\n- [ ] Update docs\n\n> Important: check https://docs.rocket.chat\n\ncc @admin @devlead #releases :rocket:',
				options: fullOptions,
			},
		],
	},
	{
		name: 'Timestamps',
		kind: 'normal',
		fixtures: [{ name: 'unix format', input: '<t:1630360800:f>' }],
	},
];

// ── Helpers ────────────────────────────────────────────────────────────────

function formatCategoryResults(rows: BenchRow[]) {
	return rows.map((row) => ({
		'Parser': row.parser,
		'Fixture': row.fixture,
		'ops/sec': Math.round(row.hz).toLocaleString(),
		'Avg (ms)': row.meanMs.toFixed(4),
		'P99 (ms)': row.p99Ms.toFixed(4),
		'Samples': row.samples,
	}));
}

function formatRelativeResults(rows: RelativeRow[]) {
	return rows.map((row) => ({
		'Fixture': row.fixture,
		'Peggy ops/sec': Math.round(row.peggyHz).toLocaleString(),
		'Chevrotain ops/sec': Math.round(row.chevrotainHz).toLocaleString(),
		'Handwritten ops/sec': Math.round(row.handwrittenHz).toLocaleString(),
		'Chevrotain vs Peggy': `${row.chevrotainSpeedup.toFixed(2)}x`,
		'Handwritten vs Peggy': `${row.handwrittenSpeedup.toFixed(2)}x`,
	}));
}

function median(values: number[]): number {
	if (values.length === 0) {
		return 0;
	}

	const sorted = [...values].sort((left, right) => left - right);
	const midpoint = Math.floor(sorted.length / 2);

	return sorted.length % 2 === 0 ? (sorted[midpoint - 1] + sorted[midpoint]) / 2 : sorted[midpoint];
}

function validateParity(fixtures: BenchCategory[]): void {
	for (const category of fixtures) {
		for (const fixture of category.fixtures) {
			const peggyAst = parsePeggy(fixture.input, fixture.options);
			const chevrotainAst = parseChevrotain(fixture.input, fixture.options);
			const handwrittenAst = parseHandwritten(fixture.input, fixture.options);

			assert.deepStrictEqual(chevrotainAst, peggyAst, `AST mismatch in benchmark fixture "${category.name} / ${fixture.name}"`);
			assert.deepStrictEqual(handwrittenAst, peggyAst, `AST mismatch in benchmark fixture "${category.name} / ${fixture.name}"`);
		}
	}
}

function getRelativeRows(rows: BenchRow[]): RelativeRow[] {
	const resultsByFixture = new Map<string, Partial<Record<ParserBenchmark['name'], BenchRow>>>();

	for (const row of rows) {
		const fixtureRows = resultsByFixture.get(row.fixture) ?? {};
		fixtureRows[row.parser] = row;
		resultsByFixture.set(row.fixture, fixtureRows);
	}

	return [...resultsByFixture.entries()].map(([fixture, fixtureRows]) => {
		const { peggy } = fixtureRows;
		const { chevrotain } = fixtureRows;
		const { handwritten } = fixtureRows;

		if (!peggy || !chevrotain || !handwritten) {
			throw new Error(`Missing benchmark results for fixture "${fixture}"`);
		}

		return {
			fixture,
			peggyHz: peggy.hz,
			chevrotainHz: chevrotain.hz,
			handwrittenHz: handwritten.hz,
			chevrotainSpeedup: chevrotain.hz / peggy.hz,
			handwrittenSpeedup: handwritten.hz / peggy.hz,
		};
	});
}

// ── Runner ─────────────────────────────────────────────────────────────────

async function run() {
	let filteredCategories: BenchCategory[];

	if (scope === 'normal') {
		filteredCategories = categories.filter((category) => category.kind === 'normal');
	} else if (scope === 'stress') {
		filteredCategories = categories.filter((category) => category.kind === 'stress');
	} else {
		filteredCategories = categories;
	}

	if (filteredCategories.length === 0) {
		throw new Error(`No benchmark categories found for scope "${scope}"`);
	}

	console.log('='.repeat(72));
	console.log('  @rocket.chat/message-parser — Performance Benchmark Suite');
	console.log('='.repeat(72));
	console.log();
	console.log(`Scope: ${scope}`);
	console.log();

	console.log('Validating AST parity for benchmark fixtures...');
	validateParity(filteredCategories);
	console.log('Parity check passed.');
	console.log();

	// Benchmarks must run sequentially to avoid interference

	const allRows: BenchRow[] = [];
	let currentKind: BenchCategory['kind'] | undefined;

	for (const category of filteredCategories) {
		if (category.kind !== currentKind) {
			currentKind = category.kind;
			console.log(currentKind === 'stress' ? '== Stress / Adversarial Workloads ==' : '== Typical Workloads ==');
			console.log();
		}

		const bench = new Bench({
			time: category.time ?? 1000,
			warmupTime: category.warmupTime ?? 200,
		});

		for (const fixture of category.fixtures) {
			for (const parserBenchmark of parserBenchmarks) {
				bench.add(`${parserBenchmark.name}: ${fixture.name}`, () => parserBenchmark.parse(fixture.input, fixture.options));
			}
		}

		await bench.run();

		console.log(`── ${category.name} ${'─'.repeat(Math.max(0, 56 - category.name.length))}`);
		const categoryRows = bench.tasks.map((task) => {
			const [parser, ...fixtureParts] = task.name.split(': ');
			return {
				category: category.name,
				kind: category.kind,
				fixture: fixtureParts.join(': '),
				parser: parser as ParserBenchmark['name'],
				hz: task.result?.hz ?? 0,
				meanMs: task.result?.mean ?? 0,
				p99Ms: task.result?.p99 ?? 0,
				samples: task.result?.samples?.length ?? 0,
			};
		});

		allRows.push(...categoryRows);
		console.table(formatCategoryResults(categoryRows));
		console.log('Relative speed vs Peggy:');
		console.table(formatRelativeResults(getRelativeRows(categoryRows)));
		console.log();
	}

	const normalRows = getRelativeRows(allRows.filter((row) => row.kind === 'normal'));
	const stressRows = getRelativeRows(allRows.filter((row) => row.kind === 'stress'));
	const slowerChevrotainFixtures = getRelativeRows(allRows)
		.filter((row) => row.chevrotainSpeedup < 1)
		.map((row) => `${row.fixture} (${row.chevrotainSpeedup.toFixed(2)}x)`);
	const slowerHandwrittenFixtures = getRelativeRows(allRows)
		.filter((row) => row.handwrittenSpeedup < 1)
		.map((row) => `${row.fixture} (${row.handwrittenSpeedup.toFixed(2)}x)`);

	console.log('Summary');
	if (normalRows.length > 0) {
		console.log(`  Median Chevrotain speedup across typical workloads: ${median(normalRows.map((row) => row.chevrotainSpeedup)).toFixed(2)}x`);
		console.log(`  Median handwritten speedup across typical workloads: ${median(normalRows.map((row) => row.handwrittenSpeedup)).toFixed(2)}x`);
	}
	if (stressRows.length > 0) {
		console.log(`  Median Chevrotain speedup across stress workloads: ${median(stressRows.map((row) => row.chevrotainSpeedup)).toFixed(2)}x`);
		console.log(`  Median handwritten speedup across stress workloads: ${median(stressRows.map((row) => row.handwrittenSpeedup)).toFixed(2)}x`);
	}
	if (slowerChevrotainFixtures.length > 0) {
		console.log(`  Chevrotain slower fixtures: ${slowerChevrotainFixtures.join(', ')}`);
	} else {
		console.log('  Chevrotain was not slower on any measured fixture.');
	}
	if (slowerHandwrittenFixtures.length > 0) {
		console.log(`  Handwritten slower fixtures: ${slowerHandwrittenFixtures.join(', ')}`);
	} else {
		console.log('  Handwritten was not slower on any measured fixture.');
	}
	console.log();

	console.log('='.repeat(72));
	console.log('  Done.');
	console.log('='.repeat(72));
}

run().catch((err) => {
	console.error(err);
	process.exit(1);
});
