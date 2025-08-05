import { parse } from '@rocket.chat/message-parser';
import type { Options, Root } from '@rocket.chat/message-parser';

import { renderToHtml } from './renderHtmlFromAST';
import { getSelectionRange, setSelectionRange, getCursorSelectionInfo, getSelectionRangeFromLines } from './selectionRange';

let composerTextState: string[] = [];
let composerLineParents: Record<number, { parentStart: number; parentEnd: number }> = {};
let cursorPositionState = -1;

export const detectBlocks = (lines: string[]): Record<number, { parentStart: number; parentEnd: number }> => {
	const blockMap: Record<number, { parentStart: number; parentEnd: number }> = {};
	let i = 0;
	const n = lines.length;

	while (i < n) {
		const line = lines[i];

		// Handle Code Block
		if (/^```/.test(line)) {
			const start = i++;
			while (i < n && !/^```/.test(lines[i])) i++;
			const end = i;
			i++;
			for (let j = start; j <= end; j++) blockMap[j] = { parentStart: start, parentEnd: end };
			continue;
		}

		// Handle Ordered List
		if (/^\d+\.\s/.test(line)) {
			const start = i++;
			while (i < n && /^\d+\.\s/.test(lines[i])) i++;
			const end = i - 1;
			for (let j = start; j <= end; j++) blockMap[j] = { parentStart: start, parentEnd: end };
			continue;
		}

		// Handle Unordered List
		if (/^[-*]\s/.test(line)) {
			const start = i++;
			while (i < n && /^[-+*]\s/.test(lines[i])) i++;
			const end = i - 1;
			for (let j = start; j <= end; j++) blockMap[j] = { parentStart: start, parentEnd: end };
			continue;
		}

		i++; // Skip non-block line
	}

	return blockMap;
};

const getLineParents = (line: number): { parentStart: number; parentEnd: number } => {
	return composerLineParents[line] ?? { parentStart: line, parentEnd: line };
};

const parseMessage = (parentStart: number, parentEnd: number): Root => {
	const extractedLines =
		parentStart === parentEnd ? composerTextState[parentStart] : composerTextState.slice(parentStart, parentEnd + 1).join('\n');

	// TODO: Currently using the parseOptions without using any React hooks
	// Needs to be changed later by chaining the values from RichTextComposer component itself
	const parseOptions: Options = {
		colors: true,
		emoticons: true,
		customDomains: [],
		katex: {
			dollarSyntax: false,
			parenthesisSyntax: true,
		},
	};

	if (extractedLines.trim() === '') {
		return [] as Root;
	}

	return parse(extractedLines, parseOptions);
};

const astToHTML = (parsedAST: Root): string => {
	// Check how Rocket.Chat's AST parses to React components in the chat room
	// Use that algorithm but instead convert it to HTML
	return renderToHtml(parsedAST);
};

const resolveTextState = (input: HTMLDivElement, startLine: number, endLine: number) => {
	console.log("composerTextState", composerTextState);
	console.log("cursorPositionState", cursorPositionState);

	// const { selectionStart, selectionEnd } = getSelectionRange(input);

	// Check if cursor position is uninitialized
	if (cursorPositionState === -1) {
		console.warn(cursorPositionState, 'is uninitialized');
		return;
	}

	// Find out the parent lines of each and every line: both start and end
	// selectParentEnd is used to select all the lines to be replaced
	// Will have to look into this
	const { parentStart, parentEnd } = getLineParents(startLine);
	const { parentEnd: selectParentEnd } = getLineParents(endLine);

	// console.log("testing if this works: ")
	// console.log("parentStart", parentStart);
	// console.log("parentEnd", parentEnd);

	// Get the parsed AST from the parent lines
	const parsedAST = parseMessage(parentStart, parentEnd);
	console.log("parsedAST", parsedAST);

	// Convert the AST to innerHTML string
	const parsedHTML = astToHTML(parsedAST);
	console.log("astToHTML", parsedHTML);

	// Get the selectionStart and selectionEnd (aliased) of the parent lines
	const { selectionStart, selectionEnd } = getSelectionRangeFromLines(input, parentStart, selectParentEnd);

	// Select the parent lines
	setSelectionRange(input, selectionStart, selectionEnd);

	// Magic Function: replace using execCommand
	document.execCommand('insertHTML', false, parsedHTML);

	// Update the cursor position once the text has been resolved
	console.log("updating cursorPositionState:", cursorPositionState)
	setSelectionRange(input, cursorPositionState, cursorPositionState);
};

