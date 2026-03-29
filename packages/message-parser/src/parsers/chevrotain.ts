import { CstParser, EOF, createToken, type IToken } from 'chevrotain';

import type { Root } from '../definitions';
import type { Options } from '../index';
import {
	bold,
	code,
	codeLine,
	emoji,
	heading,
	inlineKatex,
	katex,
	lineBreak,
	link,
	listItem,
	mentionChannel,
	mentionUser,
	orderedList,
	paragraph,
	plain,
	quote,
	spoilerBlock,
	task,
	tasks,
	unorderedList,
} from '../utils';

const Line = createToken({ name: 'Line', pattern: /[^\n]*/ });
const Newline = createToken({ name: 'Newline', pattern: /\n/ });

type ParsedLine =
	| { kind: 'line'; value: string }
	| { kind: 'newline' };

const tokenizeLines = (input: string): ParsedLine[] => {
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

class MessageParser extends CstParser {
	public constructor() {
		super([Line, Newline]);

		const $ = this;

		$.RULE('document', () => {
			$.MANY(() => {
				$.OR([
					{ GATE: () => this.isCodeBlockStart(), ALT: () => $.SUBRULE($.codeBlock) },
					{ GATE: () => this.isKatexBlockStart(), ALT: () => $.SUBRULE($.katexBlock) },
					{ GATE: () => this.isSpoilerBlockStart(), ALT: () => $.SUBRULE($.spoilerBlockRule) },
					{ GATE: () => this.isBlockquoteStart(), ALT: () => $.SUBRULE($.blockquoteBlock) },
					{ GATE: () => this.isTaskListStart(), ALT: () => $.SUBRULE($.taskListBlock) },
					{ GATE: () => this.isOrderedListStart(), ALT: () => $.SUBRULE($.orderedListBlock) },
					{ GATE: () => this.isUnorderedListStart(), ALT: () => $.SUBRULE($.unorderedListBlock) },
					{ GATE: () => this.isHeadingStart(), ALT: () => $.SUBRULE($.headingBlock) },
					{ GATE: () => this.isLineBreakStart(), ALT: () => $.SUBRULE($.lineBreakBlock) },
					{ ALT: () => $.SUBRULE($.paragraphBlock) },
				]);
			});
			$.CONSUME(EOF);
		});

		$.RULE('codeBlock', () => {
			$.CONSUME(Line);
			$.CONSUME(Newline);
			$.AT_LEAST_ONE(() => {
				$.CONSUME1(Line);
				$.OPTION(() => {
					$.CONSUME1(Newline);
				});
			});
			$.CONSUME2(Line);
		});

		$.RULE('headingBlock', () => {
			$.CONSUME(Line);
			$.OPTION(() => {
				$.CONSUME(Newline);
			});
		});

		$.RULE('blockquoteBlock', () => {
			$.AT_LEAST_ONE(() => {
				$.CONSUME(Line);
				$.OPTION(() => {
					$.CONSUME(Newline);
				});
			});
		});

		$.RULE('taskListBlock', () => {
			$.AT_LEAST_ONE(() => {
				$.CONSUME(Line);
				$.OPTION(() => {
					$.CONSUME(Newline);
				});
			});
		});

		$.RULE('orderedListBlock', () => {
			$.AT_LEAST_ONE(() => {
				$.CONSUME(Line);
				$.OPTION(() => {
					$.CONSUME(Newline);
				});
			});
		});

		$.RULE('unorderedListBlock', () => {
			$.AT_LEAST_ONE(() => {
				$.CONSUME(Line);
				$.OPTION(() => {
					$.CONSUME(Newline);
				});
			});
		});

		$.RULE('spoilerBlockRule', () => {
			$.CONSUME(Line);
			$.CONSUME(Newline);
			$.AT_LEAST_ONE(() => {
				$.CONSUME1(Line);
				$.OPTION(() => {
					$.CONSUME1(Newline);
				});
			});
			$.CONSUME2(Line);
		});

		$.RULE('katexBlock', () => {
			$.CONSUME(Line);
			$.OPTION(() => {
				$.CONSUME(Newline);
			});
			$.MANY(() => {
				$.CONSUME1(Line);
				$.OPTION1(() => {
					$.CONSUME1(Newline);
				});
			});
			$.CONSUME2(Line);
		});

		$.RULE('lineBreakBlock', () => {
			$.CONSUME(Line);
			$.CONSUME(Newline);
		});

		$.RULE('paragraphBlock', () => {
			$.CONSUME(Line);
			$.OPTION(() => {
				$.CONSUME(Newline);
			});
		});

		this.performSelfAnalysis();
	}

	public document!: () => void;
	public codeBlock!: () => void;
	public headingBlock!: () => void;
	public blockquoteBlock!: () => void;
	public taskListBlock!: () => void;
	public orderedListBlock!: () => void;
	public unorderedListBlock!: () => void;
	public spoilerBlockRule!: () => void;
	public katexBlock!: () => void;
	public lineBreakBlock!: () => void;
	public paragraphBlock!: () => void;

	private currentLineToken(): IToken | undefined {
		const token = this.LA(1);

		return token.tokenType === Line ? token : undefined;
	}

	private nextToken(): IToken | undefined {
		return this.LA(2);
	}

	private isCodeBlockStart(): boolean {
		const line = this.currentLineToken();

		return Boolean(line && codeFenceLanguage(line.image) !== undefined && this.nextToken()?.tokenType === Newline);
	}

	private isHeadingStart(): boolean {
		const line = this.currentLineToken();

		return Boolean(line && headingMatch(line.image));
	}

	private isBlockquoteStart(): boolean {
		const line = this.currentLineToken();

		return Boolean(line && blockquoteLine(line.image));
	}

	private isTaskListStart(): boolean {
		const line = this.currentLineToken();

		return Boolean(line && taskLine(line.image));
	}

	private isOrderedListStart(): boolean {
		const line = this.currentLineToken();

		return Boolean(line && orderedListLine(line.image));
	}

	private isUnorderedListStart(): boolean {
		const line = this.currentLineToken();

		return Boolean(line && unorderedListLine(line.image));
	}

	private isSpoilerBlockStart(): boolean {
		const line = this.currentLineToken();

		return Boolean(line && line.image === '||' && this.nextToken()?.tokenType === Newline);
	}

	private isKatexBlockStart(): boolean {
		const line = this.currentLineToken();

		return Boolean(line && line.image === '\\[');
	}

	private isLineBreakStart(): boolean {
		const line = this.currentLineToken();

		return Boolean(line && /^[ \t]*$/.test(line.image) && this.nextToken()?.tokenType === Newline);
	}
}

const parser = new MessageParser();

const isBlankLine = (token: ParsedLine | undefined): token is { kind: 'line'; value: string } =>
	Boolean(token && token.kind === 'line' && /^[ \t]*$/.test(token.value));

const headingMatch = (line: string): { level: 1 | 2 | 3 | 4; text: string } | undefined => {
	const match = /^(#{1,4})[ \t]+(.*)$/.exec(line);

	if (!match) {
		return undefined;
	}

	return {
		level: match[1].length as 1 | 2 | 3 | 4,
		text: match[2],
	};
};

const blockquoteLine = (line: string): string | undefined => {
	if (!line.startsWith('>')) {
		return undefined;
	}

	return line.replace(/^>[ \t]?/, '');
};

const taskLine = (line: string): { status: boolean; text: string } | undefined => {
	const match = /^- \[(x| )\][ \t]+(.*)$/.exec(line);

	if (!match) {
		return undefined;
	}

	return {
		status: match[1] === 'x',
		text: match[2],
	};
};

const orderedListLine = (line: string): { number: number; text: string } | undefined => {
	const match = /^(\d+)\.[ \t]+(.*)$/.exec(line);

	if (!match) {
		return undefined;
	}

	return {
		number: Number.parseInt(match[1], 10),
		text: match[2],
	};
};

const unorderedListLine = (line: string): { marker: '-' | '*'; text: string } | undefined => {
	const match = /^([*-])[ \t]+(.*)$/.exec(line);

	if (!match) {
		return undefined;
	}

	return {
		marker: match[1] as '-' | '*',
		text: match[2],
	};
};

const codeFenceLanguage = (line: string): string | undefined => {
	const match = /^```([a-zA-Z0-9 _\-.]+)?$/.exec(line);

	if (!match) {
		return undefined;
	}

	return match[1] ?? '';
};

const parseParagraphInlines = (line: string) => {
	const mention = /^#([^\s#]+)(.*)$/.exec(line);

	if (!mention) {
		return [plain(line)];
	}

	const [, channel, rest] = mention;
	return rest ? [mentionChannel(channel), plain(rest)] : [mentionChannel(channel)];
};

const parseInlineSegment = (value: string) => {
	const result = [] as Array<ReturnType<typeof plain> | ReturnType<typeof bold> | ReturnType<typeof emoji> | ReturnType<typeof mentionUser> | ReturnType<typeof mentionChannel> | ReturnType<typeof link> | ReturnType<typeof inlineKatex>>;
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

		const patterns = [
			{
				match: /^\[([^\]]+)\]\(([^)]+)\)/.exec(remaining),
				build: (match: RegExpExecArray) => link(match[2], [plain(match[1])]),
			},
			{
				match: /^\*\*([^*]+)\*\*/.exec(remaining) ?? /^\*([^*]+)\*/.exec(remaining),
				build: (match: RegExpExecArray) => bold([plain(match[1])]),
			},
			{
				match: /^:([0-9a-zA-Z\-_.+]+):/.exec(remaining),
				build: (match: RegExpExecArray) => emoji(match[1]),
			},
			{
				match: /^@([^\s,:@]+(?::[^\s,:@]+)*)/.exec(remaining),
				build: (match: RegExpExecArray) => mentionUser(match[1]),
			},
			{
				match: /^#([^\s,#]+)/.exec(remaining),
				build: (match: RegExpExecArray) => mentionChannel(match[1]),
			},
			{
				match: /^\\\((.+?)\\\)/.exec(remaining),
				build: (match: RegExpExecArray) => inlineKatex(match[1]),
			},
		] as const;

		const found = patterns.find((candidate) => candidate.match);

		if (!found || !found.match) {
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

const buildAst = (tokens: ParsedLine[], options?: Options): Root => {
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

		if (blockquoteLine(current.value) !== undefined) {
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

				paragraphs.push(paragraph(parseInlineSegment(blockLine)));
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

				items.push(task(parseInlineSegment(item.text), item.status));
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

				items.push(listItem(parseInlineSegment(item.text), item.number));
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

				items.push(listItem(parseInlineSegment(item.text)));
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

		output.push(paragraph(parseParagraphInlines(current.value)));
		index += 1;

		if (tokens[index]?.kind === 'newline') {
			index += 1;
		}
	}

	return output;
};

const validateWithChevrotain = (tokens: ParsedLine[]): void => {
	parser.input = tokens.map((token) =>
		token.kind === 'line'
			? ({
					image: token.value,
					tokenType: Line,
					startOffset: 0,
					endOffset: 0,
					startLine: 0,
					endLine: 0,
					startColumn: 0,
					endColumn: 0,
			  } as any)
			: ({
					image: '\n',
					tokenType: Newline,
					startOffset: 0,
					endOffset: 0,
					startLine: 0,
					endLine: 0,
					startColumn: 0,
					endColumn: 0,
			  } as any),
	);

	parser.document();
};

export const parse = (input: string, _options?: Options): Root => {
	const tokens = tokenizeLines(input);

	validateWithChevrotain(tokens);

	return buildAst(tokens, _options);
};

export { parse as parser };
