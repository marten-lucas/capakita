import { Typography, Box } from '@mui/material';

function ModificationsTab({ item }) {
  return (
    <Box flex={1} display="flex" flexDirection="column">
      <Typography variant="body2" color="text.secondary">
        Buchungen:
      </Typography>
      <pre style={{ fontSize: 12, marginTop: 8, flex: 1 }}>
        {JSON.stringify(item.parseddata?.buchungen, null, 2)}
      </pre>
    </Box>
  );
}

export default ModificationsTab;
