import type { VercelRequest, VercelResponse } from '@vercel/node';
// import { parse as papaParse } from 'papaparse'; // Old named import
import Papa from 'papaparse'; // Import the default export
const { parse: papaParse } = Papa; // Destructure the parse function
import { createChartImage } from '../lib/charting-logic.js';
import { ParsedCsvData } from '../lib/types.js';

// --- A2A Interfaces ---

interface A2ATaskInput {
  taskType: 'analyze' | 'create';
  csvData: string; 
  chartType?: 'bar' | 'line' | 'pie'; 
  options?: { 
    labelColumn: string;
    dataColumns: string[];
    title?: string;
  };
}

interface A2ASuccessResponse {
  status: 'completed' | 'processing'; 
  result_reference?: any; 
  result_schema?: { type: string; encoding?: string }; 
  message?: string; 
}

interface A2AErrorResponse {
  status: 'failed';
  error: {
    code: string; 
    message: string; 
  };
}

// type A2AResponse = A2ASuccessResponse | A2AErrorResponse; // Commented out as unused

// --- Helper Function for Data Type Detection ---

const SAMPLE_SIZE = 50;
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
    numericColumns: [], categoryColumns: [], timeColumns: [], booleanColumns: [], columnTypes: {}
  };
  if (!data || data.length === 0 || !headers || headers.length === 0) return analysis;
  const sampleData = data.slice(0, SAMPLE_SIZE);
  for (const header of headers) {
    let numberCount = 0, booleanCount = 0, dateCount = 0, nonNullSamples = 0;
    for (const row of sampleData) {
      const value = row[header];
      if (value === null || value === undefined || value === '') continue;
      nonNullSamples++;
      if (typeof value === 'number' && !isNaN(value)) numberCount++;
      else if (typeof value === 'boolean') booleanCount++;
      else if (typeof value === 'string') {
        const potentialNum = Number(value);
        if (!isNaN(potentialNum) && value.trim() !== '') numberCount++;
        else if (DATE_REGEX.test(value)) dateCount++;
      } else {
        // else stringCount++; // This else should also be removed or modified
      }
    }
    let dominantType: 'number' | 'string' | 'boolean' | 'date' | 'unknown' = 'unknown';
    if (nonNullSamples === 0) dominantType = 'unknown';
    else if (dateCount > 0 && dateCount >= nonNullSamples * 0.8) { dominantType = 'date'; analysis.timeColumns.push(header); }
    else if (numberCount > 0 && numberCount >= nonNullSamples * 0.8) { dominantType = 'number'; analysis.numericColumns.push(header); }
    else if (booleanCount > 0 && booleanCount >= nonNullSamples * 0.8) { dominantType = 'boolean'; analysis.booleanColumns.push(header); }
    else { dominantType = 'string'; analysis.categoryColumns.push(header); }
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
  const sendError = (statusCode: number, code: string, message: string) => {
    const errorResponse: A2AErrorResponse = { status: 'failed', error: { code, message } };
    response.status(statusCode).json(errorResponse);
  };

  if (request.method !== 'POST') {
    response.setHeader('Allow', ['POST']);
    return sendError(405, 'METHOD_NOT_ALLOWED', `Method ${request.method} Not Allowed. Only POST is supported.`);
  }

  try {
    const taskInput = request.body as A2ATaskInput;
    if (!taskInput || typeof taskInput !== 'object') {
      return sendError(400, 'BAD_REQUEST', 'Invalid or missing JSON payload.');
    }
    const { taskType, csvData, chartType, options } = taskInput;
    if (!taskType || (taskType !== 'analyze' && taskType !== 'create')) {
      return sendError(400, 'INVALID_TASK_TYPE', 'Missing or invalid taskType field (must be \'analyze\' or \'create\').');
    }
    if (!csvData || typeof csvData !== 'string' || csvData.trim().length === 0) {
      return sendError(400, 'MISSING_INPUT', 'Missing or empty csvData field (string) is required.');
    }

    let parsedDataResult: { data: any[], headers: string[] };
    try {
      parsedDataResult = await parseCsvData(csvData);
    } catch (error: any) {
       return sendError(400, error.code || 'INVALID_CSV_FORMAT', error.message);
    }
    const { data: parsedData, headers } = parsedDataResult;
    
    let a2aResponse: A2ASuccessResponse;

    if (taskType === 'analyze') {
      console.log('Routing to: analyzeData logic');
      const columnAnalysis = detectColumnTypes(parsedData, headers);
      let suggestedChartTypes: string[] = [];
      const hasNumeric = columnAnalysis.numericColumns.length > 0;
      const hasCategory = columnAnalysis.categoryColumns.length > 0;
      const hasTime = columnAnalysis.timeColumns.length > 0;
      if (hasCategory && hasNumeric) suggestedChartTypes.push('bar', 'pie');
      if ((hasTime || hasCategory) && hasNumeric) suggestedChartTypes.push('line');
      suggestedChartTypes = [...new Set(suggestedChartTypes)];
      const analysisResult = {
        suggestedChartTypes,
        analysisDetails: {
          numericColumns: columnAnalysis.numericColumns,
          categoryColumns: columnAnalysis.categoryColumns,
          timeColumns: columnAnalysis.timeColumns,
          booleanColumns: columnAnalysis.booleanColumns, 
          allColumnTypes: columnAnalysis.columnTypes 
        }
      };
      a2aResponse = {
        status: 'completed', 
        result_reference: analysisResult,
        result_schema: { type: 'application/json' }, 
        message: 'Data analysis complete.'
      };
      
    } else { // taskType === 'create'
      console.log('Routing to: createChart logic');
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
      try {
        const chartDataInput: ParsedCsvData = { data: parsedData, headers };
        const base64Image = await createChartImage(chartDataInput, chartType, options);
        a2aResponse = {
          status: 'completed',
          result_reference: base64Image, 
          result_schema: { type: 'image/png', encoding: 'base64' }, 
          message: 'Chart created successfully.'
        };
      } catch (chartError: any) {
        console.error("Chart generation error:", chartError);
        await sendError(500, 'CHART_GENERATION_FAILED', chartError.message || 'Failed to generate chart image.');
        return;
      }
    }
    if (!response.writableEnded) {
       response.status(200).json(a2aResponse);
    }

  } catch (error: any) {
    console.error("Unhandled error processing task:", error);
    if (!response.writableEnded) {
       sendError(500, 'INTERNAL_SERVER_ERROR', error.message || 'An internal server error occurred.');
    }
  }
}

// --- Helper function to encapsulate CSV Parsing ---
async function parseCsvData(csvString: string): Promise<{ data: any[], headers: string[] }> {
  return new Promise((resolve, reject) => {
    papaParse(csvString, {
      header: true, skipEmptyLines: true, dynamicTyping: true,
      complete: (results: any) => {
        if (results.errors && results.errors.length > 0) {
          console.error('CSV Parsing Errors:', results.errors);
          const firstError = results.errors[0];
          const errorMessage = `CSV Parsing Error: ${firstError.message || 'Unknown error'}${firstError.row ? ' on row ' + firstError.row : ''}`;
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