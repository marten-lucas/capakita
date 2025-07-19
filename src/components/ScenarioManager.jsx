import React, { useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Box, Typography, Accordion, AccordionSummary, AccordionDetails, List, ListItemButton, ListItemText, Paper, IconButton, Collapse, Button, TextField, Slider, Stack, MenuItem, Select, InputLabel, FormControl, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import useSimScenarioStore from '../store/simScenarioStore';

// Helper to build a tree from flat scenario list
function buildScenarioTree(scenarios) {
    const map = {};
    scenarios.forEach(s => { map[s.id] = { ...s, children: [] }; });
    const roots = [];
    scenarios.forEach(s => {
        if (s.baseScenarioId && map[s.baseScenarioId]) {
            map[s.baseScenarioId].children.push(map[s.id]);
        } else {
            roots.push(map[s.id]);
        }
    });
    return roots;
}

function ScenarioTreeList({
    scenarioTree,
    selectedId,
    onSelect,
    level = 0,
    expandedMap,
    setExpandedMap,
    onEdit,
    onAdd,
    onDelete
}) {
    return scenarioTree.map(scenario => {
        const hasChildren = scenario.children && scenario.children.length > 0;
        const expanded = expandedMap[scenario.id] ?? true;
        const isSelected = selectedId === scenario.id;
        return (
            <React.Fragment key={scenario.id}>
                <ListItemButton
                    selected={isSelected}
                    onClick={() => onSelect(scenario)}
                    sx={{
                        pl: 2 + level * 2,
                        bgcolor: isSelected ? 'action.selected' : undefined,
                        fontWeight: isSelected ? 700 : undefined
                    }}
                >
                    {/* Icons nur anzeigen, wenn Handler gesetzt */}
                    {hasChildren && onEdit && (
                        <IconButton
                            size="small"
                            onClick={e => {
                                e.stopPropagation();
                                setExpandedMap(map => ({ ...map, [scenario.id]: !expanded }));
                            }}
                            sx={{ mr: 1 }}
                        >
                            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                    )}
                    {(!hasChildren || !onEdit) && <Box sx={{ width: 32, display: 'inline-block' }} />}
                    <ListItemText
                        primary={
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Typography
                                    component="span"
                                    sx={{
                                        fontWeight: isSelected ? 700 : undefined,
                                        flex: 1,
                                        mr: 1
                                    }}
                                >
                                    {scenario.name}
                                </Typography>
                            </Box>
                        }
                        secondary={scenario.remark}
                        sx={{ flex: 1 }}
                    />
                    {/* Action Icons nur wenn Handler gesetzt */}
                    {onEdit && (
                        <>
                            <IconButton
                                size="small"
                                edge="end"
                                aria-label="edit"
                                onClick={e => {
                                    e.stopPropagation();
                                    onEdit?.(scenario);
                                }}
                                sx={{ ml: 0.5 }}
                            >
                                <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                                size="small"
                                edge="end"
                                aria-label="add"
                                onClick={e => {
                                    e.stopPropagation();
                                    onAdd?.(scenario);
                                }}
                                sx={{ ml: 0.5 }}
                            >
                                <AddIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                                size="small"
                                edge="end"
                                aria-label="delete"
                                onClick={e => {
                                    e.stopPropagation();
                                    onDelete?.(scenario);
                                }}
                                sx={{ ml: 0.5 }}
                            >
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </>
                    )}
                </ListItemButton>
                {hasChildren && (
                    <Collapse in={expanded} timeout="auto" unmountOnExit>
                        <ScenarioTreeList
                            scenarioTree={scenario.children}
                            selectedId={selectedId}
                            onSelect={onSelect}
                            level={level + 1}
                            expandedMap={expandedMap}
                            setExpandedMap={setExpandedMap}
                            onEdit={onEdit}
                            onAdd={onAdd}
                            onDelete={onDelete}
                        />
                    </Collapse>
                )}
            </React.Fragment>
        );
    });
}

function ScenarioDetailForm({ scenarioId, scenarios, onClose, isNew }) {
    const {
        getScenarioById,
        updateScenario,
        deleteScenario,
    } = useSimScenarioStore();

    const scenario = scenarioId ? getScenarioById(scenarioId) : null;

    // Only update local state, do not write to store on every change
    const [form, setForm] = useState(() => ({
        name: scenario?.name || '',
        remark: scenario?.remark || '',
        confidence: scenario?.confidence !== undefined ? Number(scenario.confidence) : 50,
        likelihood: scenario?.likelihood !== undefined ? Number(scenario.likelihood) : 50,
        desirability: scenario?.desirability !== undefined ? Number(scenario.desirability) : 50,
        baseScenarioId: scenario?.baseScenarioId || ''
    }));

    React.useEffect(() => {
        setForm({
            name: scenario?.name || '',
            remark: scenario?.remark || '',
            confidence: scenario?.confidence !== undefined ? Number(scenario.confidence) : 50,
            likelihood: scenario?.likelihood !== undefined ? Number(scenario.likelihood) : 50,
            desirability: scenario?.desirability !== undefined ? Number(scenario.desirability) : 50,
            baseScenarioId: scenario?.baseScenarioId || ''
        });
    }, [scenarioId, scenario]);


    // Build scenario tree for nested list, excluding the current scenario itself
    const scenarioTree = useMemo(() => {
        if (!scenario) return [];
        // Exclude the scenario itself from the tree
        const filtered = scenarios.filter(s => s.id !== scenario.id);
        return buildScenarioTree(filtered);
    }, [scenarios, scenario]);
    const [treeExpandedMap, setTreeExpandedMap] = useState({});
    const [baseScenarioAccordionOpen, setBaseScenarioAccordionOpen] = useState(false);

    const handleChange = (field, value) => {
        setForm(f => ({ ...f, [field]: value }));
    };

    const handleSave = () => {
        if (scenario) {
            // Save all fields from local form state to store
            updateScenario(scenario.id, { ...form });
        }
        onClose?.();
    };

    const handleCancel = () => {
        // Nur wenn als "neu" markiert, löschen
        if (isNew && scenario) {
            deleteScenario(scenario.id);
        }
        onClose?.();
    };

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    // Find all descendant scenario IDs (recursive)
    const collectDescendants = (id, allScenarios) => {
        let ids = [id];
        allScenarios.forEach(s => {
            if (s.baseScenarioId === id) {
                ids = ids.concat(collectDescendants(s.id, allScenarios));
            }
        });
        return ids;
    };


    const handleDeleteConfirmed = () => {
        if (!scenario) return;
        deleteScenario(scenario.id);
        setDeleteDialogOpen(false);
        onClose?.();
    };

    // Nested scenario selection for base scenario
    const handleBaseScenarioSelect = (selected) => {
        handleChange('baseScenarioId', selected ? selected.id : '');
        setBaseScenarioAccordionOpen(false);
    };

    return (
        <>
            <Dialog open={!!scenario} onClose={onClose} maxWidth="sm" fullWidth>
                <DialogTitle>Szenario bearbeiten</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <TextField
                            label="Szenarioname"
                            value={form.name}
                            onChange={e => handleChange('name', e.target.value)}
                            fullWidth
                            autoFocus
                            size="small"
                        />
                        {/* Basis-Szenario Auswahl als Accordion */}
                        <Box>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                Basis-Szenario
                            </Typography>
                            <Accordion
                                expanded={baseScenarioAccordionOpen}
                                onChange={() => setBaseScenarioAccordionOpen(open => !open)}
                                sx={{ mb: 1, boxShadow: 'none', border: '1px solid #eee' }}
                            >
                                <AccordionSummary
                                    expandIcon={<ExpandMoreIcon />}
                                    aria-controls="base-scenario-content"
                                    id="base-scenario-header"
                                    sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0, alignItems: 'center' } }}
                                >
                                    <Typography sx={{ flex: 1 }}>
                                        {form.baseScenarioId
                                            ? (scenarios.find(s => s.id === form.baseScenarioId)?.name || 'Unbekannt')
                                            : 'Keines'}
                                    </Typography>
                                </AccordionSummary>
                                <AccordionDetails sx={{ p: 0 }}>
                                    <List dense disablePadding>
                                        {/* "Keines" eingerückt und ohne Icons */}
                                        <ListItemButton
                                            selected={!form.baseScenarioId}
                                            onClick={() => handleBaseScenarioSelect(null)}
                                            sx={{ pl: 4 }}
                                        >
                                            <ListItemText primary="Keines" />
                                        </ListItemButton>
                                        {/* Szenarien ohne Action-Icons */}
                                        {scenarioTree.map(scenario => (
                                            <ScenarioTreeList
                                                key={scenario.id}
                                                scenarioTree={[scenario]}
                                                selectedId={form.baseScenarioId}
                                                onSelect={handleBaseScenarioSelect}
                                                expandedMap={treeExpandedMap}
                                                setExpandedMap={setTreeExpandedMap}
                                                // Icons ausblenden
                                                onEdit={undefined}
                                                onAdd={undefined}
                                                onDelete={undefined}
                                            />
                                        ))}
                                    </List>
                                </AccordionDetails>
                            </Accordion>
                        </Box>
                        <TextField
                            label="Bemerkung"
                            value={form.remark}
                            onChange={e => handleChange('remark', e.target.value)}
                            fullWidth
                            multiline
                            minRows={2}
                            maxRows={4}
                            size="small"
                        />
                        <Box>
                            <Typography gutterBottom>Wahrscheinlichkeit: {form.likelihood}%</Typography>
                            <Slider
                                value={Number(form.likelihood)}
                                min={0}
                                max={100}
                                step={1}
                                valueLabelDisplay="auto"
                                onChange={(_, val) => handleChange('likelihood', val)}
                                sx={{ mt: 0, mb: 1 }}
                            />
                        </Box>
                        <Box>
                            <Typography gutterBottom>Gewünschtheit: {form.desirability}%</Typography>
                            <Slider
                                value={Number(form.desirability)}
                                min={0}
                                max={100}
                                step={1}
                                valueLabelDisplay="auto"
                                onChange={(_, val) => handleChange('desirability', val)}
                                sx={{ mt: 0, mb: 1 }}
                            />
                        </Box>
                        <Box>
                            <Typography gutterBottom>Belastbarkeit: {form.confidence}%</Typography>
                            <Slider
                                value={Number(form.confidence)}
                                min={0}
                                max={100}
                                step={1}
                                valueLabelDisplay="auto"
                                onChange={(_, val) => handleChange('confidence', val)}
                                sx={{ mt: 0, mb: 1 }}
                            />
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions>
                    {/* Buttons je nach Modus */}
                    {!isNew && (
                        <Button onClick={onClose}>Schließen</Button>
                    )}
                    {isNew && (
                        <Button onClick={handleCancel}>Abbrechen</Button>
                    )}
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleSave}
                    >
                        Speichern
                    </Button>
                    {/* Löschen-Button entfernt */}
                </DialogActions>
            </Dialog>
            <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
                <DialogTitle>Szenario löschen</DialogTitle>
                <DialogContent>
                    <Typography>
                        Diese Aktion löscht das Szenario &quot;{form.name}&quot;
                        {(() => {
                            if (!scenario) return null;
                            const descendants = collectDescendants(scenario.id, scenarios);
                            if (descendants.length > 1) {
                                return <> und {descendants.length - 1} abhängige Szenario(s)</>;
                            }
                            return null;
                        })()}
                        . Dieser Vorgang kann nicht rückgängig gemacht werden.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)}>Abbrechen</Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={handleDeleteConfirmed}
                    >
                        OK
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}

