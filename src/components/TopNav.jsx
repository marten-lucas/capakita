import * as React from 'react'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Container from '@mui/material/Container'
import Button from '@mui/material/Button'
import AdbIcon from '@mui/icons-material/Adb'
import { NavLink } from 'react-router-dom'

const pages = [
  { label: 'Simulation', path: '/simulation' },
  { label: 'Data', path: '/data' },
  { label: 'Settings', path: '/settings' },
  { label: 'Scenarios', path: '/scenarios' },
]

function TopNav() {
  return (
    <AppBar position="static">
      <Container maxWidth="xl" disableGutters>
        <Toolbar disableGutters>
          <AdbIcon sx={{ mr: 1, ml: 0 }} />
          <Typography
            variant="h6"
            noWrap
            component={NavLink}
            to="/"
            end
            sx={{
              mr: 2,
              ml: 0,
              fontFamily: 'monospace',
              fontWeight: 700,
              letterSpacing: '.3rem',
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            Kiga Simulator
          </Typography>
          <Box sx={{ flexGrow: 1, display: 'flex' }}>
            {pages.map((page) => (
              <Button
                key={page.label}
                component={NavLink}
                to={page.path}
                sx={{
                  my: 2,
                  color: 'white',
                  display: 'block',
                  '&.active': {
                    bgcolor: 'primary.dark',
                  },
                }}
              >
                {page.label}
              </Button>
            ))}
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  )
}

export default TopNav