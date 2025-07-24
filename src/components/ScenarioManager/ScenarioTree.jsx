import React, { useState, createContext, useContext, useMemo } from 'react';
import { ListItemButton, ListItemText, Box, IconButton, Typography, Collapse } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useSelector, useDispatch } from 'react-redux';
import { setSelectedScenarioId } from '../../store/simScenarioSlice';

// Context to track nesting level
const LevelContext = createContext(0);

function ScenarioTreeList({ onEdit, onAdd, onDelete }) {
    const [expandedMap, setExpandedMap] = useState({});
    const level = useContext(LevelContext);

    const dispatch = useDispatch();
    const scenarios = useSelector(state => state.simScenario.scenarios);
    const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);

    // Build scenario tree structure
    const scenarioTree = useMemo(() => {
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
    }, [scenarios]);

    // Render the tree recursively
    return (
        <>
            {scenarioTree.map(scenario => {
                const hasChildren = scenario.children && scenario.children.length > 0;
                const expanded = expandedMap[scenario.id] ?? true;
                const isSelected = selectedScenarioId === scenario.id;
                return (
                    <React.Fragment key={scenario.id}>
                        <ListItemButton
                            selected={isSelected}
                            onClick={() => {
                                dispatch(setSelectedScenarioId(scenario.id));
                            }}
                            sx={{
                                pl: 2 + level * 2,
                                bgcolor: isSelected ? 'action.selected' : undefined,
                                fontWeight: isSelected ? 700 : undefined
                            }}
                        >
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
                                <LevelContext.Provider value={level + 1}>
                                    {/* Render children recursively */}
                                    <ScenarioTreeChildren
                                        key={`children-${scenario.id}`}
                                        childrenScenarios={scenario.children}
                                        onEdit={onEdit}
                                        onAdd={onAdd}
                                        onDelete={onDelete}
                                    />
                                </LevelContext.Provider>
                            </Collapse>
                        )}
                    </React.Fragment>
                );
            })}
        </>
    );
}

// Helper for rendering children recursively, using the same logic but with a fixed scenario list
function ScenarioTreeChildren({ childrenScenarios, onEdit, onAdd, onDelete }) {
    const [expandedMap, setExpandedMap] = useState({});
    const level = useContext(LevelContext);
    const dispatch = useDispatch();
    const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);

    return (
        <>
            {childrenScenarios.map(scenario => {
                const hasChildren = scenario.children && scenario.children.length > 0;
                const expanded = expandedMap[scenario.id] ?? true;
                const isSelected = selectedScenarioId === scenario.id;
                return (
                    <React.Fragment key={scenario.id}>
                        <ListItemButton
                            selected={isSelected}
                            onClick={() => {
                                dispatch(setSelectedScenarioId(scenario.id));
                            }}
                            sx={{
                                pl: 2 + level * 2,
                                bgcolor: isSelected ? 'action.selected' : undefined,
                                fontWeight: isSelected ? 700 : undefined
                            }}
                        >
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
                                <LevelContext.Provider value={level + 1}>
                                    <ScenarioTreeChildren
                                        key={`children-${scenario.id}`}
                                        childrenScenarios={scenario.children}
                                        onEdit={onEdit}
                                        onAdd={onAdd}
                                        onDelete={onDelete}
                                    />
                                </LevelContext.Provider>
                            </Collapse>
                        )}
                    </React.Fragment>
                );
            })}
        </>
    );
}

function ScenarioTree({ onEdit, onAdd, onDelete }) {
    // Provide initial level 0 via context
    return (
        <LevelContext.Provider value={0}>
            <ScenarioTreeList
                onEdit={onEdit}
                onAdd={onAdd}
                onDelete={onDelete}
            />
        </LevelContext.Provider>
    );
}

export default ScenarioTree;
