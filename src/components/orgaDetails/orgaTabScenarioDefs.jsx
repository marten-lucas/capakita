import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  IconButton,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItemButton,
  ListItemText,
  Collapse,
  Slider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useSelector, useDispatch } from 'react-redux';
import TabbedListDetail from '../common/TabbedListDetail';
import { addScenario, updateScenario, deleteScenario, setSelectedScenarioId } from '../../store/simScenarioSlice';
import { getDescendantScenarioIds } from '../../utils/overlayUtils';

// Recursive tree for base scenario selection
function ScenarioTreeItem({ scenario, selectedId, onSelect, expandedMap, setExpandedMap, level = 0, disabledIds = [] }) {
  const hasChildren = scenario.children && scenario.children.length > 0;
  const expanded = expandedMap[scenario.id] ?? true;
  const isSelected = selectedId === scenario.id;
  const isDisabled = disabledIds.includes(scenario.id);

  return (
    <>
      <ListItemButton
        selected={isSelected}
        disabled={isDisabled}
        onClick={() => !isDisabled && onSelect(scenario)}
        sx={{ pl: 2 + level * 2, opacity: isDisabled ? 0.5 : 1 }}
      >
        {hasChildren && (
          <IconButton
            size="small"
            onClick={e => {
              e.stopPropagation();
              setExpandedMap(map => ({ ...map, [scenario.id]: !expanded }));
            }}
            sx={{ mr: 1 }}
            disabled={isDisabled}
          >
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        )}
        {!hasChildren && <Box sx={{ width: 32, display: 'inline-block' }} />}
        <ListItemText primary={scenario.name} />
      </ListItemButton>
      {hasChildren && (
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          {scenario.children.map(child => (
            <ScenarioTreeItem
              key={child.id}
              scenario={child}
              selectedId={selectedId}
              onSelect={onSelect}
              expandedMap={expandedMap}
              setExpandedMap={setExpandedMap}
              level={level + 1}
              disabledIds={disabledIds}
            />
          ))}
        </Collapse>
      )}
    </>
  );
}

