import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Paper, Button, IconButton, TextField, Slider, Stack,
  MenuItem, Select, InputLabel, FormControl, List, ListItemButton, ListItemText, Collapse
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
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

function ScenarioTreeList({ scenarioTree, selectedId, onSelect, level = 0, expandedMap, setExpandedMap }) {
  return scenarioTree.map(scenario => {
    const hasChildren = scenario.children && scenario.children.length > 0;
    const expanded = expandedMap[scenario.id] ?? true;
    return (
      <React.Fragment key={scenario.id}>
        <ListItemButton
          selected={selectedId === scenario.id}
          onClick={() => onSelect(scenario)}
          sx={{ pl: 2 + level * 2, bgcolor: selectedId === scenario.id ? 'action.selected' : undefined }}
        >
          {hasChildren && (
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
          {!hasChildren && <Box sx={{ width: 32, display: 'inline-block' }} />}
          <ListItemText
            primary={scenario.name}
            secondary={scenario.remark}
            sx={{ flex: 1 }}
          />
          {/* Removed Edit and Delete buttons from the list */}
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
            />
          </Collapse>
        )}
      </React.Fragment>
    );
  });
}

function ScenarioDetailForm({ scenarioId, scenarios, onCancel }) {
  const {
    getScenarioById,
    updateScenario,
    deleteScenario,
  } = useSimScenarioStore();

  const scenario = scenarioId ? getScenarioById(scenarioId) : null;

  const [form, setForm] = useState(() => ({
    name: scenario?.name || '',
    remark: scenario?.remark || '',
    confidence: scenario?.confidence !== undefined ? Number(scenario.confidence) : 50,
    likelihood: scenario?.likelihood !== undefined ? Number(scenario.likelihood) : 50,
    baseScenarioId: scenario?.baseScenarioId || ''
  }));

  // Keep form in sync with store if scenario changes
  React.useEffect(() => {
    setForm({
      name: scenario?.name || '',
      remark: scenario?.remark || '',
      confidence: scenario?.confidence !== undefined ? Number(scenario.confidence) : 50,
      likelihood: scenario?.likelihood !== undefined ? Number(scenario.likelihood) : 50,
      baseScenarioId: scenario?.baseScenarioId || ''
    });
  }, [scenarioId, scenario]);

  // Prevent circular references in base scenario selection
  const getAvailableBaseScenarios = () => {
    if (!scenario) return scenarios;
    const excludeIds = new Set();
    function collectDescendants(s) {
      excludeIds.add(s.id);
      scenarios.filter(child => child.baseScenarioId === s.id).forEach(collectDescendants);
    }
    collectDescendants(scenario);
    return scenarios.filter(s => !excludeIds.has(s.id));
  };

  const handleChange = (field, value) => {
    setForm(f => ({ ...f, [field]: value }));
    if (scenario) {
      updateScenario(scenario.id, { ...form, [field]: value });
    }
  };

  const handleDeleteScenario = () => {
    if (!scenario) return;
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
    const idsToDelete = collectDescendants(scenario.id, scenarios);
    if (
      window.confirm(
        `Szenario "${form.name}" und alle darauf basierenden Szenarien (${idsToDelete.length - 1} weitere) wirklich löschen?`
      )
    ) {
      idsToDelete.forEach(id => deleteScenario(id));
      onCancel?.();
    }
  };

  if (!scenario) {
    return (
      <Box sx={{ p: 4, color: 'text.secondary', textAlign: 'center' }}>
        <Typography>Wählen Sie ein Szenario aus oder fügen Sie eines hinzu.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4, maxWidth: 600, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
      <TextField
        label="Szenarioname"
        value={form.name}
        onChange={e => handleChange('name', e.target.value)}
        fullWidth
        autoFocus
        size="small"
      />
      <FormControl fullWidth size="small">
        <InputLabel id="base-scenario-label">Basis-Szenario</InputLabel>
        <Select
          labelId="base-scenario-label"
          label="Basis-Szenario"
          value={form.baseScenarioId || ''}
          onChange={e => handleChange('baseScenarioId', e.target.value || null)}
        >
          <MenuItem value="">Keines</MenuItem>
          {getAvailableBaseScenarios().map(s => (
            <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
          ))}
        </Select>
      </FormControl>
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
        <Typography gutterBottom>Likelihood: {form.likelihood}%</Typography>
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
        <Typography gutterBottom>Confidence: {form.confidence}%</Typography>
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
      <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
        <Button
          variant="outlined"
          color="error"
          onClick={handleDeleteScenario}
        >
          Löschen
        </Button>
      </Box>
    </Box>
  );
}

function ScenarioPage() {
  const { scenarios, addScenario } = useSimScenarioStore();
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [expandedMap, setExpandedMap] = useState({});

  // Build the scenario tree
  const scenarioTree = useMemo(() => buildScenarioTree(scenarios), [scenarios]);

  const handleAddScenario = () => {
    const newScenario = {
      name: 'Neues Szenario',
      remark: '',
      confidence: 50,
      likelihood: 50,
      baseScenarioId: selectedScenario?.id || null // Use selected scenario as base
    };
    addScenario(newScenario);
  };

  const handleSelect = (scenario) => {
    setSelectedScenario(scenario);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f0f2f5' }}>
      {/* Left: Tree/List */}
      <Box sx={{
        width: 340,
        minWidth: 260,
        maxWidth: 400,
        borderRight: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        maxHeight: '100vh'
      }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">Szenarien</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddScenario}
            size="small"
          >
            Hinzufügen
          </Button>
        </Box>
        <List sx={{ flex: 1, overflowY: 'auto', py: 0 }}>
          {scenarioTree.length === 0 ? (
            <Box sx={{ p: 3, color: 'text.secondary', textAlign: 'center' }}>
              Keine Szenarien vorhanden.
            </Box>
          ) : (
            <ScenarioTreeList
              scenarioTree={scenarioTree}
              selectedId={selectedScenario?.id}
              onSelect={handleSelect}
              expandedMap={expandedMap}
              setExpandedMap={setExpandedMap}
            />
          )}
        </List>
      </Box>
      {/* Right: Detail Form */}
      <Box sx={{ flex: 1, p: 0, display: 'flex', flexDirection: 'column', overflow: 'auto', height: '100vh', maxHeight: '100vh' }}>
        <Paper sx={{ m: 4, flex: 1, minHeight: 400, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
          <ScenarioDetailForm
            scenarioId={selectedScenario?.id}
            scenarios={scenarios}
            onCancel={() => setSelectedScenario(null)}
          />
        </Paper>
      </Box>
    </Box>
  );
}

export default ScenarioPage;
