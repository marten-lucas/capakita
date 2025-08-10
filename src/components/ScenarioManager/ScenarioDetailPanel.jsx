import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, TextField, Slider, Accordion, AccordionSummary, AccordionDetails, List, ListItemButton, ListItemText, Collapse, IconButton } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useSelector, useDispatch } from 'react-redux';
import { updateScenario } from '../../store/simScenarioSlice';

// Recursive component for rendering individual scenarios in the tree
function ScenarioTreeItem({ scenario, selectedId, onSelect, expandedMap, setExpandedMap, level = 0, disabledIds = [] }) {
    const hasChildren = scenario.children && scenario.children.length > 0;
    const expanded = expandedMap[scenario.id] ?? true;
    const isSelected = selectedId === scenario.id;
    const isDisabled = disabledIds.includes(scenario.id);

    return (
        <React.Fragment>
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
        </React.Fragment>
    );
}

function ScenarioDetailPanel({ scenario }) {
    const dispatch = useDispatch();
    const scenarios = useSelector(state => state.simScenario.scenarios);

    const [form, setForm] = useState(() => ({
        name: scenario?.name || '',
        remark: scenario?.remark || '',
        confidence: scenario?.confidence !== undefined ? Number(scenario.confidence) : 50,
        likelihood: scenario?.likelihood !== undefined ? Number(scenario.likelihood) : 50,
        desirability: scenario?.desirability !== undefined ? Number(scenario.desirability) : 50,
        baseScenarioId: scenario?.baseScenarioId || ''
    }));

    // Track last committed values for sliders to avoid unnecessary dispatches
    const lastCommitted = useRef({
        confidence: form.confidence,
        likelihood: form.likelihood,
        desirability: form.desirability,
    });

    useEffect(() => {
        setForm({
            name: scenario?.name || '',
            remark: scenario?.remark || '',
            confidence: scenario?.confidence !== undefined ? Number(scenario.confidence) : 50,
            likelihood: scenario?.likelihood !== undefined ? Number(scenario.likelihood) : 50,
            desirability: scenario?.desirability !== undefined ? Number(scenario.desirability) : 50,
            baseScenarioId: scenario?.baseScenarioId || ''
        });
        lastCommitted.current = {
            confidence: scenario?.confidence !== undefined ? Number(scenario.confidence) : 50,
            likelihood: scenario?.likelihood !== undefined ? Number(scenario.likelihood) : 50,
            desirability: scenario?.desirability !== undefined ? Number(scenario.desirability) : 50,
        };
    }, [scenario]);

    // Only save onBlur for text fields
    const handleTextChange = (field, value) => {
        setForm(f => ({ ...f, [field]: value }));
    };
    const handleTextBlur = (field) => {
        if (scenario && form[field] !== scenario[field]) {
            dispatch(updateScenario({ scenarioId: scenario.id, updates: { [field]: form[field] } }));
        }
    };

    // Only save on slider commit
    const handleSliderChange = (field, value) => {
        setForm(f => ({ ...f, [field]: value }));
    };
    const handleSliderCommit = (field, value) => {
        if (scenario && value !== lastCommitted.current[field]) {
            dispatch(updateScenario({ scenarioId: scenario.id, updates: { [field]: value } }));
            lastCommitted.current[field] = value;
        }
    };

    // Save baseScenarioId immediately on change
    const handleBaseScenarioChange = (value) => {
        setForm(f => ({ ...f, baseScenarioId: value }));
        if (scenario && value !== scenario.baseScenarioId) {
            dispatch(updateScenario({ scenarioId: scenario.id, updates: { baseScenarioId: value } }));
        }
    };

    // Build scenario tree for nested list, excluding the current scenario itself
    const scenarioTree = React.useMemo(() => {
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
    const [treeExpandedMap, setTreeExpandedMap] = useState({});
    const [baseScenarioAccordionOpen, setBaseScenarioAccordionOpen] = useState(false);


    // Helper to collect all descendant ids (including self)
    const collectDescendantIds = React.useCallback((id, allScenarios) => {
        const map = {};
        allScenarios.forEach(s => { map[s.id] = { ...s, children: [] }; });
        allScenarios.forEach(s => {
            if (s.baseScenarioId && map[s.baseScenarioId]) {
                map[s.baseScenarioId].children.push(map[s.id]);
            }
        });
        const descendants = [];
        function walk(nodeId) {
            descendants.push(nodeId);
            const node = map[nodeId];
            if (node && node.children) {
                node.children.forEach(child => walk(child.id));
            }
        }
        walk(id);
        return descendants;
    }, []);

    // Compute disabled ids for base scenario selection (self + all descendants)
    const disabledBaseIds = React.useMemo(() => {
        if (!scenario) return [];
        return collectDescendantIds(scenario.id, scenarios);
    }, [scenario, scenarios, collectDescendantIds]);

    // Nested scenario selection for base scenario

    if (!scenario) {
        return <Typography color="text.secondary">Kein Szenario ausgewählt.</Typography>;
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
                label="Szenarioname"
                value={form.name}
                onChange={e => handleTextChange('name', e.target.value)}
                onBlur={() => handleTextBlur('name')}
                fullWidth
                autoFocus
                size="small"
            />
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
            <TextField
                label="Bemerkung"
                value={form.remark}
                onChange={e => handleTextChange('remark', e.target.value)}
                onBlur={() => handleTextBlur('remark')}
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
                    onChange={(_, val) => handleSliderChange('likelihood', val)}
                    onChangeCommitted={(_, val) => handleSliderCommit('likelihood', val)}
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
                    onChange={(_, val) => handleSliderChange('desirability', val)}
                    onChangeCommitted={(_, val) => handleSliderCommit('desirability', val)}
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
                    onChange={(_, val) => handleSliderChange('confidence', val)}
                    onChangeCommitted={(_, val) => handleSliderCommit('confidence', val)}
                    sx={{ mt: 0, mb: 1 }}
                />
            </Box>
            {/* No save or delete button */}
        </Box>
    );
}

export default ScenarioDetailPanel;
