import { parseInlineSegment } from './inline';
import {
	type ParsedLine,
	blockquoteLine,
	codeFenceLanguage,
	headingMatch,
	isBlankBlockquoteMarker,
	isBlankLine,
	isBlockquoteMarker,
	orderedListLine,
	taskLine,
	unorderedListLine,
} from './shared';
import type { Root } from '../../definitions';
import type { Options } from '../../index';
import {
	code,
	codeLine,
	heading,
	katex,
	lineBreak,
	listItem,
	orderedList,
	paragraph,
	plain,
	quote,
	spoilerBlock,
	task,
	tasks,
	unorderedList,
} from '../../utils';

export const buildAst = (tokens: ParsedLine[], options?: Options): Root => {
	const output: Root = [];

	for (let index = 0; index < tokens.length; ) {
		const current = tokens[index];

		if (!current) {
			break;
		}

		if (current.kind === 'newline') {
			index += 1;
			continue;
		}

		const maybeLanguage = codeFenceLanguage(current.value);

		if (maybeLanguage !== undefined && tokens[index + 1]?.kind === 'newline') {
			const lines = [] as ReturnType<typeof codeLine>[];
			let cursor = index + 2;
			let closed = false;

			while (cursor < tokens.length) {
				const line = tokens[cursor];

				if (line?.kind !== 'line') {
					cursor += 1;
					continue;
				}

				if (line.value === '```') {
					output.push(code(lines, maybeLanguage || undefined));
					index = cursor + 1;
					closed = true;
					break;
				}

				lines.push(codeLine(plain(line.value)));
				cursor += 1;

				if (tokens[cursor]?.kind === 'newline') {
					cursor += 1;
				}
			}

			if (!closed) {
				output.push(paragraph([plain(current.value)]));
				index += 1;

				if (tokens[index]?.kind === 'newline') {
					index += 1;
				}
			}

			continue;
		}

		if (options?.katex?.parenthesisSyntax && current.value === '\\[') {
			let cursor = index + 1;
			const content = [''] as string[];
			let closed = false;

			if (tokens[cursor]?.kind === 'newline') {
				cursor += 1;
			}

			while (cursor < tokens.length) {
				const line = tokens[cursor];

				if (line?.kind === 'line' && line.value.includes('\\]')) {
					const closingIndex = line.value.indexOf('\\]');
					content.push(line.value.slice(0, closingIndex));
					output.push(katex(content.join('\n')));
					index = cursor + 1;
					closed = true;
					break;
				}

				if (line?.kind === 'line') {
					content.push(line.value);
				}

				cursor += 1;
				if (tokens[cursor]?.kind === 'newline') {
					cursor += 1;
				}
			}

			if (closed) {
				continue;
			}
		}

		if (current.value === '||' && tokens[index + 1]?.kind === 'newline') {
			let cursor = index + 2;
			const paragraphs = [] as ReturnType<typeof paragraph>[];
			let closed = false;

			while (cursor < tokens.length) {
				const line = tokens[cursor];

				if (line?.kind === 'line' && line.value === '||') {
					output.push(spoilerBlock(paragraphs));
					index = cursor + 1;
					closed = true;
					break;
				}

				if (line?.kind === 'line') {
					paragraphs.push(paragraph([plain(line.value)]));
				}

				cursor += 1;
				if (tokens[cursor]?.kind === 'newline') {
					cursor += 1;
				}
			}

			if (closed) {
				if (tokens[index]?.kind === 'newline') {
					output.push(lineBreak());
					index += 1;
				}

				continue;
			}
		}

		const previousLine = tokens[index - 2];
		const nextLine = tokens[index + 2];
		const canStartBlankBlockquote =
			isBlankBlockquoteMarker(current.value) &&
			(previousLine?.kind === 'line' || nextLine?.kind === 'line') &&
			((previousLine?.kind === 'line' && isBlockquoteMarker(previousLine.value)) ||
				(nextLine?.kind === 'line' && isBlockquoteMarker(nextLine.value)));

		if ((isBlockquoteMarker(current.value) && !isBlankBlockquoteMarker(current.value)) || canStartBlankBlockquote) {
			const paragraphs = [] as ReturnType<typeof paragraph>[];
			let cursor = index;

			while (cursor < tokens.length) {
				const line = tokens[cursor];

				if (line?.kind !== 'line') {
					break;
				}

				const blockLine = blockquoteLine(line.value);

				if (blockLine === undefined) {
					break;
				}

				paragraphs.push(paragraph(parseInlineSegment(blockLine, options)));
				cursor += 1;

				if (tokens[cursor]?.kind === 'newline') {
					cursor += 1;
				}
			}

			output.push(quote(paragraphs));
			index = cursor;
			continue;
		}

		if (taskLine(current.value) !== undefined) {
			const items = [] as ReturnType<typeof task>[];
			let cursor = index;

			while (cursor < tokens.length) {
				const line = tokens[cursor];

				if (line?.kind !== 'line') {
					break;
				}

				const item = taskLine(line.value);

				if (!item) {
					break;
				}

				items.push(task(parseInlineSegment(item.text, options), item.status));
				cursor += 1;

				if (tokens[cursor]?.kind === 'newline') {
					cursor += 1;
				}
			}

			output.push(tasks(items));
			index = cursor;
			continue;
		}

		if (orderedListLine(current.value) !== undefined) {
			const items = [] as ReturnType<typeof listItem>[];
			let cursor = index;

			while (cursor < tokens.length) {
				const line = tokens[cursor];

				if (line?.kind !== 'line') {
					break;
				}

				const item = orderedListLine(line.value);

				if (!item) {
					break;
				}

				items.push(listItem(parseInlineSegment(item.text, options), item.number));
				cursor += 1;

				if (tokens[cursor]?.kind === 'newline') {
					cursor += 1;
				}
			}

			output.push(orderedList(items));
			index = cursor;
			continue;
		}

		if (unorderedListLine(current.value) !== undefined) {
			const first = unorderedListLine(current.value);
			const items = [] as ReturnType<typeof listItem>[];
			let cursor = index;

			while (cursor < tokens.length) {
				const line = tokens[cursor];

				if (line?.kind !== 'line') {
					break;
				}

				const item = unorderedListLine(line.value);

				if (!item || item.marker !== first?.marker) {
					break;
				}

				items.push(listItem(parseInlineSegment(item.text, options)));
				cursor += 1;

				if (tokens[cursor]?.kind === 'newline') {
					cursor += 1;
				}
			}

			output.push(unorderedList(items));
			index = cursor;
			continue;
		}

		const maybeHeading = headingMatch(current.value);

		if (maybeHeading) {
			output.push(heading([plain(maybeHeading.text)], maybeHeading.level));
			index += 1;

			if (tokens[index]?.kind === 'newline') {
				output.push(lineBreak());
				index += 1;
			}

			continue;
		}

		if (isBlankLine(current) && tokens[index + 1]?.kind === 'newline') {
			output.push(lineBreak());
			index += 2;
			continue;
		}

		output.push(paragraph(parseInlineSegment(current.value, options)));
		index += 1;

		if (tokens[index]?.kind === 'newline') {
			index += 1;
		}
	}

	return output;
};
