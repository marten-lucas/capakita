import React from 'react';
import { Box, Button } from '@mantine/core';
import { IconCheck, IconCopy } from '@tabler/icons-react';
import HighchartsReact from 'highcharts-react-official';

async function writeText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the selection-based clipboard API for restricted contexts.
    }
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } finally {
    textarea.remove();
  }
  if (!copied) throw new Error('Clipboard nicht verfügbar');
}

function rasterizeSvg(svg, width, height) {
  return new Promise((resolve, reject) => {
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const objectUrl = URL.createObjectURL(svgBlob);
    const image = new Image();
    image.onload = () => {
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Canvas-Kontext nicht verfügbar'));
        return;
      }
      context.scale(scale, scale);
      context.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('PNG konnte nicht erstellt werden'));
      }, 'image/png');
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Diagramm konnte nicht gerendert werden'));
    };
    image.src = objectUrl;
  });
}

async function copySvgImage(svg, width, height) {
  if (!svg) throw new Error('Grafik-SVG nicht gefunden');
  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    try {
      const png = await rasterizeSvg(svg, width, height);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      return 'Grafik kopiert';
    } catch {
      // Some browsers allow text clipboard access but reject image clipboard writes.
    }
  }
  await writeText(svg);
  return 'SVG kopiert';
}

async function copyChartImage(chart) {
  if (!chart) throw new Error('Diagramm ist noch nicht bereit');
  const svgNode = chart.container?.querySelector('svg');
  const svg = typeof chart.getSVG === 'function' ? chart.getSVG() : svgNode?.outerHTML;
  const width = Number(chart.chartWidth || svgNode?.getAttribute('width')) || 1200;
  const height = Number(chart.chartHeight || svgNode?.getAttribute('height')) || 700;
  return copySvgImage(svg, width, height);
}

async function copySvgElement(element) {
  const svgNode = element?.matches?.('svg') ? element : element?.querySelector?.('svg');
  if (!svgNode) throw new Error('Grafik-SVG nicht gefunden');
  const bounds = svgNode.getBoundingClientRect();
  const width = Number(svgNode.getAttribute('width')) || bounds.width || 600;
  const height = Number(svgNode.getAttribute('height')) || bounds.height || 400;
  return copySvgImage(svgNode.outerHTML, width, height);
}

function tableToTsv(table) {
  return Array.from(table?.rows || []).map((row) => (
    Array.from(row.cells || []).map((cell) => {
      const copy = cell.cloneNode(true);
      copy.querySelectorAll('button, svg, [aria-hidden="true"]').forEach((element) => element.remove());
      return String(copy.innerText || copy.textContent || '')
        .replace(/[\t\r\n]+/g, ' ')
        .trim();
    }).join('\t')
  )).join('\n');
}

export function ClipboardButton({ onCopy, label = 'In Zwischenablage kopieren', testId, className, style }) {
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState(false);
  const timeoutRef = React.useRef(null);

  React.useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  const handleCopy = async () => {
    try {
      await onCopy();
      setCopied(true);
      setError(false);
    } catch {
      setCopied(false);
      setError(true);
    }
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setCopied(false);
      setError(false);
    }, 1800);
  };

  return (
    <Button
      type="button"
      size="xs"
      variant="white"
      color={error ? 'red' : 'gray'}
      leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
      onClick={handleCopy}
      title={error ? 'Kopieren fehlgeschlagen' : label}
      aria-label={error ? 'Kopieren fehlgeschlagen' : label}
      data-testid={testId}
      className={className}
      style={style}
    >
      {error ? 'Fehler' : copied ? 'Kopiert' : 'Kopieren'}
    </Button>
  );
}

export function CopySvgButton({ svgRef, testId = 'copy-svg-button' }) {
  return (
    <ClipboardButton
      label="Grafik als Bild kopieren"
      testId={testId}
      onCopy={() => copySvgElement(svgRef?.current)}
    />
  );
}

export function CopyTableButton({ tableRef, testId = 'copy-table-button' }) {
  return (
    <ClipboardButton
      label="Tabellendaten kopieren"
      testId={testId}
      onCopy={() => writeText(tableToTsv(tableRef?.current))}
    />
  );
}

export function CopyableHighcharts({ callback, containerProps, ...chartProps }) {
  const chartRef = React.useRef(null);
  const handleChartReady = React.useCallback((chart) => {
    chartRef.current = chart;
    callback?.(chart);
  }, [callback]);

  return (
    <Box style={{ position: 'relative', width: '100%', height: '100%' }}>
      <HighchartsReact
        {...chartProps}
        callback={handleChartReady}
        containerProps={{ ...containerProps, style: { width: '100%', height: '100%', ...(containerProps?.style || {}) } }}
      />
      <ClipboardButton
        label="Diagramm als Bild kopieren"
        testId="copy-chart-button"
        onCopy={() => copyChartImage(chartRef.current)}
        style={{ position: 'absolute', zIndex: 5, top: 6, right: 6 }}
      />
    </Box>
  );
}
