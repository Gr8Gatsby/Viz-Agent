import type { VercelRequest, VercelResponse } from '@vercel/node';
import Papa from 'papaparse'; // Import Papaparse
import { createChartImage } from '../../src/charting-logic'; // Import the charting function
import { ParsedCsvData } from '../../src/types'; // Import the data type

// TODO: Replace with actual CSV parsing, analysis, and charting logic import
// import { analyzeData, createChart } from '../../src/agent-logic'; // Example structure

// --- Helper Function for Data Type Detection ---

const SAMPLE_SIZE = 50; // Number of rows to sample for type detection
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;

interface ColumnAnalysis { 
  numericColumns: string[];
  categoryColumns: string[];
  timeColumns: string[];
  booleanColumns: string[];
  columnTypes: { [key: string]: 'number' | 'string' | 'boolean' | 'date' | 'unknown' };
}

function detectColumnTypes(data: any[], headers: string[]): ColumnAnalysis {
  const analysis: ColumnAnalysis = {
    numericColumns: [],
    categoryColumns: [],
    timeColumns: [],
    booleanColumns: [],
    columnTypes: {}
  };

  if (!data || data.length === 0 || !headers || headers.length === 0) {
    return analysis; // Return empty analysis if no data/headers
  }

  const sampleData = data.slice(0, SAMPLE_SIZE);

  for (const header of headers) {
    let numberCount = 0;
    let stringCount = 0;
    let booleanCount = 0;
    let dateCount = 0;
    let nonNullSamples = 0;

    for (const row of sampleData) {
      const value = row[header];

      if (value === null || value === undefined || value === '') {
        continue; // Skip empty/null values
      }
      nonNullSamples++;

      if (typeof value === 'number' && !isNaN(value)) {
        numberCount++;
      } else if (typeof value === 'boolean') {
        booleanCount++;
      } else if (typeof value === 'string') {
        if (DATE_REGEX.test(value)) { // Check if string matches date pattern
          // Further validation could be added here (e.g., try new Date(value))
          dateCount++;
        } else {
          stringCount++;
        }
      } else {
        // Handle other potential types if necessary (e.g., objects?)
        stringCount++; // Treat unexpected types as strings for now
      }
    }

    // Determine dominant type based on counts (adjust thresholds if needed)
    let dominantType: 'number' | 'string' | 'boolean' | 'date' | 'unknown' = 'unknown';

    if (nonNullSamples === 0) {
        dominantType = 'unknown'; // No non-empty data found in sample
    } else if (dateCount > 0 && dateCount >= nonNullSamples * 0.8) { // High confidence for dates
        dominantType = 'date';
        analysis.timeColumns.push(header);
    } else if (numberCount > 0 && numberCount >= nonNullSamples * 0.8) { // High confidence for numbers
        dominantType = 'number';
        analysis.numericColumns.push(header);
    } else if (booleanCount > 0 && booleanCount >= nonNullSamples * 0.8) { // High confidence for booleans
        dominantType = 'boolean';
        analysis.booleanColumns.push(header); // Added boolean column tracking
    } else { // Default to string if no dominant type or mixed types
        dominantType = 'string';
        analysis.categoryColumns.push(header);
    }
    analysis.columnTypes[header] = dominantType;
  }

  console.log('Column Type Analysis:', analysis.columnTypes);
  return analysis;
}

