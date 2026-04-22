import '@testing-library/jest-dom'

if (!window.CSS) {
	window.CSS = {};
}

if (typeof window.CSS.supports !== 'function') {
	window.CSS.supports = () => false;
}
