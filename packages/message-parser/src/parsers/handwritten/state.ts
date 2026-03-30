import type { Options } from '../../index';

export type InlineConfig = {
	allowTimestamp?: boolean;
	allowBold?: boolean;
	allowItalic?: boolean;
	allowStrike?: boolean;
	allowSpoiler?: boolean;
	allowReferences?: boolean;
	allowMentions?: boolean;
	allowAutolink?: boolean;
};

export class ParserState {
	public constructor(
		public readonly options?: Options,
		public readonly inline: InlineConfig = {},
		public readonly depth = 0,
		public readonly maxDepth = 128,
	) {}

	public nest(inline: InlineConfig): ParserState | undefined {
		if (this.depth >= this.maxDepth) {
			return undefined;
		}

		return new ParserState(this.options, inline, this.depth + 1, this.maxDepth);
	}
}
