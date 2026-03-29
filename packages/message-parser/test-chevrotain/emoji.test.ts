import { parse } from '../src/parsers/chevrotain';
import { emoji, bigEmoji, paragraph, plain, emojiUnicode } from '../tests/helpers';

test.each([
	[':smile: asd', [paragraph([emoji('smile'), plain(' asd')])]],
	[':smile:asd', [paragraph([plain(':smile:asd')])]],
	['text:inner:outer', [paragraph([plain('text:inner:outer')])]],
	['10:20:30', [paragraph([plain('10:20:30')])]],
	['" :smile: "', [paragraph([plain('" '), emoji('smile'), plain(' "')])]],
	[
		`:smile:
  :smile:
  `,
		[bigEmoji([emoji('smile'), emoji('smile')])],
	],
	['asdas :smile: asd', [paragraph([plain('asdas '), emoji('smile'), plain(' asd')])]],
	[':smile::smile::smile:', [bigEmoji([emoji('smile'), emoji('smile'), emoji('smile')])]],
	[':smile::smile:', [bigEmoji([emoji('smile'), emoji('smile')])]],
	[':smile:a:smile:', [paragraph([plain(':smile:a:smile:')])]],
	[':smile:', [bigEmoji([emoji('smile')])]],
	['Hi :+1:', [paragraph([plain('Hi '), emoji('+1')])]],
])('parses shortcode emoji %p', (input, output) => {
	expect(parse(input)).toMatchObject(output);
});

test.each([
	['😀', [bigEmoji([emojiUnicode('😀')])]],
	['⚽️', [bigEmoji([emojiUnicode('⚽️')])]],
	['👨‍👩‍👧‍👦', [bigEmoji([emojiUnicode('👨‍👩‍👧‍👦')])]],
	['🧑🏾‍💻🧑🏾‍💻', [bigEmoji([emojiUnicode('🧑🏾‍💻'), emojiUnicode('🧑🏾‍💻')])]],
	['👆🏽👆🏽👆🏽', [bigEmoji([emojiUnicode('👆🏽'), emojiUnicode('👆🏽'), emojiUnicode('👆🏽')])]],
	['👆🏺', [bigEmoji([emojiUnicode('👆'), emojiUnicode('🏺')])]],
	['Hi 👍', [paragraph([plain('Hi '), emojiUnicode('👍')])]],
])('parses unicode emoji %p', (input, output) => {
	expect(parse(input)).toMatchObject(output);
});
