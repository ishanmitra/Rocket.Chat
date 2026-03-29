import { parse } from '../src/parsers/chevrotain';
import { link, paragraph, plain, bold, quote, lineBreak, unorderedList, listItem, orderedList } from '../tests/helpers';

test.each([
	['<https://domain.com|Test>', [paragraph([link('https://domain.com', [plain('Test')])])]],
	['[title](https://rocket.chat)', [paragraph([link('https://rocket.chat', [plain('title')])])]],
	['[**title**](https://rocket.chat)', [paragraph([link('https://rocket.chat', [bold([plain('title')])])])]],
	['[](https://rocket.chat)', [paragraph([link('https://rocket.chat')])]],
	['google.com', [paragraph([link('//google.com', [plain('google.com')])])]],
	['www.google.com', [paragraph([link('//www.google.com', [plain('www.google.com')])])]],
	['rocket.chat:8080', [paragraph([link('rocket.chat:8080')])]],
	['[custom](custom://google.com)', [paragraph([link('custom://google.com', [plain('custom')])])]],
	['[File Path](C:/Users/user1/Documents/projects/file.js)', [paragraph([link('C:/Users/user1/Documents/projects/file.js', [plain('File Path')])])]],
	[
		`[Rocket.Chat](https://rocket.chat)
Text after in a new line after link`,
		[paragraph([link('https://rocket.chat', [plain('Rocket.Chat')])]), paragraph([plain('Text after in a new line after link')])],
	],
	[
		`[Rocket.Chat](https://rocket.chat)

Text after line break`,
		[paragraph([link('https://rocket.chat', [plain('Rocket.Chat')])]), lineBreak(), paragraph([plain('Text after line break')])],
	],
	[
		`
[List Header Link](https://rocket.chat)
- First item
- Second item
`.trim(),
		[
			paragraph([link('https://rocket.chat', [plain('List Header Link')])]),
			unorderedList([listItem([plain('First item')]), listItem([plain('Second item')])]),
		],
	],
	[
		`[List Header Link](https://rocket.chat)
7. First item
2. Second item
`.trim(),
		[
			paragraph([link('https://rocket.chat', [plain('List Header Link')])]),
			orderedList([listItem([plain('First item')], 7), listItem([plain('Second item')], 2)]),
		],
	],
	[
		`<https://domain.com|Test
> quote here`,
		[paragraph([plain('<https://domain.com|Test')]), quote([paragraph([plain('quote here')])])],
	],
])('parses %p', (input, output) => {
	expect(parse(input)).toMatchObject(output);
});
