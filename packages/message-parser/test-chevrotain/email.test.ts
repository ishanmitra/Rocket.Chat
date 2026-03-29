import { parse } from '../src/parsers/chevrotain';
import { link, paragraph, plain } from '../tests/helpers';

test.each([
	['joe@joe.com', [paragraph([link('mailto:joe@joe.com', [plain('joe@joe.com')])])]],
	["joe@joe.com is Joe's email", [paragraph([link('mailto:joe@joe.com', [plain('joe@joe.com')]), plain(" is Joe's email")])]],
	[
		"Joe's email is joe@joe.com because it is",
		[paragraph([plain("Joe's email is "), link('mailto:joe@joe.com', [plain('joe@joe.com')]), plain(' because it is')])],
	],
	[
		"Joe's email is (joe@joe.com)",
		[paragraph([plain("Joe's email is ("), link('mailto:joe@joe.com', [plain('joe@joe.com')]), plain(')')])],
	],
	['My email is mailto:asdf@asdf.com', [paragraph([plain('My email is '), link('mailto:asdf@asdf.com', [plain('asdf@asdf.com')])])]],
	['My email is fake@gmail.c', [paragraph([plain('My email is fake@gmail.c')])]],
])('parses %p', (input, output) => {
	expect(parse(input)).toMatchObject(output);
});
