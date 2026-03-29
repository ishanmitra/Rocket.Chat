import { parse } from '../src/parsers/chevrotain';
import { bigEmoji, paragraph, plain, emoticon } from '../tests/helpers';

test.each([
	[
		`test
     :) test`,
		[paragraph([plain('test')]), paragraph([plain('     '), emoticon(':)', 'slight_smile'), plain(' test')])],
	],
	[':) asd', [paragraph([emoticon(':)', 'slight_smile'), plain(' asd')])]],
	[' :) asd', [paragraph([plain(' '), emoticon(':)', 'slight_smile'), plain(' asd')])]],
	['Hi :)', [paragraph([plain('Hi '), emoticon(':)', 'slight_smile')])]],
	[
		':) :)',
		[bigEmoji([emoticon(':)', 'slight_smile'), emoticon(':)', 'slight_smile')])],
	],
	[':)', [bigEmoji([emoticon(':)', 'slight_smile')])]],
	[' D: D: D: ', [bigEmoji([emoticon('D:', 'fearful'), emoticon('D:', 'fearful'), emoticon('D:', 'fearful')])]],
	['Hi D:', [paragraph([plain('Hi '), emoticon('D:', 'fearful')])]],
	['normal emojis :):):)', [paragraph([plain('normal emojis :):):)')])]],
	['he:)llo', [paragraph([plain('he:)llo')])]],
	[':)Hi', [paragraph([plain(':)Hi')])]],
	['Hi:)', [paragraph([plain('Hi:)')])]],
])('parses %p', (input, output) => {
	expect(parse(input, { emoticons: true })).toMatchObject(output);
});
