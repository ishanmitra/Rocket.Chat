import { parse } from '../src/parsers/chevrotain';
import { lineBreak, paragraph, plain } from '../tests/helpers';

test.each([
	[
		`test

test2`,
		[paragraph([plain('test')]), lineBreak(), paragraph([plain('test2')])],
	],
	[
		`test

test2
`,
		[paragraph([plain('test')]), lineBreak(), paragraph([plain('test2')])],
	],
	[
		`test



test2
`,
		[paragraph([plain('test')]), lineBreak(), lineBreak(), lineBreak(), paragraph([plain('test2')])],
	],
])('parses %p', (input, output) => {
	expect(parse(input)).toMatchObject(output);
});
