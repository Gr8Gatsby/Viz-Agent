import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { createCanvas } from 'canvas'; // Use node-canvas for offscreen rendering
import { ParsedCsvData } from './types'; // Define types later

// Register necessary Chart.js components
Chart.register(...registerables);

const CHART_WIDTH = 800;
const CHART_HEIGHT = 600;

// Define expected input structure (can be refined)
interface ChartOptions {
  title?: string;
  labelColumn: string; // Header for labels (e.g., 'name_x')
  dataColumns: string[]; // Header(s) for data (e.g., ['num_parts_sum'])
  // Add more options as needed (colors, axes labels etc.)
}

/**
 * Creates a chart image as a base64 PNG string.
 */
export async function createChartImage(
  parsedData: ParsedCsvData,
  chartType: 'bar' | 'line' | 'pie', // Extend with more types later
  options: ChartOptions
): Promise<string> {
  if (!parsedData || !parsedData.data || parsedData.data.length === 0) {
    throw new Error('No data provided for chart generation.');
  }
  if (!options.labelColumn || !options.dataColumns || options.dataColumns.length === 0) {
    throw new Error('Label and data columns must be specified in options.');
  }
  if (!parsedData.headers.includes(options.labelColumn)) {
    throw new Error(`Label column '${options.labelColumn}' not found in data headers.`);
  }
  for (const dataCol of options.dataColumns) {
    if (!parsedData.headers.includes(dataCol)) {
      throw new Error(`Data column '${dataCol}' not found in data headers.`);
    }
  }

  const canvas = createCanvas(CHART_WIDTH, CHART_HEIGHT);
  const ctx = canvas.getContext('2d');

  const labels = parsedData.data.map((row: { [key: string]: any }) => row[options.labelColumn]);
  const datasets = options.dataColumns.map((dataCol) => ({
    label: dataCol, // Use header name as dataset label
    data: parsedData.data.map((row: { [key: string]: any }) => row[dataCol]),
    // Add basic styling or allow customization via options later
    // backgroundColor: 'rgba(75, 192, 192, 0.6)', 
    // borderColor: 'rgba(75, 192, 192, 1)',
    // borderWidth: 1
  }));

  const configuration: ChartConfiguration = {
    type: chartType,
    data: {
      labels: labels,
      datasets: datasets,
    },
    options: {
      responsive: false, // Important for node-canvas
      animation: false, // Important for node-canvas
      plugins: {
        title: {
          display: !!options.title,
          text: options.title,
        },
      },
      // Add more Chart.js options as needed
    },
  };

  new Chart(ctx as any, configuration); // Create the chart

  // Wait for potential async rendering/drawing if necessary (usually not for node-canvas)
  // await new Promise(resolve => setTimeout(resolve, 50)); 

  return canvas.toDataURL('image/png'); // Return as base64 PNG
} 