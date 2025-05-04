import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as Papa from 'papaparse';
import { createChartImage } from './charting-logic';
import { ParsedCsvData } from './types';

describe('createChartImage', () => {
  it('should generate a base64 PNG string for a simple bar chart', async () => {
    // 1. Read sample data
    const csvFilePath = path.resolve(__dirname, '../data/sample-parts.csv');
    const csvString = fs.readFileSync(csvFilePath, 'utf8');

    // 2. Parse data
    const parseResult = Papa.parse(csvString, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    });

    expect(parseResult.errors).toEqual([]); // Ensure no parsing errors
    expect(parseResult.data.length).toBeGreaterThan(0);

    const parsedData: ParsedCsvData = {
      data: parseResult.data as { [key: string]: any }[],
      headers: parseResult.meta.fields || [],
    };

    // 3. Define options
    const options = {
      labelColumn: 'name_x',
      dataColumns: ['num_parts_sum'],
      title: 'Lego Set Parts Count'
    };

    // 4. Generate chart
    const base64Image = await createChartImage(parsedData, 'bar', options);

    // 5. Assert output
    expect(typeof base64Image).toBe('string');
    expect(base64Image).not.toBe('');
    expect(base64Image).toMatch(/^data:image\/png;base64,/);
    
    // Optional: More detailed check (e.g., minimum length)
    expect(base64Image.length).toBeGreaterThan(100); // Check it has some content

    // --- 6. Save the image for viewing --- 
    const outputDir = path.resolve(__dirname, '../.test-output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    const outputPath = path.join(outputDir, 'test-bar-chart.png');
    // Remove the data URI prefix and decode
    const base64Data = base64Image.replace(/^data:image\/png;base64,/, ""); 
    fs.writeFileSync(outputPath, base64Data, 'base64');
    console.log(`Test chart saved to: ${outputPath}`);
  });

  // Add more tests later for edge cases, different chart types, invalid inputs etc.
}); 