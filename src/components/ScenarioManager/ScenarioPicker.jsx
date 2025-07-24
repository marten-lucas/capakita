import React, { useState } from 'react';
import { Box, Accordion, AccordionSummary, AccordionDetails, Typography, List, IconButton, InputLabel, Paper } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useSelector, useDispatch } from 'react-redux';
import { addScenario, setSelectedScenarioId } from '../../store/simScenarioSlice';
import ScenarioTree from './ScenarioTree';
import ScenarioDialog from './ScenarioDialog';
import store from '../../store/store';

function ScenarioPicker() {
    const dispatch = useDispatch();
    const scenarios = useSelector(state => state.simScenario.scenarios);
    const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);

    const [expanded, setExpanded] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogScenarioId, setDialogScenarioId] = useState(null);
    const [dialogIsNew, setDialogIsNew] = useState(false);

    const selectedScenario = scenarios.find(s => s.id === selectedScenarioId);

    // Handlers for dialog
    const handleEdit = (scenario) => {
        setDialogScenarioId(scenario.id);
        setDialogIsNew(false);
        setDialogOpen(true);
    };
    const handleAdd = (baseScenario) => {
        dispatch(addScenario({
            name: 'Neues Szenario',
            baseScenarioId: baseScenario?.id || null,
            makeNameUnique: true
        }));
        setTimeout(() => {
            const allScenarios = [...store.getState().simScenario.scenarios];
            const lastScenario = allScenarios[allScenarios.length - 1];
            if (lastScenario) {
                setDialogScenarioId(lastScenario.id);
                setDialogIsNew(true);
                setDialogOpen(true);
                dispatch(setSelectedScenarioId(lastScenario.id));
            }
        }, 0);
        setExpanded(false);
    };
    const handleDelete = (scenario) => {
        setDialogScenarioId(scenario.id);
        setDialogIsNew(false);
        setDialogOpen('delete');
    };

    return (
        <Paper
            variant="outlined"
            sx={{
                p: 2,
                ml: 0,
                mr: 3,
                mt: 2,
                mb: 1,
                borderRadius: 2,
                borderColor: 'divider',
                bgcolor: 'background.paper',
                minWidth: 320
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <InputLabel sx={{ mb: 0.5, fontSize: '0.75rem', color: 'text.secondary' }}>
                        Szenario
                    </InputLabel>
                    <Accordion
                        expanded={expanded}
                        onChange={() => setExpanded(!expanded)}
                        sx={{
                            minWidth: 0,
                            flex: 1,
                            boxShadow: 'none',
                            '&:before': { display: 'none' },
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1
                        }}
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            aria-controls="scenario-list-content"
                            id="scenario-list-header"
                            sx={{
                                minHeight: 40,
                                height: 40,
                                '& .MuiAccordionSummary-content': {
                                    my: 0,
                                    alignItems: 'center',
                                    margin: 0
                                },
                                '& .MuiAccordionSummary-expandIconWrapper': {
                                    color: 'action.active'
                                }
                            }}
                        >
                            <Typography
                                component="span"
                                sx={{
                                    color: 'text.primary',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    flex: 1,
                                    fontSize: '0.875rem'
                                }}
                            >
                                {selectedScenario
                                    ? `${selectedScenario.name || `Szenario ${selectedScenario.id}`}${selectedScenario.baseScenarioId ? ' (basiert auf)' : ''}`
                                    : 'Szenario auswählen'}
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails sx={{ p: 0 }}>
                            <List dense disablePadding>
                                <ScenarioTree
                                    onEdit={handleEdit}
                                    onAdd={handleAdd}
                                    onDelete={handleDelete}
                                />
                            </List>
                        </AccordionDetails>
                    </Accordion>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, height: 40 }}>
                    <IconButton
                        size="small"
                        aria-label="edit"
                        onClick={e => {
                            e.stopPropagation();
                            if (selectedScenario) handleEdit(selectedScenario);
                        }}
                        disabled={!selectedScenario}
                        sx={{ width: 32, height: 32, mt: 3 }}
                    >
                        <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                        size="small"
                        aria-label="add"
                        onClick={e => {
                            e.stopPropagation();
                            if (selectedScenario) handleAdd(selectedScenario);
                        }}
                        disabled={!selectedScenario}
                        sx={{ width: 32, height: 32, mt: 3 }}
                    >
                        <AddIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                        size="small"
                        aria-label="delete"
                        onClick={e => {
                            e.stopPropagation();
                            if (selectedScenario) handleDelete(selectedScenario);
                        }}
                        disabled={!selectedScenario}
                        sx={{ width: 32, height: 32, mt: 3 }}
                    >
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                </Box>
            </Box>
            {/* Dialog for edit/add/delete */}
            {dialogOpen && (
                <ScenarioDialog
                    scenarioId={dialogScenarioId}
                    isNew={dialogIsNew}
                    mode={dialogOpen === 'delete' ? 'delete' : 'edit'}
                    onClose={() => setDialogOpen(false)}
                />
            )}
        </Paper>
    );
}

export default ScenarioPicker;