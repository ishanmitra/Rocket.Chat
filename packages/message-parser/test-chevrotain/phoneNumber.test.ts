import { parse } from '../src/parsers/chevrotain';
import { link, paragraph, plain, bold } from '../tests/helpers';

test.each([
	['+07563546725', [paragraph([link('tel:07563546725', [plain('+07563546725')])])]],
	['+075-63546725', [paragraph([link('tel:07563546725', [plain('+075-63546725')])])]],
	['+(075)-63546725', [paragraph([link('tel:07563546725', [plain('+(075)-63546725')])])]],
	['[here](+(075)63546725)', [paragraph([link('tel:07563546725', [plain('here')])])]],
	['[**here**](+(075)63546725)', [paragraph([link('tel:07563546725', [bold([plain('here')])])])]],
	['5 +51231 5', [paragraph([plain('5 '), link('tel:51231', [plain('+51231')]), plain(' 5')])]],
	['+1234', [paragraph([plain('+1234')])]],
	['5+51231', [paragraph([plain('5+51231')])]],
])('parses %p', (input, output) => {
	expect(parse(input)).toMatchObject(output);
});
