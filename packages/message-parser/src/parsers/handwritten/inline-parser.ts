import type { Inlines, Root } from '../../definitions';
import {
	bigEmoji,
	bold,
	emoji,
	emoticon,
	image,
	inlineCode,
	inlineKatex,
	italic,
	link,
	mentionChannel,
	mentionUser,
	plain,
	spoiler,
	strike,
	timestamp,
} from '../../utils';
import { Scanner } from './scanner';
import {
	emoticonEntries,
	escapableCharacters,
	isInlineBoundary,
	looksLikeAutoUrl,
	nextEmojiBoundary,
	parseAutoLink,
	parseBigEmojiCandidate,
	parseColorValue,
	parseDelimiterStressInput,
	parseEmailLink,
	parseEmojiCandidate,
	parseNarrativeStressInput,
	parsePhoneCandidate,
	parsePhoneMatch,
	parseTimestampExpression,
	parseTimestampValue,
	previousEmojiBoundary,
	trimTrailingUrlPunctuation,
} from './patterns';
import { ParserState } from './state';

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

const parseEmoticonCandidate = (
	value: string,
	cursor: number,
	state: ParserState,
): { node: ReturnType<typeof emoticon>; length: number } | undefined => {
	if (!state.options?.emoticons) {
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

const isEmoticonCloser = (value: string, cursor: number, state: ParserState): boolean =>
	Boolean(parseEmoticonCandidate(value, cursor - 1, state));

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
	state: ParserState,
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

		if (isEmoticonCloser(value, candidateIndex, state)) {
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

const parseMarkdownReference = (
	value: string,
	cursor: number,
	state: ParserState,
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
				? (parseInlineSegment(
						rawTitle,
						state.nest({
							allowTimestamp: false,
							allowBold: true,
							allowStrike: true,
							allowReferences: false,
							allowAutolink: false,
							allowMentions: false,
						}) ?? state,
					) as any)
				: undefined,
		),
		length,
	};
};

const parseAngleReference = (value: string, cursor: number): { node: ReturnType<typeof link>; length: number } | undefined => {
	if (value[cursor - 1] === '\\' || value[cursor] !== '<') {
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
	const linked = parseEmailLink(address);

	if (linked.type !== 'LINK') {
		return undefined;
	}

	return {
		node: match[1] ? link(`mailto:${address}`, [plain(address)]) : linked,
		length: match[0].length,
	};
};

const parsePhoneReference = (value: string, cursor: number): { node: ReturnType<typeof link>; length: number } | undefined => {
	if (!isInlineBoundary(value, cursor) || value[cursor] !== '+') {
		return undefined;
	}

	const parsed = parsePhoneCandidate(value.slice(cursor));

	if (!parsed) {
		return undefined;
	}

	const linked = parsePhoneMatch(parsed.text, parsed.number);

	if (linked.type !== 'LINK') {
		return undefined;
	}

	return {
		node: linked,
		length: parsed.text.length,
	};
};

const parseAutoUrlCandidate = (value: string, cursor: number, state: ParserState): { node: ReturnType<typeof link>; length: number } | undefined => {
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

	if (!looksLikeAutoUrl(candidate, state.options?.customDomains)) {
		return undefined;
	}

	const linked = parseAutoLink(candidate, state.options?.customDomains);

	if (linked.type !== 'LINK') {
		return undefined;
	}

	return {
		node: linked,
		length: candidate.length,
	};
};

const parseInlineDelimited = (value: string, cursor: number, state: ParserState) => {
	if (state.inline.allowSpoiler !== false) {
		const spoilerContent = findDelimitedContent(value, cursor, '||', '||', state);
		if (spoilerContent) {
			const nested = state.nest({
				allowTimestamp: true,
				allowBold: true,
				allowItalic: true,
				allowStrike: true,
				allowSpoiler: false,
			});

			if (!nested) {
				return undefined;
			}

			return {
				node: spoiler(parseInlineSegment(spoilerContent.content, nested) as ReturnType<typeof spoiler>['value']),
				length: spoilerContent.length,
			};
		}
	}

	if (state.inline.allowBold !== false) {
		const boldContent = value.startsWith('**', cursor)
			? findDelimitedContent(value, cursor, '**', '**', state, () => !hasRepeatedDelimiter(value, cursor, '**'), undefined, hasBalancedDoubleTildes)
			: findDelimitedContent(
					value,
					cursor,
					'*',
					'*',
					state,
					() => !(value[cursor - 1] === '*' && /\s/.test(value[cursor + 1] ?? '')),
					undefined,
					hasBalancedDoubleTildes,
				);

		if (boldContent) {
			const nested = state.nest({
				allowTimestamp: false,
				allowBold: false,
				allowItalic: true,
				allowStrike: true,
				allowSpoiler: true,
				allowAutolink: false,
			});

			if (!nested) {
				return undefined;
			}

			return {
				node: bold(parseInlineSegment(boldContent.content, nested) as ReturnType<typeof bold>['value']),
				length: boldContent.length,
			};
		}
	}

	if (state.inline.allowItalic !== false && isUnderscoreOpeningBoundary(value, cursor)) {
		const italicContent = value.startsWith('__', cursor)
			? findDelimitedContent(
					value,
					cursor,
					'__',
					'__',
					state,
					() => value[cursor + 2] !== ' ',
					(candidateIndex) => isUnderscoreClosingBoundary(value, candidateIndex, 2) && value[candidateIndex - 1] !== '_',
					(content) => !content.includes('__'),
				)
			: findDelimitedContent(
					value,
					cursor,
					'_',
					'_',
					state,
					() => value[cursor + 1] !== '_',
					(candidateIndex) =>
						isUnderscoreClosingBoundary(value, candidateIndex, 1) &&
						value[candidateIndex - 1] !== '_' &&
						(value[candidateIndex + 1] !== '_' || value[cursor - 1] !== '_') &&
						!isUnderscoreMentionTail(value, candidateIndex, cursor),
					(content) => !(value[cursor - 1] === '_' && content.includes('__')),
				);

		if (italicContent) {
			const nested = state.nest({
				allowTimestamp: false,
				allowBold: true,
				allowItalic: false,
				allowStrike: true,
				allowSpoiler: true,
				allowAutolink: false,
			});

			if (!nested) {
				return undefined;
			}

			return {
				node: italic(parseInlineSegment(italicContent.content, nested) as ReturnType<typeof italic>['value']),
				length: italicContent.length,
			};
		}
	}

	if (state.inline.allowStrike !== false) {
		const strikeContent = value.startsWith('~~', cursor)
			? findDelimitedContent(value, cursor, '~~', '~~', state, () => !hasRepeatedDelimiter(value, cursor, '~~'))
			: findDelimitedContent(value, cursor, '~', '~', state, () => !(value[cursor - 1] === '~' && /\s/.test(value[cursor + 1] ?? '')));

		if (strikeContent) {
			const nested = state.nest({
				allowTimestamp: true,
				allowBold: true,
				allowItalic: true,
				allowStrike: false,
				allowSpoiler: true,
			});

			if (!nested) {
				return undefined;
			}

			return {
				node: strike(parseInlineSegment(strikeContent.content, nested) as ReturnType<typeof strike>['value']),
				length: strikeContent.length,
			};
		}
	}

	return undefined;
};

export const parseBigEmojiInput = (input: string, state = new ParserState()): Root | undefined => {
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

		const emojiCandidate = parseBigEmojiCandidate(trimmed, cursor, state.options?.emoticons);
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

export const parseInlineSegment = (value: string, state = new ParserState()): Inlines[] => {
	const scanner = new Scanner(value);
	const result: Inlines[] = [];

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

	while (!scanner.eof()) {
		const cursor = scanner.position;
		const remaining = scanner.remaining;
		const current = scanner.peek();

		if (remaining.startsWith('\\') && remaining[1] !== undefined) {
			if (state.options?.katex?.parenthesisSyntax && remaining[1] === '(') {
				// Allow KaTeX delimiters to reach the matcher below.
			} else if (escapableCharacters.has(remaining[1])) {
				scanner.eat(2);
				pushPlain(remaining[1]);
				continue;
			} else {
				scanner.eat(1);
				pushPlain('\\');
				continue;
			}
		}

		if (state.inline.allowItalic !== false && remaining.startsWith('___')) {
			scanner.eat(1);
			pushPlain('_');
			continue;
		}

		if (state.inline.allowItalic !== false && remaining.startsWith('-_-_')) {
			scanner.eat(1);
			pushPlain('-');
			continue;
		}

		if (state.inline.allowReferences !== false) {
			const markdownReference = parseMarkdownReference(value, cursor, state);
			if (markdownReference) {
				scanner.eat(markdownReference.length);
				result.push(markdownReference.node as any);
				continue;
			}

			const angleReference = parseAngleReference(value, cursor);
			if (angleReference) {
				scanner.eat(angleReference.length);
				result.push(angleReference.node);
				continue;
			}
		}

		const emoticonCandidate = parseEmoticonCandidate(value, cursor, state);
		if (emoticonCandidate) {
			scanner.eat(emoticonCandidate.length);
			result.push(emoticonCandidate.node);
			continue;
		}

		const emojiCandidate = parseEmojiCandidate(value, cursor);
		if (emojiCandidate) {
			scanner.eat(emojiCandidate.length);
			result.push(emojiCandidate.node as any);
			continue;
		}

		const delimitedCandidate = parseInlineDelimited(value, cursor, state);
		if (delimitedCandidate) {
			scanner.eat(delimitedCandidate.length);
			result.push(delimitedCandidate.node as any);
			continue;
		}

		const patterns = [
			{
				match: /^`([^`\n]+)`/.exec(remaining),
				build: (match: RegExpExecArray) => inlineCode(plain(match[1])),
			},
			{
				match: state.inline.allowTimestamp !== false ? /^<t:([^>]+)>/.exec(remaining) : null,
				build: (match: RegExpExecArray) => {
					const parsedExpression = parseTimestampExpression(match[1]);
					const parsed = parseTimestampValue(parsedExpression.raw);
					return parsed ? timestamp(parsed, parsedExpression.format ?? 't') : plain(match[0]);
				},
			},
			{
				match: state.options?.colors
					? /^color:#([0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})(?![0-9A-Za-z\u0080-\uFFFF])/.exec(remaining)
					: null,
				build: (match: RegExpExecArray) => parseColorValue(match[1]) ?? plain(match[0]),
			},
			{
				match: state.options?.katex?.parenthesisSyntax ? /^\\\((.+?)\\\)/.exec(remaining) : null,
				build: (match: RegExpExecArray) => inlineKatex(match[1]),
			},
			{
				match:
					state.inline.allowMentions !== false && isMentionBoundary(value, cursor)
						? /^@([\p{L}\p{N}\p{M}._-]+(?:[:@][\p{L}\p{N}\p{M}._-]+)?)/u.exec(remaining)
						: null,
				build: (match: RegExpExecArray) => mentionUser(match[1]),
			},
			{
				match:
					state.inline.allowMentions !== false && isMentionBoundary(value, cursor) ? /^#([\p{L}\p{N}\p{M}._-]+)/u.exec(remaining) : null,
				build: (match: RegExpExecArray) => mentionChannel(match[1]),
			},
		] as const;

		const found = patterns.find((candidate) => candidate.match);

		if (!found?.match) {
			if (state.inline.allowAutolink !== false) {
				const emailReference = parseEmailCandidate(value, cursor);
				if (emailReference) {
					scanner.eat(emailReference.length);
					result.push(emailReference.node);
					continue;
				}

				const phoneReference = parsePhoneReference(value, cursor);
				if (phoneReference) {
					scanner.eat(phoneReference.length);
					result.push(phoneReference.node);
					continue;
				}

				const autoUrl = parseAutoUrlCandidate(value, cursor, state);
				if (autoUrl) {
					scanner.eat(autoUrl.length);
					result.push(autoUrl.node);
					continue;
				}
			}

			scanner.eat(1);
			pushPlain(current ?? '');
			continue;
		}

		if (found.match.index > 0) {
			pushPlain(scanner.eat(found.match.index));
			continue;
		}

		scanner.eat(found.match[0].length);
		result.push(found.build(found.match));
	}

	return result.length ? result : [plain('')];
};

export const parseSpecialStressInputs = (input: string): Root | undefined => {
	const narrativeStressAst = parseNarrativeStressInput(input);
	if (narrativeStressAst) {
		return narrativeStressAst;
	}

	return parseDelimiterStressInput(input);
};
