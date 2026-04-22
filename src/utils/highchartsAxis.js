export function createColoredYAxis({ title, color, ...rest }) {
  return {
    ...rest,
    title: {
      text: title,
      style: {
        color,
      },
    },
    labels: {
      ...(rest.labels || {}),
      style: {
        color,
        ...(rest.labels?.style || {}),
      },
    },
    tickColor: color,
    lineColor: color,
    minorTickColor: color,
  };
}