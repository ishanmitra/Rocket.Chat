export type Marker = {
	cursor: number;
};

export class Scanner {
	private cursor = 0;

	public constructor(private readonly input: string) {}

	public peek(offset = 0): string | undefined {
		return this.input[this.cursor + offset];
	}

	public match(value: string): boolean {
		return this.input.startsWith(value, this.cursor);
	}

	public eat(length = 1): string {
		const value = this.input.slice(this.cursor, this.cursor + length);
		this.cursor += length;
		return value;
	}

	public consumeWhile(predicate: (char: string, cursor: number) => boolean): string {
		const start = this.cursor;

		while (!this.eof()) {
			const current = this.peek();

			if (current === undefined || !predicate(current, this.cursor)) {
				break;
			}

			this.cursor += 1;
		}

		return this.input.slice(start, this.cursor);
	}

	public save(): Marker {
		return { cursor: this.cursor };
	}

	public restore(marker: Marker): void {
		this.cursor = marker.cursor;
	}

	public get position(): number {
		return this.cursor;
	}

	public get remaining(): string {
		return this.input.slice(this.cursor);
	}

	public eof(): boolean {
		return this.cursor >= this.input.length;
	}
}
