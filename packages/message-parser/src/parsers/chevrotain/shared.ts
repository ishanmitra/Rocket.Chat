import { createToken } from 'chevrotain';

export const Line = createToken({ name: 'Line', pattern: /[^\n]*/ });
export const Newline = createToken({ name: 'Newline', pattern: /\n/ });

export type ParsedLine = { kind: 'line'; value: string } | { kind: 'newline' };

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
