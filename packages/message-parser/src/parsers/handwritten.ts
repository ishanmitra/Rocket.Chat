import type { Root } from '../definitions';
import type { Options } from '../index';
import { parseHandwritten } from './handwritten/index';

export const parse = (input: string, options?: Options): Root => parseHandwritten(input, options);

export { parse as parser };
