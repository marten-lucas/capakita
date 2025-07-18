import React, { useState } from 'react';
import {
    Box, Typography, Paper, Button, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Slider, Stack,
    MenuItem,
    Select,
    InputLabel,
    FormControl
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import useSimScenarioStore from '../store/simScenarioStore';

function ScenarioPage() {
    const { scenarios, addScenario, updateScenario, deleteScenario } = useSimScenarioStore();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingScenario, setEditingScenario] = useState(null);
    const [scenarioForm, setScenarioForm] = useState({
        name: '',
        remark: '',
        confidence: 50,
        likelihood: 50,
        baseScenarioId: null
    });

    const handleOpenDialog = (scenario = null) => {
        setEditingScenario(scenario);
        setScenarioForm(scenario
            ? {
                name: scenario.name || '',
                remark: scenario.remark || '',
                confidence: scenario.confidence !== undefined ? Number(scenario.confidence) : 50,
                likelihood: scenario.likelihood !== undefined ? Number(scenario.likelihood) : 50,
                baseScenarioId: scenario.baseScenarioId || null
            }
            : { name: '', remark: '', confidence: 50, likelihood: 50, baseScenarioId: null }
        );
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setEditingScenario(null);
        setScenarioForm({ name: '', remark: '', confidence: 50, likelihood: 50, baseScenarioId: null });
    };

    const handleSave = () => {
        if (!scenarioForm.name.trim()) return;
        if (editingScenario) {
            updateScenario(editingScenario.id, {
                name: scenarioForm.name,
                remark: scenarioForm.remark,
                confidence: scenarioForm.confidence,
                likelihood: scenarioForm.likelihood,
                baseScenarioId: scenarioForm.baseScenarioId
            });
        } else {
            addScenario({
                name: scenarioForm.name,
                remark: scenarioForm.remark,
                confidence: scenarioForm.confidence,
                likelihood: scenarioForm.likelihood,
                baseScenarioId: scenarioForm.baseScenarioId
            });
        }
        handleCloseDialog();
    };

    const handleDelete = (scenario) => {
        if (window.confirm(`Szenario "${scenario.name}" wirklich löschen?`)) {
            deleteScenario(scenario.id);
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#f0f2f5' }}>
            <Box sx={{ p: 3 }}>
                <Typography variant="h4" sx={{ mb: 3 }}>Szenarien</Typography>
                <Paper sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">Alle Szenarien</Typography>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => handleOpenDialog()}
                        >
                            Szenario hinzufügen
                        </Button>
                    </Box>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Name</TableCell>
                                    <TableCell>Bemerkung</TableCell>
                                    <TableCell>Confidence</TableCell>
                                    <TableCell>Likelihood (%)</TableCell>
                                    <TableCell align="right">Aktionen</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {scenarios.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} align="center">
                                            <Typography color="text.secondary">Keine Szenarien vorhanden.</Typography>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    scenarios.map((scenario) => (
                                        <TableRow key={scenario.id}>
                                            <TableCell>{scenario.name}</TableCell>
                                            <TableCell>
                                                <Typography variant="body2" sx={{ maxWidth: 180, whiteSpace: 'pre-line', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {scenario.remark}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>{scenario.confidence}</TableCell>
                                            <TableCell>{scenario.likelihood}%</TableCell>
                                            <TableCell align="right">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleOpenDialog(scenario)}
                                                    title="Bearbeiten"
                                                >
                                                    <EditIcon />
                                                </IconButton>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleDelete(scenario)}
                                                    title="Löschen"
                                                    color="error"
                                                >
                                                    <DeleteIcon />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            </Box>
            {/* Dialog for add/edit */}
            <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="xs" fullWidth>
                <DialogTitle>
                    {editingScenario ? 'Szenario bearbeiten' : 'Neues Szenario hinzufügen'}
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            label="Szenarioname"
                            value={scenarioForm.name}
                            onChange={e => setScenarioForm(f => ({ ...f, name: e.target.value }))}
                            fullWidth
                            autoFocus
                            size="small"
                        />
                        <FormControl fullWidth size="small">
                            <InputLabel id="base-scenario-label">Basis-Szenario</InputLabel>
                            <Select
                                labelId="base-scenario-label"
                                label="Basis-Szenario"
                                value={scenarioForm.baseScenarioId || ''}
                                onChange={e => setScenarioForm(f => ({ ...f, baseScenarioId: e.target.value || null }))}
                            >
                                <MenuItem value="">Keines</MenuItem>
                                {scenarios
                                    .filter(s => !editingScenario || s.id !== editingScenario.id)
                                    .map(s => (
                                        <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                                    ))}
                            </Select>
                        </FormControl>
                        <TextField
                            label="Bemerkung"
                            value={scenarioForm.remark}
                            onChange={e => setScenarioForm(f => ({ ...f, remark: e.target.value }))}
                            fullWidth
                            multiline
                            minRows={2}
                            maxRows={4}
                            size="small"
                        />
                        <Box>
                            <Typography gutterBottom>Likelihood: {scenarioForm.likelihood}%</Typography>
                            <Slider
                                value={Number(scenarioForm.likelihood)}
                                min={0}
                                max={100}
                                step={1}
                                valueLabelDisplay="auto"
                                onChange={(_, val) => setScenarioForm(f => ({ ...f, likelihood: val }))}
                                sx={{ mt: 0, mb: 1 }}
                            />
                        </Box>
                        <Box>
                            <Typography gutterBottom>Confidence: {scenarioForm.confidence}%</Typography>
                            <Slider
                                value={Number(scenarioForm.confidence)}
                                min={0}
                                max={100}
                                step={1}
                                valueLabelDisplay="auto"
                                onChange={(_, val) => setScenarioForm(f => ({ ...f, confidence: val }))}
                                sx={{ mt: 0, mb: 1 }}
                            />
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>Abbrechen</Button>
                    <Button onClick={handleSave} variant="contained">
                        {editingScenario ? 'Speichern' : 'Hinzufügen'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default ScenarioPage;
