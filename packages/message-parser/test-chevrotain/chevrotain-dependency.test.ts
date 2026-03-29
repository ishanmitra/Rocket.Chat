test('resolves the Chevrotain dependency in the workspace runtime', () => {
	expect(require.resolve('chevrotain')).toContain('chevrotain');
});
