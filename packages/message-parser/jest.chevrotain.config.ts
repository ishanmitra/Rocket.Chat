import baseConfig from './jest.config';

export default {
	...baseConfig,
	displayName: 'chevrotain',
	testMatch: ['<rootDir>/test-chevrotain/**/*.test.ts'],
	testPathIgnorePatterns: ['/node_modules/', '\\.bench\\.ts$'],
	transformIgnorePatterns: ['<rootDir>/node_modules/@babel', '<rootDir>/node_modules/@jest', '/node_modules/(?!(@testing-library|chevrotain|@chevrotain)/)'],
	moduleNameMapper: {
		'^chevrotain$': '<rootDir>/../../node_modules/chevrotain/lib/chevrotain.mjs',
	},
} as const;
