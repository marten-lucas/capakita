import React, { useMemo } from 'react';
import Box from '@mui/material/Box';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import { useSelector, useDispatch } from 'react-redux';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { setSelectedScenarioId } from '../../store/simScenarioSlice';

// Helper to build scenario tree structure
function buildScenarioTree(scenarios) {
    const map = {};
    scenarios.forEach(s => { map[s.id] = { ...s, children: [] }; });
    scenarios.forEach(s => {
        if (s.baseScenarioId && map[s.baseScenarioId]) {
            map[s.baseScenarioId].children.push(map[s.id]);
        }
    });
    // Only return root nodes (no baseScenarioId)
    return scenarios.filter(s => !s.baseScenarioId).map(s => map[s.id]);
}

// Helper to collect all ids that should be expanded (all parents with children)
function collectExpandedIds(nodes) {
    const expanded = [];
    function walk(node) {
        if (node.children && node.children.length > 0) {
            expanded.push(node.id);
            node.children.forEach(walk);
        }
    }
    nodes.forEach(walk);
    return expanded;
}

function ScenarioTree({ onEdit, onAdd, onDelete }) {
    const dispatch = useDispatch();
    const scenarios = useSelector(state => state.simScenario.scenarios);
    const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);

    const treeData = useMemo(() => buildScenarioTree(scenarios), [scenarios]);
    const expandedIds = useMemo(() => collectExpandedIds(treeData), [treeData]);

    // Ensure selection works on click of any tree item label
    const handleNodeClick = (id) => {
        if (id && id !== selectedScenarioId) {
            dispatch(setSelectedScenarioId(id));
        }
    };

    // Render TreeItems recursively
    const renderTree = (node) => (
        <TreeItem
            key={node.id}
            itemId={node.id}
            label={
                <Box
                    sx={{ display: 'flex', alignItems: 'center', minWidth: 0, width: '100%' }}
                    onClick={() => handleNodeClick(node.id)}
                >
                    <Typography
                        component="span"
                        sx={{
                            color: selectedScenarioId === node.id ? 'primary.main' : 'text.primary',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            flex: 1,
                            fontSize: '0.95rem',
                            fontWeight: selectedScenarioId === node.id ? 700 : undefined,
                            bgcolor: selectedScenarioId === node.id ? 'action.selected' : undefined,
                            borderRadius: 1,
                            px: selectedScenarioId === node.id ? 1 : 0
                        }}
                    >
                        {node.name}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1 }}>
                        <IconButton
                            size="small"
                            aria-label="edit"
                            onClick={e => {
                                e.stopPropagation();
                                onEdit?.(node);
                            }}
                            sx={{ width: 28, height: 28 }}
                        >
                            <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                            size="small"
                            aria-label="add"
                            onClick={e => {
                                e.stopPropagation();
                                onAdd?.(node);
                            }}
                            sx={{ width: 28, height: 28 }}
                        >
                            <AddIcon fontSize="small" />
                        </IconButton>
                        {onDelete && (
                            <IconButton
                                size="small"
                                aria-label="delete"
                                onClick={e => {
                                    e.stopPropagation();
                                    onDelete?.(node);
                                }}
                                sx={{ width: 28, height: 28 }}
                            >
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        )}
                    </Box>
                </Box>
            }
        >
            {Array.isArray(node.children) && node.children.map(child => renderTree(child))}
        </TreeItem>
    );

    return (
        <Box sx={{ minHeight: 200, minWidth: 200 }}>
            <SimpleTreeView
                selectedItems={selectedScenarioId ? [selectedScenarioId] : []}
                expandedItems={expandedIds}
                // Remove onSelectedItemsChange, rely on label click for selection
            >
                {treeData.map(node => renderTree(node))}
            </SimpleTreeView>
        </Box>
    );
}

export default ScenarioTree;