export const struggle = (e: InputEvent, input: HTMLDivElement) => {
	// console.log('input type: ', e);
	const selection = getSelectionRange(input);
	const { selectionStart, selectionEnd } = selection;
	const lineInfo = getCursorSelectionInfo(input, selection);

	// Initialize the text state if completely empty/uninitialized
	// OR check if composerTextState even matches the text inside the Composer
	// This can be improved by updating the states properly
	if (composerTextState.length === 0 || composerTextState.join('\n') !== input.innerText) {
		if (input.innerText.trim() === '') {
			composerTextState = [''];
		} else {
			composerTextState = input.innerText.split('\n');
		}
	}

	// composerTextState.join('\n') !== input.innerText

	// Get line information
	const { start, end } = lineInfo;

	// Selection checks for if its a selection or not,
	// and if it is, whether its on the same line or not
	const isSelection = !(selectionStart === selectionEnd);
	const isSameLine = start.line === end.line;

	if (e.inputType === 'insertText') {
		e.preventDefault();

		// A. Take the left hand slice from the first line
		// B. Add the text that is typed
		// C. Add the right hand slice from the last line
		// console.log("composerTextState:", composerTextState)
		// console.log("at line", start.line, ":", composerTextState[start.line])
		composerTextState[start.line] =
			(composerTextState[start.line] ?? '').slice(0, start.col) + e.data + (composerTextState[end.line] ?? '').slice(end.col);

		// Purge the other lines in the text array state as they are essentially merged with the first line
		if (!isSameLine) {
			composerTextState.splice(start.line + 1, end.line - start.line);
		}

		// Use a resolver function to select from start line's parent start line to end line's parent end line
		// use the selection function to select the entirety of the structure
		// this means it will select the entire ordered or unordered list or a codeblock if required
		// then replace the parsed markdown using insertHTML and restore the cursor position
		// restore the cursor position at selectionStart + 1
		cursorPositionState = selectionStart + 1;
	} else if (e.inputType === 'deleteContentBackward') {
		e.preventDefault();

		// Check if it is a selection and then clear accordingly
		if (isSelection) {
			composerTextState[start.line] =
				(composerTextState[start.line] ?? '').slice(0, start.col) + (composerTextState[end.line] ?? '').slice(end.col);

			if (!isSameLine) {
				composerTextState.splice(start.line + 1, end.line - start.line);
			}
			// I. If a text selection was deleted then restore the cursor position at selectionStart
			cursorPositionState = selectionStart;
		}

		// If it is not a selection then it is a cursor
		// Check if cursor is not at the top-left position (as backspace deletion wont work)
		else if (selectionStart > 0) {
			// Check if cursor is at the start of a line (which isnt the first line)
			// if so, then merge with the above line
			// else, remove normally
			if (selectionStart === start.first) {
				composerTextState[start.line - 1] += composerTextState[start.line] ?? '';
				composerTextState.splice(start.line, 1);
			} else {
				composerTextState[start.line] =
					(composerTextState[start.line] ?? '').slice(0, start.col - 1) + (composerTextState[end.line] ?? '').slice(end.col);
			}
			// II. else restore the cursor position at selectionStart - 1
			cursorPositionState = selectionStart - 1;
		}
		// Use a resolver function as above
	} else if (e.inputType === 'deleteContentForward') {
		e.preventDefault();

		// Check if it is a selection and then clear accordingly (same code as above)
		if (isSelection) {
			composerTextState[start.line] =
				(composerTextState[start.line] ?? '').slice(0, start.col) + (composerTextState[end.line] ?? '').slice(end.col);

			if (!isSameLine) {
				composerTextState.splice(start.line + 1, end.line - start.line);
			}
		}

		// If it is not a selection then it is a cursor
		// Check if cursor is not at the bottom-right position (as forward deletion wont work)
		else if (selectionEnd < input.innerText.length) {
			// Check if cursor is at the start of a line (which isnt the last line)
			// if so, then merge with the below line
			if (selectionStart === start.last) {
				composerTextState[start.line] += composerTextState[start.line + 1] ?? '';
				composerTextState.splice(start.line + 1, 1);
			} else {
				composerTextState[start.line] =
					(composerTextState[start.line] ?? '').slice(0, start.col) + (composerTextState[end.line] ?? '').slice(end.col + 1);
			}
		}
		// Use a resolver function as above
		// If a text selection was deleted then restore the cursor position at selectionStart
		// else restore the cursor position at selectionStart (the cursor position does not change)
	} else {
		// For any other event type that has not been handled yet
		// reset the composerTextState and cursorPositionState so that it does not go stale
		composerLineParents = {};
		cursorPositionState = -1;
	}

	composerLineParents = detectBlocks(composerTextState);
	resolveTextState(input, start.line, end.line);
};