const ScenarioManager = forwardRef(function ScenarioManager({ selectedScenarioId, setSelectedScenarioId, scenarios, setSelectedItem }, ref) {
    const [expanded, setExpanded] = useState(false);
    const [treeExpandedMap, setTreeExpandedMap] = useState({});
    const [editScenarioId, setEditScenarioId] = useState(null);
    const [editScenarioIsNew, setEditScenarioIsNew] = useState(false);
    const [deleteScenarioId, setDeleteScenarioId] = useState(null);

    const scenarioTree = useMemo(() => buildScenarioTree(scenarios), [scenarios]);
    const selectedScenario = scenarios.find(s => s.id === selectedScenarioId);

    // Store actions
    const addScenario = useSimScenarioStore(state => state.addScenario);

    // Add scenario as child of base and open edit dialog
    const handleAdd = (baseScenario) => {
        const newScenario = {
            name: 'Neues Szenario',
            remark: '',
            confidence: 50,
            likelihood: 50,
            baseScenarioId: baseScenario?.id || null
        };
        addScenario(newScenario);
        // Find the new scenario's id (last added)
        setTimeout(() => {
            const allScenarios = useSimScenarioStore.getState().scenarios;
            const lastScenario = allScenarios[allScenarios.length - 1];
            if (lastScenario) {
                setEditScenarioId(lastScenario.id);
                setEditScenarioIsNew(true);
                setSelectedScenarioId(lastScenario.id);
            }
        }, 0);
        setExpanded(false);
    };

    // Open edit dialog for scenario
    const handleEdit = (scenario) => {
        setEditScenarioId(scenario.id);
        setEditScenarioIsNew(false);
    };

    // Open delete confirmation dialog for scenario
    const handleDelete = (scenario) => {
        setDeleteScenarioId(scenario.id);
    };

    // Open detail view for scenario
    const handleSelect = (scenario) => {
        setSelectedScenarioId(scenario.id);
        setSelectedItem?.(null);
        setExpanded(false);
    };

    // Expose handleAdd for parent via ref
    useImperativeHandle(ref, () => ({
        handleAdd
    }));

    return (
        <Paper
            variant="outlined"
            sx={{
                px: 0,
                pt: 0,
                pb: 2,
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
            <Box sx={{ display: 'flex', alignItems: 'center', px: 2, pt: 2, pb: 1 }}>
                <Typography
                    variant="subtitle2"
                    sx={{
                        fontWeight: 600,
                        textAlign: 'left',
                        color: 'text.secondary',
                        flex: 1,
                        minWidth: 0,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}
                >
                    Szenario auswählen
                </Typography>
                <IconButton
                    size="small"
                    edge="end"
                    aria-label="edit"
                    onClick={e => {
                        e.stopPropagation();
                        if (selectedScenario) handleEdit(selectedScenario);
                    }}
                    sx={{ ml: 0.5 }}
                    disabled={!selectedScenario}
                >
                    <EditIcon fontSize="small" />
                </IconButton>
                <IconButton
                    size="small"
                    edge="end"
                    aria-label="add"
                    onClick={e => {
                        e.stopPropagation();
                        if (selectedScenario) handleAdd(selectedScenario);
                    }}
                    sx={{ ml: 0.5 }}
                    disabled={!selectedScenario}
                >
                    <AddIcon fontSize="small" />
                </IconButton>
                <IconButton
                    size="small"
                    edge="end"
                    aria-label="delete"
                    onClick={e => {
                        e.stopPropagation();
                        if (selectedScenario) handleDelete(selectedScenario);
                    }}
                    sx={{ ml: 0.5 }}
                    disabled={!selectedScenario}
                >
                    <DeleteIcon fontSize="small" />
                </IconButton>
            </Box>
            <Box sx={{ px: 0, pt: 1 }}>
                <Accordion
                    expanded={expanded}
                    onChange={() => setExpanded(!expanded)}
                    sx={{ minWidth: 280, flex: 1, boxShadow: 'none', '&:before': { display: 'none' } }}
                >
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        aria-controls="scenario-list-content"
                        id="scenario-list-header"
                        sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0, alignItems: 'center' } }}
                    >
                        <Typography component="span" sx={{ color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                            {selectedScenario
                                ? `${selectedScenario.name || `Szenario ${selectedScenario.id}`}${selectedScenario.baseScenarioId ? ' (basiert auf)' : ''}`
                                : 'Szenario auswählen'}
                        </Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ p: 0 }}>
                        <List dense disablePadding>
                            <ScenarioTreeList
                                scenarioTree={scenarioTree}
                                selectedId={selectedScenarioId}
                                onSelect={handleSelect}
                                expandedMap={treeExpandedMap}
                                setExpandedMap={setTreeExpandedMap}
                                onEdit={handleEdit}
                                onAdd={handleAdd}
                                onDelete={handleDelete}
                            />
                        </List>
                    </AccordionDetails>
                </Accordion>
            </Box>
            {/* Scenario Detail Dialog */}
            {editScenarioId && (
                <ScenarioDetailForm
                    scenarioId={editScenarioId}
                    scenarios={scenarios}
                    onClose={() => {
                        setEditScenarioId(null);
                        setEditScenarioIsNew(false);
                    }}
                    isNew={editScenarioIsNew}
                />
            )}
            {/* Delete Confirmation Dialog */}
            {deleteScenarioId && (
                <DeleteScenarioDialog
                    scenarioId={deleteScenarioId}
                    scenarios={scenarios}
                    onClose={() => {
                        setDeleteScenarioId(null);
                        setExpanded(false); // close accordion after delete or cancel
                    }}
                    onDeleted={() => {
                        setDeleteScenarioId(null);
                        setExpanded(false); // close accordion after delete
                    }}
                />
            )}
        </Paper>
    );
});

