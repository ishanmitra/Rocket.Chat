import { parse } from '../src/parsers/chevrotain';
import { bold, emoji, italic, link, mentionChannel, mentionUser, paragraph, plain, spoiler, strike } from '../tests/helpers';

describe('spoiler parsing', () => {
	test.each([
		['||spoiler||', [paragraph([spoiler([plain('spoiler')])])]],
		['||spoiler **bold**||', [paragraph([spoiler([plain('spoiler '), bold([plain('bold')])])])]],
		['||__i__ ~~s~~||', [paragraph([spoiler([italic([plain('i')]), plain(' '), strike([plain('s')])])])]],
		['||unclosed', [paragraph([plain('||unclosed')])]],
	])('parses basic spoilers: %p', (input, output) => {
		expect(parse(input)).toMatchObject(output);
	});

	test.each([
		['||**bold __italic__**||', [paragraph([spoiler([bold([plain('bold '), italic([plain('italic')])])])])]],
		['||~~**strike bold**~~||', [paragraph([spoiler([strike([bold([plain('strike bold')])])])])]],
		['||@user mention||', [paragraph([spoiler([mentionUser('user'), plain(' mention')])])]],
		['||#channel mention||', [paragraph([spoiler([mentionChannel('channel'), plain(' mention')])])]],
		['||[link text](https://example.com)||', [paragraph([spoiler([link('https://example.com', [plain('link text')])])])]],
		['||text :emoji: text||', [paragraph([spoiler([plain('text '), emoji('emoji'), plain(' text')])])]],
		['||||', [paragraph([plain('||||')])]],
		['||first|| and ||second||', [paragraph([spoiler([plain('first')]), plain(' and '), spoiler([plain('second')])])]],
		['||special: !@#$%^&*()||', [paragraph([spoiler([plain('special: !@#$%^&*()')])])]],
		['||unclosed spoiler', [paragraph([plain('||unclosed spoiler')])]],
		['text ||unclosed', [paragraph([plain('text ||unclosed')])]],
		['|single pipe|', [paragraph([plain('|single pipe|')])]],
		['||start|| middle ||end||', [paragraph([spoiler([plain('start')]), plain(' middle '), spoiler([plain('end')])])]],
	])('parses edge cases: %p', (input, output) => {
		expect(parse(input)).toMatchObject(output);
	});
});
