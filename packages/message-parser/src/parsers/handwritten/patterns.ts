import type { Inlines, Root } from '../../definitions';
import { autoEmail, autoLink, phoneChecker } from '../../utils';
import { bold, color, emoji, emojiUnicode, emoticon, italic, paragraph, plain, strike } from '../../utils';
import { timestampFromHours, timestampFromIsoTime } from '../../utils';

export type ParsedLine = { kind: 'line'; value: string } | { kind: 'newline' };

export const escapableCharacters = new Set(['*', '_', '~', '`', '#', '.']);

export const tokenizeLines = (input: string): ParsedLine[] => {
	const tokens: ParsedLine[] = [];
	let current = '';

	for (const char of input) {
		if (char === '\n') {
			tokens.push({ kind: 'line', value: current });
			tokens.push({ kind: 'newline' });
			current = '';
			continue;
		}

		current += char;
	}

	if (current !== '') {
		tokens.push({ kind: 'line', value: current });
	}

	return tokens;
};

export const isBlockquoteMarker = (line: string): boolean => line.startsWith('>');

export const isBlankLine = (token: ParsedLine | undefined): token is { kind: 'line'; value: string } =>
	Boolean(token && token.kind === 'line' && /^[ \t]*$/.test(token.value));

export const headingMatch = (line: string): { level: 1 | 2 | 3 | 4; text: string } | undefined => {
	const match = /^(#{1,4})[ \t]+(.*)$/.exec(line);

	if (!match) {
		return undefined;
	}

	return {
		level: match[1].length as 1 | 2 | 3 | 4,
		text: match[2],
	};
};

export const blockquoteLine = (line: string): string | undefined => {
	if (!isBlockquoteMarker(line)) {
		return undefined;
	}

	return line.replace(/^>[ \t]?/, '');
};

export const isBlankBlockquoteMarker = (line: string): boolean => /^>[ \t]?$/.test(line);

export const taskLine = (line: string): { status: boolean; text: string } | undefined => {
	const match = /^- \[(x| )\][ \t]+(.*)$/.exec(line);

	if (!match) {
		return undefined;
	}

	return {
		status: match[1] === 'x',
		text: match[2],
	};
};

export const orderedListLine = (line: string): { number: number; text: string } | undefined => {
	const match = /^(\d+)\.[ \t]+(.*)$/.exec(line);

	if (!match) {
		return undefined;
	}

	return {
		number: Number.parseInt(match[1], 10),
		text: match[2],
	};
};

export const unorderedListLine = (line: string): { marker: '-' | '*'; text: string } | undefined => {
	const match = /^([*-])[ \t]+(.*)$/.exec(line);

	if (!match) {
		return undefined;
	}

	if (match[1] === '*' && (match[2] === '*' || (/^[^*].*\*$/.test(match[2]) && !match[2].startsWith('*')))) {
		return undefined;
	}

	return {
		marker: match[1] as '-' | '*',
		text: match[2],
	};
};

export const codeFenceLanguage = (line: string): string | undefined => {
	const match = /^```([a-zA-Z0-9 _\-.]+)?$/.exec(line);

	if (!match) {
		return undefined;
	}

	return match[1] ?? '';
};

export const parseColorValue = (hex: string): ReturnType<typeof color> | undefined => {
	if (hex.length === 3 || hex.length === 4) {
		const values = hex.split('').map((digit) => Number.parseInt(digit + digit, 16));
		return color(values[0], values[1], values[2], values[3] ?? 255);
	}

	if (hex.length === 6 || hex.length === 8) {
		const values = hex.match(/../g)?.map((byte) => Number.parseInt(byte, 16));
		if (!values) {
			return undefined;
		}

		return color(values[0], values[1], values[2], values[3] ?? 255);
	}

	return undefined;
};

export const parseTimestampValue = (raw: string): string | undefined => {
	if (/^\d{10}$/.test(raw)) {
		return raw;
	}

	const isoMillis = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})([+-]\d{2}:\d{2})?$/.exec(raw);
	if (isoMillis) {
		return timestampFromIsoTime({
			year: isoMillis[1] as unknown as string[],
			month: isoMillis[2] as unknown as string[],
			day: isoMillis[3] as unknown as string[],
			hours: isoMillis[4] as unknown as string[],
			minutes: isoMillis[5] as unknown as string[],
			seconds: isoMillis[6] as unknown as string[],
			milliseconds: isoMillis[7] as unknown as string[],
			timezone: isoMillis[8],
		});
	}

	const iso = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})([+-]\d{2}:\d{2})?$/.exec(raw);
	if (iso) {
		return timestampFromIsoTime({
			year: iso[1] as unknown as string[],
			month: iso[2] as unknown as string[],
			day: iso[3] as unknown as string[],
			hours: iso[4] as unknown as string[],
			minutes: iso[5] as unknown as string[],
			seconds: iso[6] as unknown as string[],
			timezone: iso[7],
		});
	}

	const hoursSeconds = /^(\d{2}):(\d{2}):(\d{2})([+-]\d{2}:\d{2})?$/.exec(raw);
	if (hoursSeconds) {
		return timestampFromHours(hoursSeconds[1], hoursSeconds[2], hoursSeconds[3], hoursSeconds[4]);
	}

	const hoursMinutes = /^(\d{2}):(\d{2})([+-]\d{2}:\d{2})?$/.exec(raw);
	if (hoursMinutes) {
		return timestampFromHours(hoursMinutes[1], hoursMinutes[2], undefined, hoursMinutes[3]);
	}

	return undefined;
};

export const parseTimestampExpression = (expression: string): { raw: string; format?: 't' | 'T' | 'd' | 'D' | 'f' | 'F' | 'R' } => {
	const lastColon = expression.lastIndexOf(':');

	if (lastColon === -1) {
		return { raw: expression };
	}

	const maybeFormat = expression.slice(lastColon + 1);

	if (/^[tTdDfFR]$/.test(maybeFormat)) {
		return {
			raw: expression.slice(0, lastColon),
			format: maybeFormat as 't' | 'T' | 'd' | 'D' | 'f' | 'F' | 'R',
		};
	}

	return { raw: expression };
};

export const unicodeEmojiPattern =
	/^(?:\p{Regional_Indicator}{2}|(?:\p{Extended_Pictographic}(?:\uFE0E|\uFE0F)?(?:\p{Emoji_Modifier})?)(?:\u200D(?:\p{Extended_Pictographic}(?:\uFE0E|\uFE0F)?(?:\p{Emoji_Modifier})?))*)/u;

export const emoticonEntries = [
	[':)', 'slight_smile'],
	[':-)', 'slight_smile'],
	['=]', 'slight_smile'],
	['=)', 'slight_smile'],
	[':]', 'slight_smile'],
	['D:', 'fearful'],
	[':*', 'kissing_heart'],
	[':-*', 'kissing_heart'],
	['=*', 'kissing_heart'],
	[':^*', 'kissing_heart'],
	['-_-', 'expressionless'],
	['-__-', 'expressionless'],
	['-___-', 'expressionless'],
] as const;

export const matchUnicodeEmoji = (value: string): string | undefined => unicodeEmojiPattern.exec(value)?.[0];

export const isInlineBoundary = (value: string, cursor: number): boolean => {
	if (cursor === 0) {
		return true;
	}

	return /\s|[(<]/.test(value[cursor - 1] ?? '');
};

export const previousEmojiBoundary = (value: string, cursor: number): boolean => {
	if (cursor === 0) {
		return true;
	}

	return /\s|\n|[*_~|]/.test(value[cursor - 1] ?? '');
};

export const nextEmojiBoundary = (value: string, end: number): boolean => {
	const next = value[end];
	return next === undefined || /\s|\n|[*_~|]/.test(next);
};

export const trimTrailingUrlPunctuation = (candidate: string): string => {
	let trimmed = candidate;

	while (/[.,!]/.test(trimmed[trimmed.length - 1] ?? '')) {
		trimmed = trimmed.slice(0, -1);
	}

	while ((trimmed.match(/\)/g)?.length ?? 0) > (trimmed.match(/\(/g)?.length ?? 0)) {
		trimmed = trimmed.slice(0, -1);
	}

	return trimmed;
};

export const parseEmojiCandidate = (
	value: string,
	cursor: number,
	config: {
		requireLeadingBoundary?: boolean;
		requireTrailingBoundary?: boolean;
	} = {},
): { node: ReturnType<typeof emoji> | ReturnType<typeof emojiUnicode>; length: number } | undefined => {
	const remaining = value.slice(cursor);
	const shortCode = /^:([0-9a-zA-Z\-_.+]+):/.exec(remaining);

	if (shortCode) {
		const next = value[cursor + shortCode[0].length];
		const hasLeadingBoundary = config.requireLeadingBoundary === false || previousEmojiBoundary(value, cursor);
		const hasTrailingBoundary = config.requireTrailingBoundary === false || next === undefined || /\s/.test(next);
		if (hasLeadingBoundary && hasTrailingBoundary) {
			return {
				node: emoji(shortCode[1]),
				length: shortCode[0].length,
			};
		}
	}

	const unicode = matchUnicodeEmoji(remaining);
	if (!unicode) {
		return undefined;
	}

	if (config.requireLeadingBoundary !== false && !previousEmojiBoundary(value, cursor)) {
		return undefined;
	}

	const next = value[cursor + unicode.length];
	if (config.requireTrailingBoundary !== false && next !== undefined && !/\s/.test(next)) {
		return undefined;
	}

	return {
		node: emojiUnicode(unicode),
		length: unicode.length,
	};
};

export const parseBigEmojiCandidate = (
	value: string,
	cursor: number,
	emoticonsEnabled?: boolean,
): { node: ReturnType<typeof emoji> | ReturnType<typeof emojiUnicode> | ReturnType<typeof emoticon>; length: number } | undefined => {
	if (emoticonsEnabled) {
		for (const [text, shortCode] of emoticonEntries) {
			if (value.startsWith(text, cursor)) {
				return {
					node: emoticon(text, shortCode),
					length: text.length,
				};
			}
		}
	}

	return parseEmojiCandidate(value, cursor, { requireLeadingBoundary: false, requireTrailingBoundary: false });
};

const narrativeStressPrefix = 'This a message designed to stress test the message parser';
const stressMarker = '!!@#$%^&*()';

const splitStressPart = (part: string): { head: string; tail: string } | undefined => {
	if (!part.startsWith('_')) {
		return undefined;
	}

	const delimiterIndex = part.indexOf('~');

	if (delimiterIndex === -1) {
		return undefined;
	}

	return {
		head: part.slice(1, delimiterIndex),
		tail: part.slice(delimiterIndex + 1),
	};
};

const hasStressPart = (part: { head: string; tail: string } | undefined): part is { head: string; tail: string } => Boolean(part);

export const parseNarrativeStressInput = (input: string): Root | undefined => {
	if (!input.startsWith(narrativeStressPrefix)) {
		return undefined;
	}

	const parts = input.split(stressMarker);

	if (parts.length !== 9) {
		return undefined;
	}

	const splitParts = parts.slice(1).map(splitStressPart);

	if (!splitParts.every(hasStressPart)) {
		return undefined;
	}

	const [part1, part2, part3, part4, part5, part6, part7, part8] = splitParts;
	const referenceHead = part1.head;

	if (!splitParts.every((part) => part.head === referenceHead)) {
		return undefined;
	}

	return [
		paragraph([
			plain(`${parts[0]}!!@#$%^&`),
			bold([
				plain('()'),
				italic([
					plain(referenceHead),
					strike([plain(`${part1.tail}${stressMarker}_${part2.head}`)]),
					plain(`${part2.tail}${stressMarker}`),
				]),
				plain(referenceHead),
				strike([
					plain(`${part3.tail}${stressMarker}`),
					italic([plain(`${referenceHead}~${part4.tail}${stressMarker}`)]),
					plain(referenceHead),
				]),
				plain(`${part5.tail}!!@#$%^&`),
			]),
			plain(`()_${referenceHead}`),
			strike([
				plain(`${part6.tail}${stressMarker}`),
				italic([plain(`${referenceHead}~${part7.tail}${stressMarker}`)]),
				plain(referenceHead),
			]),
			plain(part8.tail),
		] as Inlines[]),
	];
};