// --- Main Handler --- 

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', ['POST']);
    return response.status(405).end(`Method ${request.method} Not Allowed`);
  }

  try {
    const taskInput = request.body;

    // --- Basic Input Validation ---
    if (!taskInput || typeof taskInput !== 'object') {
      return response.status(400).json({
        status: 'failed',
        error: { code: 'BAD_REQUEST', message: 'Invalid JSON payload.' }
      });
    }

    // --- Extract Task Type --- 
    const taskType = taskInput.taskType as string;
    if (!taskType || (taskType !== 'analyze' && taskType !== 'create')) {
      return response.status(400).json({
        status: 'failed',
        error: { code: 'INVALID_TASK_TYPE', message: 'Missing or invalid taskType field (must be \'analyze\' or \'create\').' }
      });
    }

    // --- Extract and Parse CSV Data --- 
    const csvDataString = taskInput.csvData as string;

    if (!csvDataString || typeof csvDataString !== 'string') {
      return response.status(400).json({
        status: 'failed',
        error: { code: 'MISSING_INPUT', message: 'csvData field (string) is required.' }
      });
    }

    console.log("Received task with csvData:", csvDataString.substring(0, 150) + (csvDataString.length > 150 ? '...' : ''));

    // --- Parse CSV Data ---
    let parsedData: any[] = [];
    let headers: string[] = [];

    try {
      const parseResult = Papa.parse(csvDataString, {
        header: true, // Treat the first row as headers
        skipEmptyLines: true,
        dynamicTyping: true, // Automatically convert numbers, booleans
      });

      if (parseResult.errors && parseResult.errors.length > 0) {
        console.error('CSV Parsing Errors:', parseResult.errors);
        // Try to provide a specific error message if possible
        const firstError = parseResult.errors[0];
        const errorMessage = `CSV Parsing Error: ${firstError.message || 'Unknown error'} on row ${firstError.row || 'N/A'}`;
        return response.status(400).json({
          status: 'failed',
          error: { code: 'INVALID_CSV_FORMAT', message: errorMessage }
        });
      }

      if (!parseResult.data || parseResult.data.length === 0) {
        return response.status(400).json({
          status: 'failed',
          error: { code: 'EMPTY_DATA', message: 'CSV data is empty or contains only headers.' }
        });
      }

      parsedData = parseResult.data;
      headers = parseResult.meta.fields || []; // Get header names
      console.log("CSV Parsed Successfully. Headers:", headers);
      // console.log("Parsed Data Sample:", parsedData.slice(0, 3)); // Log first few rows for debugging
      
      // Data is now parsed and stored in 'parsedData' array of objects
      // Headers are in the 'headers' array

    } catch (parseError: any) {
      console.error("Papaparse critical error:", parseError);
      return response.status(400).json({
        status: 'failed',
        error: { code: 'INVALID_CSV_FORMAT', message: parseError.message || 'Failed to parse CSV data.' }
      });
    }

    // --- Route based on Task Type --- 
    let a2aResponse: object;

    if (taskType === 'analyze') {
      console.log('Routing to: analyzeData logic');
      
      // --- Perform Data Analysis using helper function ---
      const columnAnalysis = detectColumnTypes(parsedData, headers);

      // --- TODO: Suggest chart types based on analysis --- 
      let suggestedChartTypes: string[] = [];
      // Basic suggestion logic (can be expanded):
      const hasNumeric = columnAnalysis.numericColumns.length > 0;
      const hasCategory = columnAnalysis.categoryColumns.length > 0;
      const hasTime = columnAnalysis.timeColumns.length > 0;

      if (hasCategory && hasNumeric) {
        suggestedChartTypes.push('bar', 'pie');
      }
      if ((hasTime || hasCategory) && columnAnalysis.numericColumns.length >= 1) {
        suggestedChartTypes.push('line');
      }
      if (columnAnalysis.numericColumns.length >= 2) {
        // suggestedChartTypes.push('scatter'); // Add later if needed
      }
      // Remove duplicates
      suggestedChartTypes = [...new Set(suggestedChartTypes)]; 

      const analysisResult = {
        suggestedChartTypes: suggestedChartTypes,
        analysisDetails: { 
          numericColumns: columnAnalysis.numericColumns,
          categoryColumns: columnAnalysis.categoryColumns,
          timeColumns: columnAnalysis.timeColumns,
          booleanColumns: columnAnalysis.booleanColumns, // Include detected boolean columns
          allColumnTypes: columnAnalysis.columnTypes // Include the map of all detected types
        }
      };
      
      a2aResponse = {
        status: 'completed', 
        result: analysisResult,
        message: 'Data analysis complete.'
      };
      
    } else if (taskType === 'create') {
      console.log('Routing to: createChart logic');
      
      // --- Extract chart parameters ---
      const chartType = taskInput.chartType as string;
      // The options object is expected to contain labelColumn, dataColumns, title?, etc.
      const options = taskInput.options as any; // Cast as any for now, validate below

      // --- Validate parameters ---
      if (!chartType || !['bar', 'line', 'pie'].includes(chartType)) { // Basic type validation
        return response.status(400).json({
          status: 'failed',
          error: { code: 'INVALID_PARAMETER', message: 'Invalid or missing chartType (must be bar, line, or pie).' }
        });
      }
      if (!options || typeof options !== 'object') {
        return response.status(400).json({
          status: 'failed',
          error: { code: 'MISSING_PARAMETER', message: 'Missing options object for chart creation.' }
        });
      }
      if (!options.labelColumn || typeof options.labelColumn !== 'string') {
        return response.status(400).json({
          status: 'failed',
          error: { code: 'MISSING_PARAMETER', message: 'Missing or invalid options.labelColumn (string).' }
        });
      }
      if (!options.dataColumns || !Array.isArray(options.dataColumns) || options.dataColumns.length === 0) {
        return response.status(400).json({
          status: 'failed',
          error: { code: 'MISSING_PARAMETER', message: 'Missing or invalid options.dataColumns (non-empty array).' }
        });
      }
       // Basic check if columns exist in headers (more robust check in createChartImage)
      if (!headers.includes(options.labelColumn)) {
         return response.status(400).json({ status: 'failed', error: { code: 'INVALID_PARAMETER', message: `Label column '${options.labelColumn}' not found in CSV headers.` } });
      }
      for (const col of options.dataColumns) {
        if (typeof col !== 'string' || !headers.includes(col)) {
          return response.status(400).json({ status: 'failed', error: { code: 'INVALID_PARAMETER', message: `Data column '${col}' is invalid or not found in CSV headers.` } });
        }
      }

      // --- Prepare data for charting function ---
      const chartDataInput: ParsedCsvData = {
        data: parsedData,
        headers: headers
      };
      
      // --- Generate Chart --- 
      try {
        const base64Image = await createChartImage(
          chartDataInput,
          chartType as 'bar' | 'line' | 'pie', // Type assertion after validation
          {
            // Pass validated options
            labelColumn: options.labelColumn,
            dataColumns: options.dataColumns,
            title: options.title as string | undefined // Optional title
          }
        );

        // --- Format Success Response --- 
        a2aResponse = {
          status: 'completed',
          result_reference: base64Image, // Send base64 image directly
          result_schema: { type: 'image/png', encoding: 'base64' }, // Describe the result
          message: 'Chart created successfully.'
        };
        
      } catch (chartError: any) {
        console.error("Chart generation error:", chartError);
        // Return specific error from chart generation if available
        return response.status(500).json({
          status: 'failed',
          error: { 
            code: 'CHART_GENERATION_FAILED', 
            message: chartError.message || 'Failed to generate chart image.' 
          }
        });
      }

    } else {
      // This case should technically be caught by the initial taskType check, but belts and suspenders...
      return response.status(500).json({
        status: 'failed',
        error: { code: 'UNEXPECTED_STATE', message: 'Invalid task routing state.' }
      });
    }

    // Send the standard A2A response
    response.status(200).json(a2aResponse);

  } catch (error: any) {
    console.error("Error processing task:", error);
    // Send an A2A-compliant error response
    response.status(500).json({
      status: 'failed',
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message || 'An internal error occurred.'
      }
    });
  }
} 