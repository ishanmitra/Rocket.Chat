import { CstParser, EOF, createToken, type IToken } from 'chevrotain';

import type { Root } from '../definitions';
import type { Options } from '../index';
import { code, codeLine, heading, lineBreak, mentionChannel, paragraph, plain } from '../utils';

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

const buildAst = (tokens: ParsedLine[]): Root => {
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

	return buildAst(tokens);
};

export { parse as parser };
