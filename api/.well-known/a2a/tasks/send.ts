import type { VercelRequest, VercelResponse } from '@vercel/node';
import Papa from 'papaparse'; // Import Papaparse
import { createChartImage } from '../../src/charting-logic'; // Import the charting function
import { ParsedCsvData } from '../../src/types'; // Import the data type

// TODO: Replace with actual CSV parsing, analysis, and charting logic import
// import { analyzeData, createChart } from '../../src/agent-logic'; // Example structure

// --- A2A Interfaces ---

// Expected structure of the JSON payload in the POST request body
interface A2ATaskInput {
  taskType: 'analyze' | 'create';
  csvData: string; // Assuming inline CSV data for now
  chartType?: 'bar' | 'line' | 'pie'; // Required for 'create' task
  options?: { // Chart options required for 'create' task
    labelColumn: string;
    dataColumns: string[];
    title?: string;
    // Add other potential chart options here
  };
  // Add other potential top-level parameters from coordinator
}

// Standard A2A Success Response structure
interface A2ASuccessResponse {
  status: 'completed' | 'processing'; // Use 'completed' for sync, 'processing' if async
  result_reference?: any; // e.g., base64 image string, analysis object, URL
  result_schema?: { type: string; encoding?: string }; // Describes the result_reference
  message?: string; // Optional human-readable message
  // Add other required A2A success fields
}

// Standard A2A Error Response structure
interface A2AErrorResponse {
  status: 'failed';
  error: {
    code: string; // e.g., 'INVALID_INPUT', 'PROCESSING_FAILED'
    message: string; // Human-readable error description
  };
  // Add other required A2A error fields
}

// Type alias for handler responses
type A2AResponse = A2ASuccessResponse | A2AErrorResponse;

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
  // Function to send standardized error responses
  const sendError = (statusCode: number, code: string, message: string) => {
    const errorResponse: A2AErrorResponse = {
      status: 'failed',
      error: { code, message },
    };
    response.status(statusCode).json(errorResponse);
  };

  if (request.method !== 'POST') {
    response.setHeader('Allow', ['POST']);
    // Use standard error format
    return sendError(405, 'METHOD_NOT_ALLOWED', `Method ${request.method} Not Allowed. Only POST is supported.`);
  }

  try {
    const taskInput = request.body as A2ATaskInput; // Cast to defined interface

    // --- Input Validation ---
    if (!taskInput || typeof taskInput !== 'object') {
      return sendError(400, 'BAD_REQUEST', 'Invalid or missing JSON payload.');
    }

    // --- Validate Task Type --- 
    const { taskType, csvData, chartType, options } = taskInput;
    if (!taskType || (taskType !== 'analyze' && taskType !== 'create')) {
      return sendError(400, 'INVALID_TASK_TYPE', 'Missing or invalid taskType field (must be \'analyze\' or \'create\').');
    }

    // --- Validate and Parse CSV Data --- 
    if (!csvData || typeof csvData !== 'string' || csvData.trim().length === 0) {
      return sendError(400, 'MISSING_INPUT', 'Missing or empty csvData field (string) is required.');
    }

    let parsedDataResult: { data: any[], headers: string[] };
    try {
      // Encapsulate parsing result
      parsedDataResult = await parseCsvData(csvData);
    } catch (error: any) {
       return sendError(400, error.code || 'INVALID_CSV_FORMAT', error.message);
    }
    const { data: parsedData, headers } = parsedDataResult;
    
    // --- Route based on Task Type --- 
    let a2aResponse: A2ASuccessResponse;

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
        result_reference: analysisResult, // Send analysis object directly
        result_schema: { type: 'application/json' }, // Describe the result
        message: 'Data analysis complete.'
      };
      
    } else if (taskType === 'create') {
      console.log('Routing to: createChart logic');
      
      // --- Validate Create Task Parameters ---
      if (!chartType || !['bar', 'line', 'pie'].includes(chartType)) {
        return sendError(400, 'INVALID_PARAMETER', 'Invalid or missing chartType (must be bar, line, or pie) for create task.');
      }
      if (!options || typeof options !== 'object') {
        return sendError(400, 'MISSING_PARAMETER', 'Missing options object for create task.');
      }
      if (!options.labelColumn || typeof options.labelColumn !== 'string') {
        return sendError(400, 'MISSING_PARAMETER', 'Missing or invalid options.labelColumn (string).');
      }
      if (!options.dataColumns || !Array.isArray(options.dataColumns) || options.dataColumns.length === 0) {
        return sendError(400, 'MISSING_PARAMETER', 'Missing or invalid options.dataColumns (non-empty array).');
      }
      if (!headers.includes(options.labelColumn)) {
         return sendError(400, 'INVALID_PARAMETER', `Label column '${options.labelColumn}' not found in CSV headers.`);
      }
      for (const col of options.dataColumns) {
        if (typeof col !== 'string' || !headers.includes(col)) {
          return sendError(400, 'INVALID_PARAMETER', `Data column '${col}' is invalid or not found in CSV headers.`);
        }
      }

      // --- Generate Chart --- 
      try {
        const chartDataInput: ParsedCsvData = { data: parsedData, headers };
        const base64Image = await createChartImage(
          chartDataInput,
          chartType,
          options // Pass validated options directly
        );

        // --- Format Success Response --- 
        a2aResponse = {
          status: 'completed',
          result_reference: base64Image, 
          result_schema: { type: 'image/png', encoding: 'base64' }, 
          message: 'Chart created successfully.'
        };
        
      } catch (chartError: any) {
        console.error("Chart generation error:", chartError);
        return sendError(500, 'CHART_GENERATION_FAILED', chartError.message || 'Failed to generate chart image.');
      }

    } else {
      // This case should technically be caught by the initial taskType check, but belts and suspenders...
      return sendError(500, 'UNEXPECTED_STATE', 'Invalid task routing state.');
    }

    // Send the standard A2A success response
    response.status(200).json(a2aResponse);

  } catch (error: any) {
    console.error("Unhandled error processing task:", error);
    // Send a generic A2A-compliant error response for unexpected errors
    sendError(500, 'INTERNAL_SERVER_ERROR', error.message || 'An internal server error occurred.');
  }
}

// --- Helper function to encapsulate CSV Parsing ---
async function parseCsvData(csvString: string): Promise<{ data: any[], headers: string[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse(csvString, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        if (results.errors && results.errors.length > 0) {
          console.error('CSV Parsing Errors:', results.errors);
          const firstError = results.errors[0];
          const errorMessage = `CSV Parsing Error: ${firstError.message || 'Unknown error'}${firstError.row ? ' on row ' + firstError.row : ''}`;
          // Reject with a structured error
          return reject({ code: 'INVALID_CSV_FORMAT', message: errorMessage });
        }
        if (!results.data || results.data.length === 0) {
          return reject({ code: 'EMPTY_DATA', message: 'CSV data is empty or contains only headers.' });
        }
        resolve({ data: results.data, headers: results.meta.fields || [] });
      },
      error: (error: Error) => {
        console.error('Papaparse critical error:', error);
        reject({ code: 'INVALID_CSV_FORMAT', message: error.message || 'Failed to parse CSV data.' });
      }
    });
  });
} 