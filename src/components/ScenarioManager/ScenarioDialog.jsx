import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, TextField, Slider } from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { updateScenario, deleteScenario } from '../../store/simScenarioSlice';

function ScenarioDialog({ scenarioId, isNew, mode = 'edit', onClose }) {
    const dispatch = useDispatch();
    const scenarios = useSelector(state => state.simScenario.scenarios);
    const scenario = scenarioId ? scenarios.find(s => s.id === scenarioId) : null;

    const [form, setForm] = useState(() => ({
        name: scenario?.name || '',
        remark: scenario?.remark || '',
        confidence: scenario?.confidence !== undefined ? Number(scenario.confidence) : 50,
        likelihood: scenario?.likelihood !== undefined ? Number(scenario.likelihood) : 50,
        desirability: scenario?.desirability !== undefined ? Number(scenario.desirability) : 50,
        baseScenarioId: scenario?.baseScenarioId || ''
    }));

    useEffect(() => {
        setForm({
            name: scenario?.name || '',
            remark: scenario?.remark || '',
            confidence: scenario?.confidence !== undefined ? Number(scenario.confidence) : 50,
            likelihood: scenario?.likelihood !== undefined ? Number(scenario.likelihood) : 50,
            desirability: scenario?.desirability !== undefined ? Number(scenario.desirability) : 50,
            baseScenarioId: scenario?.baseScenarioId || ''
        });
    }, [scenarioId, scenario]);

    const handleChange = (field, value) => {
        setForm(f => ({ ...f, [field]: value }));
    };

    const handleSave = () => {
        if (scenario) {
            dispatch(updateScenario({ scenarioId: scenario.id, updates: { ...form } }));
        }
        onClose?.();
    };

    const handleCancel = () => {
        if (isNew && scenario) {
            dispatch(deleteScenario(scenario.id));
        }
        onClose?.();
    };

    // Delete dialog mode
    if (mode === 'delete') {
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

    // Edit/add dialog mode
    return (
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
            </DialogActions>
        </Dialog>
    );

    // Move helpers inside component so they have access to scenario, dispatch, onClose
    function collectDescendants(id, allScenarios) {
        let ids = [id];
        allScenarios.forEach(s => {
            if (s.baseScenarioId === id) {
                ids = ids.concat(collectDescendants(s.id, allScenarios));
            }
        });
        return ids;
    }

    function handleDeleteConfirmed() {
        if (scenario) {
            dispatch(deleteScenario(scenario.id));
            onClose?.();
        }
    }
}

export default ScenarioDialog;

