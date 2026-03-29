import { parse } from '../src/parsers/chevrotain';
import { lineBreak, paragraph, plain, link } from '../tests/helpers';

test.each([
	['https://pt.wikipedia.org/', [paragraph([link('https://pt.wikipedia.org/')])]],
	['https://rocket.chat', [paragraph([link('https://rocket.chat')])]],
	['https://rocket.chat:3000/test', [paragraph([link('https://rocket.chat:3000/test')])]],
	['https://localhost:3000#fragment', [paragraph([link('https://localhost:3000#fragment')])]],
	['ftp://example.com', [paragraph([link('ftp://example.com')])]],
	['www.n-tv.de, test', [paragraph([link('//www.n-tv.de', [plain('www.n-tv.de')]), plain(', test')])]],
	['https://www.google.com.', [paragraph([link('https://www.google.com'), plain('.')])]],
	['visit www.google.com.', [paragraph([plain('visit '), link('//www.google.com', [plain('www.google.com')]), plain('.')])]],
	[
		'https://developer.rocket.chat?query=query\n\nline break',
		[paragraph([link('https://developer.rocket.chat?query=query')]), lineBreak(), paragraph([plain('line break')])],
	],
	['https://internaltool.testt', [paragraph([plain('https://internaltool.testt')])]],
])('parses %p', (input, output) => {
	expect(parse(input, { customDomains: ['local'] })).toMatchObject(output);
});

test.each([
	['gitlab.local', [paragraph([link('//gitlab.local', [plain('gitlab.local')])])]],
	['internaltool.intranet', [paragraph([link('//internaltool.intranet', [plain('internaltool.intranet')])])]],
])('parses with custom domains %p', (input, output) => {
	expect(parse(input, { customDomains: ['local', 'intranet'] })).toMatchObject(output);
});
