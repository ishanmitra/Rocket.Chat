import type { Inlines, Root } from '../../definitions';
import type { Options } from '../../index';
import {
	autoEmail,
	autoLink,
	bigEmoji,
	bold,
	color,
	emoji,
	emojiUnicode,
	emoticon,
	image,
	inlineCode,
	inlineKatex,
	italic,
	link,
	mentionChannel,
	mentionUser,
	phoneChecker,
	plain,
	spoiler,
	strike,
	timestamp,
	timestampFromHours,
	timestampFromIsoTime,
} from '../../utils';

const escapableCharacters = new Set(['*', '_', '~', '`', '#', '.']);

const parseColorValue = (hex: string): ReturnType<typeof color> | undefined => {
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

const parseTimestampValue = (raw: string): string | undefined => {
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

const parseTimestampExpression = (expression: string): { raw: string; format?: 't' | 'T' | 'd' | 'D' | 'f' | 'F' | 'R' } => {
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

const isInlineBoundary = (value: string, cursor: number): boolean => {
	if (cursor === 0) {
		return true;
	}

	return /\s|[(<]/.test(value[cursor - 1] ?? '');
};

const trimTrailingUrlPunctuation = (candidate: string): string => {
	let trimmed = candidate;

	while (/[.,!]/.test(trimmed[trimmed.length - 1] ?? '')) {
		trimmed = trimmed.slice(0, -1);
	}

	while ((trimmed.match(/\)/g)?.length ?? 0) > (trimmed.match(/\(/g)?.length ?? 0)) {
		trimmed = trimmed.slice(0, -1);
	}

	return trimmed;
};

const unicodeEmojiPattern =
	/^(?:\p{Regional_Indicator}{2}|(?:\p{Extended_Pictographic}(?:\uFE0E|\uFE0F)?(?:\p{Emoji_Modifier})?)(?:\u200D(?:\p{Extended_Pictographic}(?:\uFE0E|\uFE0F)?(?:\p{Emoji_Modifier})?))*)/u;

const emoticonEntries = [
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

const matchUnicodeEmoji = (value: string): string | undefined => unicodeEmojiPattern.exec(value)?.[0];

const previousEmojiBoundary = (value: string, cursor: number): boolean => {
	if (cursor === 0) {
		return true;
	}

	return /\s|\n|[*_~|]/.test(value[cursor - 1] ?? '');
};

const nextEmojiBoundary = (value: string, end: number): boolean => {
	const next = value[end];
	return next === undefined || /\s|\n|[*_~|]/.test(next);
};

const parseEmojiCandidate = (
	value: string,
	cursor: number,
	config: {
		requireLeadingBoundary?: boolean;
		requireTrailingBoundary?: boolean;
	} = {},
): { node: ReturnType<typeof emoji>; length: number } | undefined => {
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

const parseBigEmojiCandidate = (
	value: string,
	cursor: number,
	options?: Options,
): { node: ReturnType<typeof emoji>; length: number } | undefined => {
	if (options?.emoticons) {
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

const parseEmoticonCandidate = (
	value: string,
	cursor: number,
	options?: Options,
): { node: ReturnType<typeof emoticon>; length: number } | undefined => {
	if (!options?.emoticons) {
		return undefined;
	}

	for (const [text, shortCode] of emoticonEntries) {
		if (!value.startsWith(text, cursor)) {
			continue;
		}

		const end = cursor + text.length;

		if (!previousEmojiBoundary(value, cursor) || !nextEmojiBoundary(value, end)) {
			continue;
		}

		return {
			node: emoticon(text, shortCode),
			length: text.length,
		};
	}

	return undefined;
};

export const parseBigEmojiInput = (input: string, options?: Options): Root | undefined => {
	const trimmed = input.trim();
	if (!trimmed) {
		return undefined;
	}

	const values = [] as Array<ReturnType<typeof emoji>>;
	let cursor = 0;

	while (cursor < trimmed.length) {
		const char = trimmed[cursor];

		if (/\s/.test(char)) {
			cursor += 1;
			continue;
		}

		const emojiCandidate = parseBigEmojiCandidate(trimmed, cursor, options);
		if (emojiCandidate) {
			values.push(emojiCandidate.node as any);
			cursor += emojiCandidate.length;
			continue;
		}

		return undefined;
	}

	if (values.length < 1 || values.length > 3) {
		return undefined;
	}

	return [bigEmoji(values as any)];
};

const looksLikeAutoUrl = (candidate: string, options?: Options): boolean => {
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

	return Boolean(options?.customDomains?.some((suffix) => candidate.endsWith(`.${suffix}`) || candidate === suffix));
};

const parsePhoneCandidate = (candidate: string): { text: string; number: string } | undefined => {
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

type InlineConfig = {
	allowTimestamp?: boolean;
	allowBold?: boolean;
	allowItalic?: boolean;
	allowStrike?: boolean;
	allowSpoiler?: boolean;
	allowReferences?: boolean;
	allowMentions?: boolean;
	allowAutolink?: boolean;
};

const parseMarkdownReference = (
	value: string,
	cursor: number,
): { node: ReturnType<typeof link> | ReturnType<typeof image>; length: number } | undefined => {
	if (value[cursor - 1] === '\\') {
		return undefined;
	}

	const isImageRef = value[cursor] === '!' && value[cursor + 1] === '[';
	const start = isImageRef ? cursor + 1 : cursor;

	if (value[start] !== '[') {
		return undefined;
	}

	let closeTitle = -1;

	for (let index = start + 1; index < value.length - 1; index++) {
		if (value[index] === '\\') {
			index += 1;
			continue;
		}

		if (value[index] === ']' && value[index + 1] === '(') {
			closeTitle = index;
			break;
		}
	}

	if (closeTitle === -1) {
		return undefined;
	}

	let hrefEnd = closeTitle + 2;
	let depth = 1;

	while (hrefEnd < value.length && depth > 0) {
		const char = value[hrefEnd];

		if (char === '(') {
			depth += 1;
		} else if (char === ')') {
			depth -= 1;
			if (depth === 0) {
				break;
			}
		}

		hrefEnd += 1;
	}

	if (depth !== 0) {
		return undefined;
	}

	const rawTitle = value.slice(start + 1, closeTitle);
	const rawHref = value.slice(closeTitle + 2, hrefEnd);
	const phone = parsePhoneCandidate(rawHref);
	const href = phone ? `tel:${phone.number}` : rawHref;
	const length = hrefEnd - cursor + 1;

	if (/\]\s+\[/.test(rawTitle)) {
		return undefined;
	}

	if (isImageRef) {
		return {
			node: image(href, rawTitle ? plain(rawTitle) : plain(href)),
			length,
		};
	}

	return {
		node: link(
			href,
			rawTitle
				? (parseInlineSegment(rawTitle, undefined, {
						allowTimestamp: false,
						allowBold: true,
						allowStrike: true,
						allowReferences: false,
						allowAutolink: false,
						allowMentions: false,
					}) as any)
				: undefined,
		),
		length,
	};
};

const parseAngleReference = (value: string, cursor: number): { node: ReturnType<typeof link>; length: number } | undefined => {
	if (value[cursor - 1] === '\\') {
		return undefined;
	}

	if (value[cursor] !== '<') {
		return undefined;
	}

	const end = value.indexOf('>', cursor + 1);
	if (end === -1) {
		return undefined;
	}

	const content = value.slice(cursor + 1, end);
	const separator = content.indexOf('|');

	if (separator === -1) {
		return undefined;
	}

	const href = content.slice(0, separator);
	const title = content.slice(separator + 1);

	if (!href || !title || /[\r\n]/.test(content)) {
		return undefined;
	}

	return {
		node: link(href, [plain(title)]),
		length: end - cursor + 1,
	};
};

const parseEmailCandidate = (value: string, cursor: number): { node: ReturnType<typeof link>; length: number } | undefined => {
	if (!isInlineBoundary(value, cursor)) {
		return undefined;
	}

	const match = /^(mailto:)?([^\s()@`][^\s()]*@[^\s()]+\.[^\s().,!?]+)/.exec(value.slice(cursor));
	if (!match) {
		return undefined;
	}

	const address = match[2];
	const linked = autoEmail(address);

	if (linked.type !== 'LINK') {
		return undefined;
	}

	return {
		node: match[1] ? link(`mailto:${address}`, [plain(address)]) : linked,
		length: match[0].length,
	};
};

const parsePhoneLink = (value: string, cursor: number): { node: ReturnType<typeof link>; length: number } | undefined => {
	if (!isInlineBoundary(value, cursor) || value[cursor] !== '+') {
		return undefined;
	}

	const parsed = parsePhoneCandidate(value.slice(cursor));

	if (!parsed) {
		return undefined;
	}

	const linked = phoneChecker(parsed.text, parsed.number);

	if (linked.type !== 'LINK') {
		return undefined;
	}

	return {
		node: linked,
		length: parsed.text.length,
	};
};

const parseAutoUrlCandidate = (
	value: string,
	cursor: number,
	options?: Options,
): { node: ReturnType<typeof link>; length: number } | undefined => {
	if (!isInlineBoundary(value, cursor)) {
		return undefined;
	}

	const raw = /^[^\s<>]+/.exec(value.slice(cursor))?.[0];
	if (!raw) {
		return undefined;
	}

	const candidate = trimTrailingUrlPunctuation(raw);
	if (!candidate) {
		return undefined;
	}

	if (/^[A-Za-z][A-Za-z0-9+-]{0,31}:\/(?!\/)/.test(candidate)) {
		return undefined;
	}

	if (candidate.includes('://') && !/^[A-Za-z][A-Za-z0-9+-]{0,31}:\/\//.test(candidate)) {
		return undefined;
	}

	if (!looksLikeAutoUrl(candidate, options)) {
		return undefined;
	}

	const linked = autoLink(candidate, options?.customDomains);

	if (linked.type !== 'LINK') {
		return undefined;
	}

	return {
		node: linked,
		length: candidate.length,
	};
};

const isMentionBoundary = (value: string, cursor: number): boolean => {
	if (cursor === 0) {
		return true;
	}

	return /[\s*_~|]/.test(value[cursor - 1] ?? '');
};

const isAlphaNumeric = (value: string | undefined): boolean => Boolean(value && /[0-9A-Za-z]/.test(value));

const isUnderscoreOpeningBoundary = (value: string, cursor: number): boolean => !isAlphaNumeric(value[cursor - 1]);

const isUnderscoreClosingBoundary = (value: string, cursor: number, delimiterLength: number): boolean =>
	!isAlphaNumeric(value[cursor + delimiterLength]);

const hasRepeatedDelimiter = (value: string, cursor: number, delimiter: string): boolean =>
	value[cursor + delimiter.length] === delimiter[0];

const isEmoticonCloser = (value: string, cursor: number, options?: Options): boolean =>
	Boolean(parseEmoticonCandidate(value, cursor - 1, options));

const hasBalancedDoubleTildes = (content: string): boolean => (content.match(/~~/g)?.length ?? 0) % 2 === 0;

const isUnderscoreMentionTail = (value: string, candidateIndex: number, openerIndex: number): boolean => {
	const segmentStart = Math.max(openerIndex + 1, value.lastIndexOf(' ', candidateIndex - 1) + 1);
	const raw = value.slice(segmentStart);
	const mention = /^@([^\s,:@]+(?:[:@][^\s,:@]+)?)/.exec(raw);

	return Boolean(mention && segmentStart + mention[0].length === candidateIndex + 1);
};

const findDelimitedContent = (
	value: string,
	cursor: number,
	open: string,
	close: string,
	options: Options | undefined,
	isValidOpen?: () => boolean,
	isValidCloser?: (candidateIndex: number) => boolean,
	isValidContent?: (content: string) => boolean,
): { content: string; length: number } | undefined => {
	if (!value.startsWith(open, cursor)) {
		return undefined;
	}

	if (isValidOpen && !isValidOpen()) {
		return undefined;
	}

	let candidateIndex = cursor + open.length;

	while (candidateIndex <= value.length - close.length) {
		candidateIndex = value.indexOf(close, candidateIndex);

		if (candidateIndex === -1) {
			return undefined;
		}

		if (isEmoticonCloser(value, candidateIndex, options)) {
			candidateIndex += 1;
			continue;
		}

		if (isValidCloser && !isValidCloser(candidateIndex)) {
			candidateIndex += 1;
			continue;
		}

		const content = value.slice(cursor + open.length, candidateIndex);

		if (content.trim() === '') {
			candidateIndex += 1;
			continue;
		}

		if (isValidContent && !isValidContent(content)) {
			candidateIndex += 1;
			continue;
		}

		return {
			content,
			length: candidateIndex + close.length - cursor,
		};
	}

	return undefined;
};

const parseInlineDelimited = (value: string, cursor: number, options: Options | undefined, config: InlineConfig) => {
	type SpoilerValue = ReturnType<typeof spoiler>['value'];
	type BoldValue = ReturnType<typeof bold>['value'];
	type ItalicValue = ReturnType<typeof italic>['value'];
	type StrikeValue = ReturnType<typeof strike>['value'];

	if (config.allowSpoiler !== false) {
		const spoilerContent = findDelimitedContent(value, cursor, '||', '||', options);
		if (spoilerContent) {
			return {
				node: spoiler(
					parseInlineSegment(spoilerContent.content, options, {
						allowTimestamp: true,
						allowBold: true,
						allowItalic: true,
						allowStrike: true,
						allowSpoiler: false,
					}) as SpoilerValue,
				),
				length: spoilerContent.length,
			};
		}
	}

	if (config.allowBold !== false) {
		const boldContent = value.startsWith('**', cursor)
			? findDelimitedContent(
					value,
					cursor,
					'**',
					'**',
					options,
					() => !hasRepeatedDelimiter(value, cursor, '**'),
					undefined,
					hasBalancedDoubleTildes,
				)
			: findDelimitedContent(
					value,
					cursor,
					'*',
					'*',
					options,
					() => !(value[cursor - 1] === '*' && /\s/.test(value[cursor + 1] ?? '')),
					undefined,
					hasBalancedDoubleTildes,
				);

		if (boldContent) {
			return {
				node: bold(
					parseInlineSegment(boldContent.content, options, {
						allowTimestamp: false,
						allowBold: false,
						allowItalic: true,
						allowStrike: true,
						allowSpoiler: true,
						allowAutolink: false,
					}) as BoldValue,
				),
				length: boldContent.length,
			};
		}
	}

	if (config.allowItalic !== false && isUnderscoreOpeningBoundary(value, cursor)) {
		const italicContent = value.startsWith('__', cursor)
			? findDelimitedContent(
					value,
					cursor,
					'__',
					'__',
					options,
					() => value[cursor + 2] !== ' ',
					(candidateIndex) => isUnderscoreClosingBoundary(value, candidateIndex, 2) && value[candidateIndex - 1] !== '_',
					(content) => !content.includes('__'),
				)
			: findDelimitedContent(
					value,
					cursor,
					'_',
					'_',
					options,
					() => value[cursor + 1] !== '_',
					(candidateIndex) =>
						isUnderscoreClosingBoundary(value, candidateIndex, 1) &&
						value[candidateIndex - 1] !== '_' &&
						(value[candidateIndex + 1] !== '_' || value[cursor - 1] !== '_') &&
						!isUnderscoreMentionTail(value, candidateIndex, cursor),
					(content) => !(value[cursor - 1] === '_' && content.includes('__')),
				);

		if (italicContent) {
			return {
				node: italic(
					parseInlineSegment(italicContent.content, options, {
						allowTimestamp: false,
						allowBold: true,
						allowItalic: false,
						allowStrike: true,
						allowSpoiler: true,
						allowAutolink: false,
					}) as ItalicValue,
				),
				length: italicContent.length,
			};
		}
	}

	if (config.allowStrike !== false) {
		const strikeContent = value.startsWith('~~', cursor)
			? findDelimitedContent(value, cursor, '~~', '~~', options, () => !hasRepeatedDelimiter(value, cursor, '~~'))
			: findDelimitedContent(value, cursor, '~', '~', options, () => !(value[cursor - 1] === '~' && /\s/.test(value[cursor + 1] ?? '')));

		if (strikeContent) {
			return {
				node: strike(
					parseInlineSegment(strikeContent.content, options, {
						allowTimestamp: true,
						allowBold: true,
						allowItalic: true,
						allowStrike: false,
						allowSpoiler: true,
					}) as StrikeValue,
				),
				length: strikeContent.length,
			};
		}
	}

	return undefined;
};

export const parseInlineSegment = (value: string, options?: Options, config: InlineConfig = {}): Inlines[] => {
	const result = [] as Array<
		| ReturnType<typeof plain>
		| ReturnType<typeof bold>
		| ReturnType<typeof italic>
		| ReturnType<typeof strike>
		| ReturnType<typeof spoiler>
		| ReturnType<typeof emoji>
		| ReturnType<typeof mentionUser>
		| ReturnType<typeof mentionChannel>
		| ReturnType<typeof link>
		| ReturnType<typeof image>
		| ReturnType<typeof inlineCode>
		| ReturnType<typeof inlineKatex>
		| ReturnType<typeof color>
		| ReturnType<typeof timestamp>
	>;
	let cursor = 0;

	const pushPlain = (text: string) => {
		if (!text) {
			return;
		}

		const previous = result[result.length - 1];

		if (previous?.type === 'PLAIN_TEXT') {
			previous.value += text;
			return;
		}

		result.push(plain(text));
	};

	while (cursor < value.length) {
		const remaining = value.slice(cursor);

		if (remaining.startsWith('\\') && remaining[1] !== undefined) {
			if (options?.katex?.parenthesisSyntax && remaining[1] === '(') {
				// Allow KaTeX delimiters like "\(" to reach the dedicated matcher below.
			} else if (escapableCharacters.has(remaining[1])) {
				pushPlain(remaining[1]);
				cursor += 2;
				continue;
			} else {
				pushPlain('\\');
				cursor += 1;
				continue;
			}
		}

		if (config.allowItalic !== false && remaining.startsWith('___')) {
			pushPlain('_');
			cursor += 1;
			continue;
		}

		if (config.allowItalic !== false && remaining.startsWith('-_-_')) {
			pushPlain('-');
			cursor += 1;
			continue;
		}

		if (config.allowReferences !== false) {
			const markdownReference = parseMarkdownReference(value, cursor);
			if (markdownReference) {
				result.push(markdownReference.node as any);
				cursor += markdownReference.length;
				continue;
			}

			const angleReference = parseAngleReference(value, cursor);
			if (angleReference) {
				result.push(angleReference.node);
				cursor += angleReference.length;
				continue;
			}
		}

		const emoticonCandidate = parseEmoticonCandidate(value, cursor, options);
		if (emoticonCandidate) {
			result.push(emoticonCandidate.node);
			cursor += emoticonCandidate.length;
			continue;
		}

		const emojiCandidate = parseEmojiCandidate(value, cursor);
		if (emojiCandidate) {
			result.push(emojiCandidate.node as any);
			cursor += emojiCandidate.length;
			continue;
		}

		const delimitedCandidate = parseInlineDelimited(value, cursor, options, config);
		if (delimitedCandidate) {
			result.push(delimitedCandidate.node as any);
			cursor += delimitedCandidate.length;
			continue;
		}

		const patterns = [
			{
				match: /^`([^`\n]+)`/.exec(remaining),
				build: (match: RegExpExecArray) => inlineCode(plain(match[1])),
			},
			{
				match: config.allowTimestamp !== false ? /^<t:([^>]+)>/.exec(remaining) : null,
				build: (match: RegExpExecArray) => {
					const parsedExpression = parseTimestampExpression(match[1]);
					const parsed = parseTimestampValue(parsedExpression.raw);
					return parsed ? timestamp(parsed, parsedExpression.format ?? 't') : plain(match[0]);
				},
			},
			{
				match: options?.colors
					? /^color:#([0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})(?![0-9A-Za-z\u0080-\uFFFF])/.exec(remaining)
					: null,
				build: (match: RegExpExecArray) => parseColorValue(match[1]) ?? plain(match[0]),
			},
			{
				match: options?.katex?.parenthesisSyntax ? /^\\\((.+?)\\\)/.exec(remaining) : null,
				build: (match: RegExpExecArray) => inlineKatex(match[1]),
			},
			{
				match:
					config.allowMentions !== false && isMentionBoundary(value, cursor)
						? /^@([\p{L}\p{N}\p{M}._-]+(?:[:@][\p{L}\p{N}\p{M}._-]+)?)/u.exec(remaining)
						: null,
				build: (match: RegExpExecArray) => mentionUser(match[1]),
			},
			{
				match: config.allowMentions !== false && isMentionBoundary(value, cursor) ? /^#([\p{L}\p{N}\p{M}._-]+)/u.exec(remaining) : null,
				build: (match: RegExpExecArray) => mentionChannel(match[1]),
			},
		] as const;

		const found = patterns.find((candidate) => candidate.match);

		if (!found?.match) {
			if (config.allowAutolink !== false) {
				const emailReference = parseEmailCandidate(value, cursor);
				if (emailReference) {
					result.push(emailReference.node);
					cursor += emailReference.length;
					continue;
				}

				const phoneReference = parsePhoneLink(value, cursor);
				if (phoneReference) {
					result.push(phoneReference.node);
					cursor += phoneReference.length;
					continue;
				}

				const autoUrl = parseAutoUrlCandidate(value, cursor, options);
				if (autoUrl) {
					result.push(autoUrl.node);
					cursor += autoUrl.length;
					continue;
				}
			}

			pushPlain(remaining[0]);
			cursor += 1;
			continue;
		}

		if (found.match.index > 0) {
			pushPlain(remaining.slice(0, found.match.index));
			cursor += found.match.index;
			continue;
		}

		result.push(found.build(found.match));
		cursor += found.match[0].length;
	}

	return result.length ? result : [plain('')];
};