function ScenarioDetail({ item: scenario }) {
  const dispatch = useDispatch();
  const scenarios = useSelector(state => state.simScenario.scenarios);

  const [form, setForm] = React.useState(() => ({
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
  }, [scenario]);

  // Save onBlur for text fields
  const handleTextChange = (field, value) => {
    setForm(f => ({ ...f, [field]: value }));
  };
  const handleTextBlur = (field) => {
    if (scenario && form[field] !== scenario[field]) {
      dispatch(updateScenario({ scenarioId: scenario.id, updates: { [field]: form[field] } }));
    }
  };

  // Save on slider commit
  const handleSliderChange = (field, value) => {
    setForm(f => ({ ...f, [field]: value }));
  };
  const handleSliderCommit = (field, value) => {
    if (scenario && value !== scenario[field]) {
      dispatch(updateScenario({ scenarioId: scenario.id, updates: { [field]: value } }));
    }
  };

  // Save baseScenarioId immediately
  const handleBaseScenarioChange = (value) => {
    setForm(f => ({ ...f, baseScenarioId: value }));
    if (scenario && value !== scenario.baseScenarioId) {
      dispatch(updateScenario({ scenarioId: scenario.id, updates: { baseScenarioId: value } }));
    }
  };

  // Build scenario tree for base scenario selection, excluding current scenario
  const scenarioTree = useMemo(() => {
    if (!scenario) return [];
    const filtered = scenarios.filter(s => s.id !== scenario.id);
    const map = {};
    filtered.forEach(s => { map[s.id] = { ...s, children: [] }; });
    const roots = [];
    filtered.forEach(s => {
      if (s.baseScenarioId && map[s.baseScenarioId]) {
        map[s.baseScenarioId].children.push(map[s.id]);
      } else {
        roots.push(map[s.id]);
      }
    });
    return roots;
  }, [scenarios, scenario]);

  // Compute disabled ids for base scenario selection (self + all descendants)
  const disabledBaseIds = React.useMemo(() => {
    if (!scenario) return [];
    return getDescendantScenarioIds(scenario.id, scenarios);
  }, [scenario, scenarios]);

  const [treeExpandedMap, setTreeExpandedMap] = React.useState({});
  const [baseScenarioAccordionOpen, setBaseScenarioAccordionOpen] = React.useState(false);

  if (!scenario) {
    return <Typography color="text.secondary">Kein Szenario ausgewählt.</Typography>;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>Name</Typography>
        <TextField
          value={form.name}
          onChange={e => handleTextChange('name', e.target.value)}
          onBlur={() => handleTextBlur('name')}
          fullWidth
          autoFocus
          size="small"
        />
      </Box>
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
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
              <ListItemButton
                selected={!form.baseScenarioId}
                onClick={() => handleBaseScenarioChange('')}
                sx={{ pl: 4 }}
              >
                <ListItemText primary="Keines" />
              </ListItemButton>
              {scenarioTree.map(scenario => (
                <ScenarioTreeItem
                  key={scenario.id}
                  scenario={scenario}
                  selectedId={form.baseScenarioId}
                  onSelect={selected => handleBaseScenarioChange(selected.id)}
                  expandedMap={treeExpandedMap}
                  setExpandedMap={setTreeExpandedMap}
                  disabledIds={disabledBaseIds}
                />
              ))}
            </List>
          </AccordionDetails>
        </Accordion>
      </Box>
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>Bemerkung</Typography>
        <TextField
          value={form.remark}
          onChange={e => handleTextChange('remark', e.target.value)}
          onBlur={() => handleTextBlur('remark')}
          fullWidth
          multiline
          minRows={4}
          maxRows={8}
          size="small"
        />
      </Box>
      <Box>
        <Typography variant="body2"  sx={{ fontWeight: 700, mb: 0.5 }}>Wahrscheinlichkeit: {form.likelihood}%</Typography>
        <Slider
          value={Number(form.likelihood)}
          min={0}
          max={100}
          step={1}
          valueLabelDisplay="auto"
          onChange={(_, val) => handleSliderChange('likelihood', val)}
          onChangeCommitted={(_, val) => handleSliderCommit('likelihood', val)}
          sx={{ mt: 0, mb: 1 }}
        />
      </Box>
      <Box>
        <Typography variant="body2"  sx={{ fontWeight: 700, mb: 0.5 }}>Gewünschtheit: {form.desirability}%</Typography>
        <Slider
          value={Number(form.desirability)}
          min={0}
          max={100}
          step={1}
          valueLabelDisplay="auto"
          onChange={(_, val) => handleSliderChange('desirability', val)}
          onChangeCommitted={(_, val) => handleSliderCommit('desirability', val)}
          sx={{ mt: 0, mb: 1 }}
        />
      </Box>
      <Box>
        <Typography sx={{ fontWeight: 700, mb: 0.5 }} variant="body2" >Belastbarkeit: {form.confidence}%</Typography>
        <Slider
          value={Number(form.confidence)}
          min={0}
          max={100}
          step={1}
          valueLabelDisplay="auto"
          onChange={(_, val) => handleSliderChange('confidence', val)}
          onChangeCommitted={(_, val) => handleSliderCommit('confidence', val)}
          sx={{ mt: 0, mb: 1 }}
        />
      </Box>
    </Box>
  );
}

// Helper to flatten scenario tree and annotate with level
function flattenScenarioTree(scenarios) {
  const map = {};
  scenarios.forEach(s => { map[s.id] = { ...s, children: [] }; });
  scenarios.forEach(s => {
    if (s.baseScenarioId && map[s.baseScenarioId]) {
      map[s.baseScenarioId].children.push(map[s.id]);
    }
  });
  const roots = scenarios.filter(s => !s.baseScenarioId).map(s => map[s.id]);
  const result = [];
  function walk(node, level) {
    result.push({ ...node, _level: level });
    if (Array.isArray(node.children)) {
      node.children.forEach(child => walk(child, level + 1));
    }
  }
  roots.forEach(root => walk(root, 0));
  return result;
}

function OrgaTabScenarioDefs() {
  const dispatch = useDispatch();
  const scenarios = useSelector(state => state.simScenario.scenarios);

  // State for delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [scenarioToDelete, setScenarioToDelete] = React.useState(null);

  // Flattened scenario list with levels
  const scenarioItems = React.useMemo(() => flattenScenarioTree(scenarios), [scenarios]);

  // TabbedListDetail props
  const ItemTitle = item => item.name || 'Szenario';
  const ItemSubTitle = item => item.remark || '';
  const ItemChips = () => null;
  const ItemAvatar = () => null;
  const ItemHoverIcons = item => [
    {
      icon: <AddIcon fontSize="small" />,
      title: 'Unter-Szenario hinzufügen',
      onClick: () => {
        dispatch(addScenario({
          name: 'Neues Szenario',
          baseScenarioId: item.id,
          makeNameUnique: true
        }));
        setTimeout(() => {
          const allScenarios = [...(window.store?.getState().simScenario.scenarios || scenarios)];
          const lastScenario = allScenarios[allScenarios.length - 1];
          if (lastScenario) {
            dispatch(setSelectedScenarioId(lastScenario.id));
          }
        }, 0);
      }
    },
    {
      icon: <DeleteIcon fontSize="small" />,
      title: 'Löschen',
      onClick: () => {
        setScenarioToDelete(item);
        setDeleteDialogOpen(true);
      }
    }
  ];
  const ItemAddButton = {
    label: 'Neues Szenario',
    icon: <AddIcon />,
    onClick: () => {
      dispatch(addScenario({ name: 'Neues Szenario', baseScenarioId: null, makeNameUnique: true }));
      setTimeout(() => {
        const allScenarios = [...(window.store?.getState().simScenario.scenarios || scenarios)];
        const lastScenario = allScenarios[allScenarios.length - 1];
        if (lastScenario) {
          dispatch(setSelectedScenarioId(lastScenario.id));
        }
      }, 0);
    },
    title: 'Szenarien'
  };

  // Confirm delete handler
  const handleConfirmDelete = () => {
    if (scenarioToDelete) {
      dispatch(deleteScenario(scenarioToDelete.id));
    }
    setDeleteDialogOpen(false);
    setScenarioToDelete(null);
  };

  // Cancel delete handler
  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setScenarioToDelete(null);
  };

  return (
    <>
      <TabbedListDetail
        items={scenarioItems}
        ItemTitle={ItemTitle}
        ItemSubTitle={ItemSubTitle}
        ItemChips={ItemChips}
        ItemAvatar={ItemAvatar}
        ItemHoverIcons={ItemHoverIcons}
        ItemAddButton={ItemAddButton}
        Detail={ScenarioDetail}
        emptyText="Keine Szenarien vorhanden."
        getLevel={item => item._level || 0}
      />
      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete}>
        <DialogTitle>Szenario löschen</DialogTitle>
        <DialogContent>
          <Typography>
            Dieses Szenario <b>{scenarioToDelete?.name}</b> und alle abhängigen Szenarien werden gelöscht.<br />
            Dies wird Ihre Szenarienliste aufräumen und kann nicht rückgängig gemacht werden.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete}>Abbrechen</Button>
          <Button variant="contained" color="error" onClick={handleConfirmDelete}>
            Szenario löschen
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default OrgaTabScenarioDefs;