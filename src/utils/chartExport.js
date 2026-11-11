function getChartSvg(chart) {
  if (!chart) throw new Error('Das Diagramm ist noch nicht bereit.');
  const svgNode = chart.container?.querySelector('svg');
  const svg = typeof chart.getSVG === 'function' ? chart.getSVG() : svgNode?.outerHTML;
  if (!svg) throw new Error('Das Sankey-SVG konnte nicht erstellt werden.');
  return {
    svg,
    width: Number(chart.chartWidth || svgNode?.getAttribute('width')) || 1200,
    height: Number(chart.chartHeight || svgNode?.getAttribute('height')) || 700,
  };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderSvgToCanvas(svg, width, height, scale = 2) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const image = new Image();
    const cleanup = () => URL.revokeObjectURL(objectUrl);
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        cleanup();
        reject(new Error('Canvas-Kontext nicht verfügbar.'));
        return;
      }
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      cleanup();
      resolve(canvas);
    };
    image.onerror = () => {
      cleanup();
      reject(new Error('Das Sankey konnte nicht gerendert werden.'));
    };
    image.src = objectUrl;
  });
}

export async function exportChart(chart, format, filenameBase) {
  const { svg, width, height } = getChartSvg(chart);
  const extension = String(format || '').toLowerCase();
  if (extension === 'svg') {
    downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${filenameBase}.svg`);
    return;
  }

  const canvas = await renderSvgToCanvas(svg, width, height, 2);
  if (extension === 'png') {
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error('PNG-Datei konnte nicht erstellt werden.'));
      }, 'image/png');
    });
    downloadBlob(blob, `${filenameBase}.png`);
    return;
  }

  if (extension === 'pdf') {
    const { jsPDF } = await import('jspdf');
    const margin = 18;
    const pageWidth = Math.max(320, width + margin * 2);
    const pageHeight = Math.max(240, height + margin * 2);
    const pdf = new jsPDF({ orientation: pageWidth >= pageHeight ? 'landscape' : 'portrait', unit: 'pt', format: [pageWidth, pageHeight] });
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, margin, width, height);
    pdf.save(`${filenameBase}.pdf`);
    return;
  }

  throw new Error(`Nicht unterstütztes Exportformat: ${format}`);
}
