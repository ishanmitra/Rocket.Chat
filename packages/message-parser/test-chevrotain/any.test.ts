import { parse } from '../src/parsers/chevrotain';
import { paragraph, plain } from '../tests/helpers';

test.each([
	['free text', [paragraph([plain('free text')])]],
	['free text, with comma', [paragraph([plain('free text, with comma')])]],
	['free text with unxpected/unfinished blocks *bold_', [paragraph([plain('free text with unxpected/unfinished blocks *bold_')])]],
])('parses %p', (input, output) => {
	expect(parse(input)).toMatchObject(output);
});