// Delete confirmation dialog component
function DeleteScenarioDialog({ scenarioId, scenarios, onClose, onDeleted }) {
    const { getScenarioById, deleteScenario } = useSimScenarioStore();
    const scenario = scenarioId ? getScenarioById(scenarioId) : null;

    // Find all descendant scenario IDs (recursive)
    const collectDescendants = (id, allScenarios) => {
        let ids = [id];
        allScenarios.forEach(s => {
            if (s.baseScenarioId === id) {
                ids = ids.concat(collectDescendants(s.id, allScenarios));
            }
        });
        return ids;
    };

    const handleDeleteConfirmed = () => {
        if (!scenario) return;
        deleteScenario(scenario.id);
        onDeleted?.();
    };

    if (!scenario) return null;

    const descendants = collectDescendants(scenario.id, scenarios);

    return (
        <Dialog open={!!scenario} onClose={onClose}>
            <DialogTitle>Szenario löschen</DialogTitle>
            <DialogContent>
                <Typography>
                    Diese Aktion löscht das Szenario &quot;{scenario.name}&quot;
                    {descendants.length > 1 && (
                        <> und {descendants.length - 1} abhängige Szenario(s)</>
                    )}
                    . Dieser Vorgang kann nicht rückgängig gemacht werden.
                </Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Abbrechen</Button>
                <Button
                    variant="contained"
                    color="error"
                    onClick={handleDeleteConfirmed}
                >
                    OK
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default ScenarioManager;

