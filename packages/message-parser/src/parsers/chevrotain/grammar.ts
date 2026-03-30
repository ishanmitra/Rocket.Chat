/* eslint-disable new-cap */
import { CstParser, EOF, type CstNode, type IToken } from 'chevrotain';

import {
	Line,
	Newline,
	type ParsedLine,
	blockquoteLine,
	codeFenceLanguage,
	headingMatch,
	orderedListLine,
	taskLine,
	unorderedListLine,
} from './shared';

class MessageParser extends CstParser {
	public constructor() {
		super([Line, Newline]);

		// eslint-disable-next-line @typescript-eslint/no-this-alias
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

	public document!: () => CstNode;

	public codeBlock!: () => CstNode;

	public headingBlock!: () => CstNode;

	public blockquoteBlock!: () => CstNode;

	public taskListBlock!: () => CstNode;

	public orderedListBlock!: () => CstNode;

	public unorderedListBlock!: () => CstNode;

	public spoilerBlockRule!: () => CstNode;

	public katexBlock!: () => CstNode;

	public lineBreakBlock!: () => CstNode;

	public paragraphBlock!: () => CstNode;

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

		return Boolean(line?.image === '||' && this.nextToken()?.tokenType === Newline);
	}

	private isKatexBlockStart(): boolean {
		const line = this.currentLineToken();

		return Boolean(line?.image === '\\[');
	}

	private isLineBreakStart(): boolean {
		const line = this.currentLineToken();

		return Boolean(line && /^[ \t]*$/.test(line.image) && this.nextToken()?.tokenType === Newline);
	}
}

const parser = new MessageParser();

export const validateWithChevrotain = (tokens: ParsedLine[]): void => {
	const toToken = (image: string, tokenType: typeof Line): IToken => ({
		image,
		tokenType,
		tokenTypeIdx: tokenType.tokenTypeIdx ?? 0,
		startOffset: 0,
		endOffset: image.length > 0 ? image.length - 1 : 0,
		startLine: 1,
		endLine: 1,
		startColumn: 1,
		endColumn: image.length > 0 ? image.length : 1,
	});

	parser.input = tokens.map((token) => (token.kind === 'line' ? toToken(token.value, Line) : toToken('\n', Newline)));

	parser.document();
};
