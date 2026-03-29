import { parse } from '../src/parsers/chevrotain';
import { katex } from '../tests/helpers';

test.each([
	[
		`\\[
      \\f\\relax{x} = \\int_{-\\infty}^\\infty
      \\f\\hat\\xi\\,e^{2 \\pi i \\xi x}
      \\,d\\xi
    \\]`,
		[
			katex(`
      \\f\\relax{x} = \\int_{-\\infty}^\\infty
      \\f\\hat\\xi\\,e^{2 \\pi i \\xi x}
      \\,d\\xi
    `),
		],
	],
])('parses %p', (input, output) => {
	expect(parse(input, { katex: { parenthesisSyntax: true } })).toMatchObject(output);
});
