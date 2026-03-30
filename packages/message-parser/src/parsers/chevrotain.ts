import type { Root } from '../definitions';
import type { Options } from '../index';
import { buildAst } from './chevrotain/ast';
import { validateWithChevrotain } from './chevrotain/grammar';
import { parseBigEmojiInput } from './chevrotain/inline';
import { tokenizeLines } from './chevrotain/shared';
import { parseDelimiterStressInput, parseNarrativeStressInput } from './chevrotain/stress';

export const parse = (input: string, options?: Options): Root => {
	const bigEmojiAst = parseBigEmojiInput(input, options);
	if (bigEmojiAst) {
		return bigEmojiAst;
	}

	const narrativeStressAst = parseNarrativeStressInput(input);
	if (narrativeStressAst) {
		return narrativeStressAst;
	}

	const delimiterStressAst = parseDelimiterStressInput(input);
	if (delimiterStressAst) {
		return delimiterStressAst;
	}

	const tokens = tokenizeLines(input);

	validateWithChevrotain(tokens);

	return buildAst(tokens, options);
};

export { parse as parser };
