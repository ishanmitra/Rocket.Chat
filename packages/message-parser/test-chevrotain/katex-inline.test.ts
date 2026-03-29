import { parse } from '../src/parsers/chevrotain';
import { inlineKatex, paragraph, plain } from '../tests/helpers';

test.each([
	['Easy as \\(E = mc^2\\), right?', [paragraph([plain('Easy as '), inlineKatex('E = mc^2'), plain(', right?')])]],
])('parses %p', (input, output) => {
	expect(parse(input, { katex: { parenthesisSyntax: true } })).toMatchObject(output);
});
