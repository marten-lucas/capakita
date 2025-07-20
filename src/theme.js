import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#083743', // Dark blue from SVG
      light: '#2a5a68',
      dark: '#042429',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#f26e2e', // Orange from SVG
      light: '#f5915a',
      dark: '#d9571a',
      contrastText: '#ffffff',
    },
    tertiary: {
      main: '#faa513', // Golden yellow from SVG
      light: '#fbb945',
      dark: '#e8940b',
      contrastText: '#000000',
    },
    success: {
      main: '#435343', // Dark green from SVG
      light: '#6b7d6b',
      dark: '#2d3a2d',
      contrastText: '#ffffff',
    },
    warning: {
      main: '#d97b24', // Darker orange from SVG
      light: '#e19550',
      dark: '#c06619',
      contrastText: '#000000',
    },
    background: {
      default: '#ffffff', // White background for app
      paper: '#ffffff',
    },
    text: {
      primary: '#083743', // Dark blue for primary text
      secondary: '#435343', // Dark green for secondary text
    },
  },
  typography: {
    fontFamily: 'system-ui, Avenir, Helvetica, Arial, sans-serif',
    h1: {
      fontSize: '3.2rem',
      lineHeight: 1.1,
      color: '#083743',
    },
    h2: {
      color: '#083743',
    },
    h3: {
      color: '#f26e2e',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#fbf5ed', // Cream color for AppBar
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 4px 6px -1px rgba(8, 55, 67, 0.1), 0 2px 4px -1px rgba(8, 55, 67, 0.06)',
        },
      },
    },
  },
});

export default theme;