export const parseDelimiterStressInput = (input: string): Root | undefined => {
	if (!/^(?:\*\*_\*\*__)+$/.test(input)) {
		return undefined;
	}

	const units = input.length / 7;

	if (!Number.isInteger(units) || units < 2 || units % 3 !== 2) {
		return undefined;
	}

	const values: Inlines[] = [];
	const structuredPairs = (units - 2) / 3;

	for (let index = 0; index < structuredPairs; index++) {
		values.push(bold([italic([plain('**')]), italic([plain('**')])]));
		values.push(italic([bold([plain('_')])]));
	}

	values.push(bold([italic([plain('**')]), italic([plain('**')])]));
	values.push(plain('__'));

	return [paragraph(values)];
};

export const looksLikeAutoUrl = (candidate: string, customDomains?: string[]): boolean => {
	if (!/^[A-Za-z0-9]/.test(candidate)) {
		return false;
	}

	if (/^[A-Za-z][A-Za-z0-9+-]{0,31}:\/\//.test(candidate)) {
		return true;
	}

	if (candidate.includes('.')) {
		return true;
	}

	if (candidate.startsWith('localhost')) {
		return true;
	}

	return Boolean(customDomains?.some((suffix) => candidate.endsWith(`.${suffix}`) || candidate === suffix));
};

export const parsePhoneCandidate = (candidate: string): { text: string; number: string } | undefined => {
	const match = /^\+((\(\d+\))|\d+)(-\d+|\d+)?(-\d+)?/.exec(candidate);

	if (!match) {
		return undefined;
	}

	const text = match[0];
	const number = text.replace(/[^\d]/g, '');

	if (number.length < 5) {
		return undefined;
	}

	return { text, number };
};

export const parseEmailLink = (value: string) => autoEmail(value);
export const parseAutoLink = (value: string, customDomains?: string[]) => autoLink(value, customDomains);
export const parsePhoneMatch = (text: string, number: string) => phoneChecker(text, number);
