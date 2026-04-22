import React from 'react';
import { Alert, Button, Group, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

class ChartErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
    this.handleRetry = this.handleRetry.bind(this);
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    if (typeof this.props.onError === 'function') {
      this.props.onError(error, info);
    }
  }

  handleRetry() {
    this.setState({ hasError: false });
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light">
          <Group justify="space-between" align="center" wrap="nowrap">
            <Text size="sm">Das Diagramm konnte nicht gerendert werden.</Text>
            <Button size="xs" variant="light" color="red" onClick={this.handleRetry}>
              Erneut versuchen
            </Button>
          </Group>
        </Alert>
      );
    }

    return this.props.children;
  }
}

export default ChartErrorBoundary;