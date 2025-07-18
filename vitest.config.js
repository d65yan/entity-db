export default {
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.js'],
    coverage: {
      reporter: ['text', 'json'],
      include: ['src/**/*.{js,ts}'],
    },
  },
};