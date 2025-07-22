import React, { useState } from 'react';
import { Box, TextField, Button, Typography, MenuItem, IconButton, Table, TableBody, TableCell, TableHead, TableRow, Checkbox, Menu } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { 
  getSalaryForGroupAndStage, 
  normalizeDateString, 
  getAllSalaryGroups, 
  getAllSalaryStages, 
  getAllBonusTypes,
  getBonusDefinition,
  calcAvrChildBonus,
  calcAvrInstructorBonus,
  calcAvrYearlyBonus} from '../../utils/avr-calculator';

function FinancialsDetail({ financial, onChange, onDelete, item }) {
  // Debug: Show the item as stored in simScenarioStore
  console.log('simScenarioStore item:', item);

  const handleField = (field, value) => {
    onChange({ ...financial, [field]: value });
  };

  // Get Eintrittsdatum from parseddata.startdate, fallback to empty string
  const eintrittsdatum = item?.parseddata?.startdate
    ? item.parseddata.startdate.split('.').reverse().join('-')
    : '';

  // Hilfsfunktion: Hole Wochenstunden und fulltimeHours
  const getWochenstunden = () => {
    // Try to get from worktime field (handle German decimal format)
    let worktime = item?.parseddata?.worktime || item?.parseddata?.wochenstunden || financial.wochenstunden;
    if (worktime && typeof worktime === 'string') {
      // Replace German decimal comma with dot
      worktime = worktime.replace(',', '.');
    }
    let wochenstunden = Number(worktime) || 0;
    
    // Note: worktime should now be automatically calculated from bookings
    // This fallback calculation is kept for safety but should rarely be needed
    if (wochenstunden === 0 && item?.parseddata?.booking) {
      let totalMinutesPerWeek = 0;
      item.parseddata.booking.forEach(booking => {
        if (booking.times) {
          booking.times.forEach(dayTime => {
            if (dayTime.segments) {
              dayTime.segments.forEach(segment => {
                if (segment.booking_start && segment.booking_end) {
                  const [sh, sm] = segment.booking_start.split(':').map(Number);
                  const [eh, em] = segment.booking_end.split(':').map(Number);
                  const minutes = (eh * 60 + em) - (sh * 60 + sm);
                  if (minutes > 0) totalMinutesPerWeek += minutes;
                }
              });
            }
          });
        }
      });
      wochenstunden = totalMinutesPerWeek / 60;
    }
    
    return wochenstunden;
  };
  
  const wochenstunden = getWochenstunden();
  // Use today's date as reference for AVR calculator, normalized
  // Hole fulltimeHours aus AVR-Daten

  if (financial.type === 'expense-avr') {
    // Use today's date as reference for AVR calculator, normalized
    const todayStr = normalizeDateString(new Date().toISOString().slice(0, 10));

    // Gruppe options from reference data
    const groupOptions = getAllSalaryGroups(todayStr); // [{group_id, group_name}]

    // Find selected group name by group_id
    const selectedGroup = groupOptions.find(g => g.group_id === financial.group);
    const selectedGroupName = selectedGroup ? selectedGroup.group_name : '';

    // Stufe options from reference data
    const stageOptions = financial.group
      ? getAllSalaryStages(todayStr, financial.group).map(a => ({
          value: a.stage,
          label: `Stufe ${a.stage}`
        }))
      : [];

    // Determine salary using AVR calculator
    let avrSalary = null;
    if (financial.group && financial.stage) {
      avrSalary = getSalaryForGroupAndStage(
        todayStr,
        selectedGroupName,
        financial.stage // pass stage id directly
      );
    }

    // Zuschläge-Handler

    // Get bonus types for the reference date
    const bonusTypes = getAllBonusTypes(todayStr);

    // Bonus-Beträge berechnen und Zusatzinfos holen
    const bonusRows = bonusTypes.map(bonus => {
      const def = getBonusDefinition(todayStr, bonus.value);
      let amount = '';
      let payout = '';
      let payoutDate = null;
      let startInput = null;
      let endInput = null;
      let continueOnAbsence = !!def?.continue_on_absence;

      // Start/Ende bestimmen
      let bonusStart = '';
      let bonusEnd = '';
      if (def?.startdate === 'input') {
        bonusStart = financial[`${bonus.value}_start`] || '';
        startInput = true;
      } else if (def?.startdate === 'simulationdata') {
        bonusStart = item?.parseddata?.startdate || '';
      }
      if (def?.enddate === 'input') {
        bonusEnd = financial[`${bonus.value}_end`] || '';
        endInput = true;
      } else if (def?.enddate === 'simulationdata') {
        bonusEnd = item?.parseddata?.enddate || '';
      }

      // Betrag berechnen
      if (bonus.value === 'avr-childbonus') {
        amount = calcAvrChildBonus(todayStr, financial.kinderanzahl || 0, wochenstunden);
        payout = 'Monatlich';
      } else if (bonus.value === 'avr-instructor') {
        amount = calcAvrInstructorBonus(todayStr, wochenstunden, bonusStart, bonusEnd);
        payout = 'Monatlich';
      } else if (bonus.value === 'avr-yearly') {
        const yearly = calcAvrYearlyBonus(
          todayStr,
          selectedGroupName,
          financial.stage,
          wochenstunden,
          bonusStart,
          bonusEnd
        );
        amount = yearly.amount;
        payout = 'Jährlich';
        payoutDate = yearly.payoutDate;
      }

      return {
        ...bonus,
        amount,
        payout,
        payoutDate,
        startInput,
        endInput,
        bonusStart,
        bonusEnd,
        continueOnAbsence,
        def
      };
    });

    // Handler für Start/Ende Input
    const handleBonusDateChange = (bonusKey, field, value) => {
      onChange({
        ...financial,
        [`${bonusKey}_${field}`]: value
      });
    };

    // Handler to "hide" a bonus type for this financial entry
    const handleBonusDelete = (bonusType) => {
      const disabledBonuses = Array.isArray(financial.disabledBonuses)
        ? [...financial.disabledBonuses, bonusType]
        : [bonusType];
      onChange({
        ...financial,
        disabledBonuses
      });
    };

    // Handler to add a bonus type by removing it from disabled list
    const handleBonusAdd = (bonusType) => {
      const disabledBonuses = Array.isArray(financial.disabledBonuses)
        ? financial.disabledBonuses.filter(type => type !== bonusType)
        : [];
      onChange({
        ...financial,
        disabledBonuses
      });
      setBonusMenuAnchor(null);
    };

    // Get available bonus types that are currently disabled
    const availableBonusTypes = bonusTypes.filter(bonus => 
      Array.isArray(financial.disabledBonuses) && financial.disabledBonuses.includes(bonus.value)
    );

    // State for bonus menu
    const [bonusMenuAnchor, setBonusMenuAnchor] = useState(null);
    const bonusMenuOpen = Boolean(bonusMenuAnchor);

    // Filter out disabled bonuses
    const filteredBonusRows = Array.isArray(financial.disabledBonuses)
      ? bonusRows.filter(row => !financial.disabledBonuses.includes(row.value))
      : bonusRows;

    return (
      <Box display="flex" flexDirection="column" gap={2} position="relative">
        <TextField
          select
          label="Gruppe"
          value={financial.group || ''}
          onChange={e =>
            onChange({ ...financial, group: Number(e.target.value), stage: '' })
          }
        >
          {groupOptions.map(opt => (
            <MenuItem key={opt.group_id} value={opt.group_id}>
              {opt.group_name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Stufe"
          value={financial.stage || ''}
          onChange={e =>
            onChange({ ...financial, stage: Number(e.target.value) })
          }
          disabled={!financial.group}
        >
          {stageOptions.map(opt => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Eintrittsdatum"
          value={eintrittsdatum}
          InputProps={{ readOnly: true }}
          disabled
        />
        <TextField
          label="Anzahl Kinder"
          type="number"
          size="small"
          value={financial.kinderanzahl || ''}
          onChange={e => onChange({ ...financial, kinderanzahl: e.target.value })}
          sx={{ maxWidth: 180 }}
          inputProps={{ min: 0 }}
        />
        {avrSalary !== null && (
          <Typography variant="body2" color="primary">
            AVR-Gehalt: {avrSalary.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
          </Typography>
        )}

        {/* Bonus-Tabelle */}
        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle2">Boni</Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={(e) => setBonusMenuAnchor(e.currentTarget)}
              disabled={availableBonusTypes.length === 0}
            >
              Bonus hinzufügen
            </Button>
          </Box>
          <Menu
            anchorEl={bonusMenuAnchor}
            open={bonusMenuOpen}
            onClose={() => setBonusMenuAnchor(null)}
          >
            {availableBonusTypes.map((bonus) => (
              <MenuItem key={bonus.value} onClick={() => handleBonusAdd(bonus.value)}>
                {bonus.label}
              </MenuItem>
            ))}
          </Menu>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Auszahlung</TableCell>
                <TableCell>Betrag</TableCell>
                <TableCell>Fortzahlung</TableCell>
                <TableCell>Gültig von</TableCell>
                <TableCell>Gültig bis</TableCell>
                <TableCell>Aktion</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredBonusRows.map((row) => (
                <TableRow key={row.value}>
                  <TableCell>
                    {row.label}
                    {row.payoutDate && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        Auszahlung: {row.payoutDate}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{row.payout}</TableCell>
                  <TableCell>
                    {row.amount !== null && row.amount !== undefined && row.amount !== ''
                      ? Number(row.amount).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
                      : ''}
                  </TableCell>
                  <TableCell>
                    <Checkbox checked={row.continueOnAbsence} disabled />
                  </TableCell>
                  <TableCell>
                    {row.startInput ? (
                      <TextField
                        type="date"
                        size="small"
                        value={row.bonusStart || ''}
                        onChange={e => handleBonusDateChange(row.value, 'start', e.target.value)}
                        sx={{ minWidth: 120 }}
                      />
                    ) : (
                      row.bonusStart ? row.bonusStart : ''
                    )}
                  </TableCell>
                  <TableCell>
                    {row.endInput ? (
                      <TextField
                        type="date"
                        size="small"
                        value={row.bonusEnd || ''}
                        onChange={e => handleBonusDateChange(row.value, 'end', e.target.value)}
                        sx={{ minWidth: 120 }}
                      />
                    ) : (
                      row.bonusEnd ? row.bonusEnd : ''
                    )}
                  </TableCell>
                  <TableCell>
                    <IconButton
                      aria-label="Entfernen"
                      size="small"
                      onClick={() => handleBonusDelete(row.value)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        <Button
          variant="outlined"
          color="error"
          size="small"
          onClick={onDelete}
        >
          Entfernen
        </Button>
      </Box>
    );
  }

  return (
    <Box display="flex" flexDirection="column" gap={2} position="relative">
      <IconButton
        aria-label="Entfernen"
        onClick={onDelete}
        size="small"
        sx={{ position: 'absolute', top: 0, right: 0 }}
      >
        <DeleteIcon fontSize="small" />
      </IconButton>
      <Typography variant="body2">{financial.label}</Typography>
      <TextField
        label="Betrag (€)"
        type="number"
        size="small"
        value={financial.amount}
        onChange={e => handleField('amount', e.target.value)}
        sx={{ maxWidth: 180 }}
      />
      <Box display="flex" gap={2}>
        <TextField
          label="von"
          type="date"
          size="small"
          value={financial.from}
          onChange={e => handleField('from', e.target.value)}
        />
        <TextField
          label="bis"
          type="date"
          size="small"
          value={financial.to}
          onChange={e => handleField('to', e.target.value)}
        />
      </Box>
      <TextField
        label="Bemerkung"
        size="small"
        value={financial.note}
        onChange={e => handleField('note', e.target.value)}
        multiline
        minRows={2}
        maxRows={4}
      />
      <Button
        variant="outlined"
        color="error"
        size="small"
        onClick={onDelete}
      >
        Entfernen
      </Button>
    </Box>
  );
}

export default FinancialsDetail;