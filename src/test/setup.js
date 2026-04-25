import '@testing-library/jest-dom'

if (!window.CSS) {
	window.CSS = {};
}

if (typeof window.CSS.supports !== 'function') {
	window.CSS.supports = () => false;
}

if (typeof window.matchMedia !== 'function') {
	window.matchMedia = (query) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: () => {},
		removeListener: () => {},
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => false,
	});
}
