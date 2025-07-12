import { AppBar, Box, Button, Toolbar, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

function TopNav() {
  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Kiga Simulator
        </Typography>
        <Box>
          <Button color="inherit" component={RouterLink} to="/simulation">
            Simulation
          </Button>
          <Button color="inherit" component={RouterLink} to="/daten">
            Daten
          </Button>

        </Box>
      </Toolbar>
    </AppBar>
  )
}

export default TopNav