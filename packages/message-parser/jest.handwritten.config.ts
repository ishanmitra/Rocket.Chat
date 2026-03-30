import baseConfig from './jest.config';

export default {
	...baseConfig,
	displayName: 'handwritten',
	testMatch: ['<rootDir>/test-handwritten/**/*.test.ts'],
	testPathIgnorePatterns: ['/node_modules/', '\\.bench\\.ts$'],
} as const;
