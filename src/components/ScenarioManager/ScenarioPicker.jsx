import React, { useState } from 'react';
import { Box, Accordion, AccordionSummary, AccordionDetails, Typography, IconButton, Paper, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import { useSelector, useDispatch } from 'react-redux';
import { addScenario, setSelectedScenarioId, deleteScenario } from '../../store/simScenarioSlice';
import { useNavigate } from 'react-router-dom';
import store from '../../store/store';
import ScenarioTree from './ScenarioTree';

// Helper to build tree structure for TreeView

function ScenarioPicker() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const scenarios = useSelector(state => state.simScenario.scenarios);
    const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);

    const [expanded, setExpanded] = useState(false); // Default to expanded
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [scenarioToDelete, setScenarioToDelete] = useState(null);

    const selectedScenario = scenarios.find(s => s.id === selectedScenarioId);
    const baseScenario = selectedScenario?.baseScenarioId
        ? scenarios.find(s => s.id === selectedScenario.baseScenarioId)
        : null;

    // Handlers for dialog
    const handleEdit = (scenario) => {
        // Instead of opening dialog, navigate to SettingsPage scenario tab
        navigate('/settings?tab=scenarios');
        // Optionally, select scenario in redux
        dispatch(setSelectedScenarioId(scenario.id));
    };
    const handleAdd = (baseScenario) => {
        // Always navigate to Szenarien tab (now index 0)
        navigate('/settings?tab=scenarios');
        dispatch(addScenario({
            name: 'Neues Szenario',
            baseScenarioId: baseScenario?.id || null,
            makeNameUnique: true
        }));
        setTimeout(() => {
            const allScenarios = [...store.getState().simScenario.scenarios];
            const lastScenario = allScenarios[allScenarios.length - 1];
            if (lastScenario) {
                dispatch(setSelectedScenarioId(lastScenario.id));
            }
        }, 0);
        setExpanded(false);
    };
    // Updated delete handler
    const handleDelete = (scenario) => {
        setScenarioToDelete(scenario);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = () => {
        if (scenarioToDelete) {
            dispatch(deleteScenario(scenarioToDelete.id));
            // Optionally, update selection if deleted scenario was selected
            if (selectedScenarioId === scenarioToDelete.id) {
                dispatch(setSelectedScenarioId(null));
            }
        }
        setDeleteDialogOpen(false);
        setScenarioToDelete(null);
    };

    const handleDeleteCancel = () => {
        setDeleteDialogOpen(false);
        setScenarioToDelete(null);
    };

    return (
        <>
            <Paper
                variant="outlined"
                sx={{
                    p: 0,
                    ml: 0,
                    mr: 0,
                    mt: 0,
                    mb: 0,
                    borderRadius: 2,
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    minWidth: 220,
                    boxShadow: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    height: 48,
                    position: 'relative'
                }}
            >
                <Accordion
                    expanded={expanded}
                    onChange={() => setExpanded(!expanded)}
                    sx={{
                        minWidth: 0,
                        flex: 1,
                        boxShadow: 'none',
                        '&:before': { display: 'none' },
                        border: 'none',
                        borderRadius: 2,
                        m: 0,
                        background: 'none'
                    }}
                >
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        aria-controls="scenario-list-content"
                        id="scenario-list-header"
                        sx={{
                            minHeight: 48,
                            height: 48,
                            px: 2,
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
                        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
                            <Typography
                                component="span"
                                sx={{
                                    color: 'text.primary',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    flex: 1,
                                    fontSize: '0.95rem'
                                }}
                            >
                                {selectedScenario
                                    ? `${selectedScenario.name || `Szenario ${selectedScenario.id}`}`
                                    : 'Szenario auswählen'}
                            </Typography>
                            {selectedScenario?.baseScenarioId && (
                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', ml: 1 }}>
                                    Basiert auf: {baseScenario?.name || 'Unbekannt'}
                                </Typography>
                            )}
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails
                        sx={{
                            p: 0,
                            minWidth: 380,
                            maxWidth: 480,
                            maxHeight: 360,
                            overflowY: 'auto',
                            position: 'absolute',
                            top: 48,
                            left: 0,
                            right: 'auto',
                            zIndex: 1301,
                            boxShadow: 3,
                            bgcolor: 'background.paper',
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: 'divider',
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                    >
                        <Box sx={{ minHeight: 200, minWidth: 360, px: 1, py: 1 }}>
                            <ScenarioTree
                                onEdit={handleEdit}
                                onAdd={handleAdd}
                                onDelete={handleDelete}
                            />
                            {/* Add base scenario button below the tree */}
                            <Box sx={{ display: 'flex', justifyContent: 'flex-start', mt: 1 }}>
                                <IconButton
                                    size="small"
                                    aria-label="add-base"
                                    color="primary"
                                    onClick={() => handleAdd(null)}
                                    sx={{
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: 1,
                                        px: 1,
                                        py: 0.5,
                                        mr: 1
                                    }}
                                >
                                    <AddIcon fontSize="small" sx={{ mr: 1 }} />
                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                        Szenario hinzufügen
                                    </Typography>
                                </IconButton>
                            </Box>
                        </Box>
                    </AccordionDetails>
                </Accordion>
            </Paper>
            {/* Confirmation Dialog */}
            <Dialog
                open={deleteDialogOpen}
                onClose={handleDeleteCancel}
            >
                <DialogTitle>Szenario löschen?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Möchten Sie das Szenario{' '}
                        <b>{scenarioToDelete?.name || 'Unbenannt'}</b>
                        {' '}wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleDeleteCancel}>Abbrechen</Button>
                    <Button onClick={handleDeleteConfirm} color="error" variant="contained">
                        Löschen
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}

export default ScenarioPicker;