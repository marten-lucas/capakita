import React from 'react';
import { Typography, Box, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ModMonitor from './ModMonitor';
import BookingCards from './BookingCards';

function SimDataBookingTab({
  item,
  bookings,
  lastAddedBookingIdx,
  importedBookingCount,
  handleAddBooking,
  handleDeleteBooking,
  handleRestoreBooking,
}) {
  return (
    <Box flex={1} display="flex" flexDirection="column" gap={2} sx={{ overflowY: 'auto' }}>
      <Box display="flex" alignItems="center" gap={2} sx={{ mb: 1 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={handleAddBooking}
        >
          Buchungszeitraum hinzufügen
        </Button>
        <ModMonitor
          itemId={item.id}
          field="bookings"
          value={JSON.stringify(bookings)}
          originalValue={JSON.stringify(item.originalParsedData?.booking || [])}
          onRestore={() => {
            // Restore all bookings
            item.originalParsedData?.booking &&
              handleRestoreBooking(item.id, JSON.parse(JSON.stringify(item.originalParsedData.booking)));
          }}
          title="Alle Buchungen auf importierte Werte zurücksetzen"
          confirmMsg="Alle Buchungen auf importierten Wert zurücksetzen?"
        />
      </Box>
      <BookingCards
        itemId={item.id}
        type={item.type}
        lastAddedIndex={lastAddedBookingIdx}
        importedCount={importedBookingCount}
        originalBookings={item?.originalParsedData?.booking}
        onDelete={handleDeleteBooking}
        isManualEntry={item?.rawdata?.source === 'manual entry'}
      />
    </Box>
  );
}

export default SimDataBookingTab;

