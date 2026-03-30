import type { Inlines, Root } from '../../definitions';
import { bold, italic, paragraph, plain, strike } from '../../utils';

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
