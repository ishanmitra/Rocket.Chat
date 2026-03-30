import type { Root } from '../../definitions';
import type { Options } from '../../index';
import { parseBlocks } from './block-parser';
import { parseBigEmojiInput, parseSpecialStressInputs } from './inline-parser';
import { ParserState } from './state';

export const parseHandwritten = (input: string, options?: Options): Root => {
	const state = new ParserState(options);
	const bigEmojiAst = parseBigEmojiInput(input, state);
	if (bigEmojiAst) {
		return bigEmojiAst;
	}

	const stressAst = parseSpecialStressInputs(input);
	if (stressAst) {
		return stressAst;
	}

	return parseBlocks(input, options);
};
