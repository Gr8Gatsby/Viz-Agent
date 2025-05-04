import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as Papa from 'papaparse';
import { createChartImage } from '../api/lib/charting-logic.js';
import { ParsedCsvData } from '../api/lib/types.js';

// Test setup: Load and parse data once
let parsedData: ParsedCsvData;
const outputDir = path.resolve(__dirname, '../.test-output');

describe('createChartImage', () => {
  beforeAll(() => {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 1. Read sample data
    const csvFilePath = path.resolve(__dirname, '../data/sample-parts.csv');
    const csvString = fs.readFileSync(csvFilePath, 'utf8');

    // 2. Parse data
    const parseResult = Papa.parse(csvString, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    });

    if (parseResult.errors.length > 0) {
      throw new Error(`Failed to parse sample CSV for testing: ${parseResult.errors[0].message}`);
    }

    parsedData = {
      data: parseResult.data as { [key: string]: any }[],
      headers: parseResult.meta.fields || [],
    };

    expect(parsedData.data.length).toBeGreaterThan(0);
    expect(parsedData.headers.length).toBeGreaterThan(0);
  });

  // --- Success Cases ---

  it('should generate a base64 PNG string for a simple bar chart', async () => {
    const options = {
      labelColumn: 'name_x',
      dataColumns: ['num_parts_sum'],
      title: 'Lego Set Parts Count (Bar)'
    };
    const base64Image = await createChartImage(parsedData, 'bar', options);

    expect(typeof base64Image).toBe('string');
    expect(base64Image).toMatch(/^data:image\/png;base64,/); 
    expect(base64Image.length).toBeGreaterThan(100); 

    const outputPath = path.join(outputDir, 'test-bar-chart.png');
    const base64Data = base64Image.replace(/^data:image\/png;base64,/, ""); 
    fs.writeFileSync(outputPath, base64Data, 'base64');
    console.log(`Test bar chart saved to: ${outputPath}`);
  });

  it('should generate a base64 PNG string for a simple line chart', async () => {
    const options = {
      labelColumn: 'name_x',
      dataColumns: ['num_parts_sum'],
      title: 'Lego Set Parts Count (Line)'
    };
    const base64Image = await createChartImage(parsedData, 'line', options);
    expect(base64Image).toMatch(/^data:image\/png;base64,/);
    expect(base64Image.length).toBeGreaterThan(100);
    const outputPath = path.join(outputDir, 'test-line-chart.png');
    const base64Data = base64Image.replace(/^data:image\/png;base64,/, ""); 
    fs.writeFileSync(outputPath, base64Data, 'base64');
    console.log(`Test line chart saved to: ${outputPath}`);
  });

  it('should generate a base64 PNG string for a simple pie chart', async () => {
     const options = {
      labelColumn: 'name_x',
      dataColumns: ['num_parts_sum'],
      title: 'Lego Set Parts Count (Pie)'
    };
    const base64Image = await createChartImage(parsedData, 'pie', options);
    expect(base64Image).toMatch(/^data:image\/png;base64,/);
    expect(base64Image.length).toBeGreaterThan(100);
    const outputPath = path.join(outputDir, 'test-pie-chart.png');
    const base64Data = base64Image.replace(/^data:image\/png;base64,/, ""); 
    fs.writeFileSync(outputPath, base64Data, 'base64');
    console.log(`Test pie chart saved to: ${outputPath}`);
  });

  // --- Error Handling Cases ---

  it('should throw an error if no data is provided', async () => {
    const emptyParsedData: ParsedCsvData = { data: [], headers: ['colA'] };
    const options = { labelColumn: 'colA', dataColumns: ['colA'] };
    await expect(createChartImage(emptyParsedData, 'bar', options)).rejects.toThrow('No data provided for chart generation.');
  });

  it('should throw an error if labelColumn option is missing', async () => {
    const options = { dataColumns: ['num_parts_sum'] } as any; // Missing labelColumn
    await expect(createChartImage(parsedData, 'bar', options)).rejects.toThrow('Label and data columns must be specified');
  });

  it('should throw an error if dataColumns option is invalid (empty array)', async () => {
    const options = { labelColumn: 'name_x', dataColumns: [] }; // Empty array
    await expect(createChartImage(parsedData, 'bar', options)).rejects.toThrow('Label and data columns must be specified');
  });
  
  it('should throw an error if dataColumns option is missing', async () => {
    const options = { labelColumn: 'name_x' } as any; // Missing dataColumns
    await expect(createChartImage(parsedData, 'bar', options)).rejects.toThrow('Label and data columns must be specified');
  });

  it('should throw an error if labelColumn does not exist in headers', async () => {
    const options = { labelColumn: 'non_existent_column', dataColumns: ['num_parts_sum'] };
    await expect(createChartImage(parsedData, 'bar', options)).rejects.toThrow("Label column 'non_existent_column' not found in data headers."); 
  });

  it('should throw an error if a dataColumn does not exist in headers', async () => {
    const options = { labelColumn: 'name_x', dataColumns: ['num_parts_sum', 'non_existent_column'] };
    await expect(createChartImage(parsedData, 'bar', options)).rejects.toThrow("Data column 'non_existent_column' not found in data headers."); 
  });

}); 