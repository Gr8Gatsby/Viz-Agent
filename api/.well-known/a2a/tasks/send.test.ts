import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler from './send'; // Import the handler function

// Mock the charting logic module
vi.mock('../../src/charting-logic', () => ({
  createChartImage: vi.fn(), // Mock the specific function we use
}));

// Import the mocked function type if needed for assertions
import { createChartImage } from '../../src/charting-logic';

// Helper function to create mock request/response objects
const mockRequest = (body: any = null, method: string = 'POST'): Partial<VercelRequest> => ({
  method,
  body,
  // Add other request properties if needed (e.g., headers, query)
});

const mockResponse = (): Partial<VercelResponse> & { _status: number; _json: any; _headers: Record<string, string>; } => {
  const res: any = {};
  res._status = 200; // Default status
  res._json = null;
  res._headers = {};
  res.status = vi.fn((code: number) => {
    res._status = code;
    return res; // Allow chaining
  });
  res.json = vi.fn((data: any) => {
    res._json = data;
    return res; // Allow chaining
  });
   res.setHeader = vi.fn((key: string, value: string) => {
     res._headers[key.toLowerCase()] = value;
     return res;
   });
   res.end = vi.fn(); // Mock end for non-POST request test
  return res as Partial<VercelResponse> & { _status: number; _json: any; _headers: Record<string, string>; };
};

describe('API Handler: /.well-known/a2a/tasks/send', () => {

  // Reset mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the mock implementation if needed for specific tests
    (createChartImage as vi.Mock).mockResolvedValue('data:image/png;base64,test-image-data');
  });

  it('should return 405 if method is not POST', async () => {
    const req = mockRequest(null, 'GET');
    const res = mockResponse();

    await handler(req as VercelRequest, res as VercelResponse);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.setHeader).toHaveBeenCalledWith('Allow', ['POST']);
    expect(res.end).toHaveBeenCalledWith('Method GET Not Allowed. Only POST is supported.');
    expect(res._json.status).toBe('failed'); // Check standardized error
    expect(res._json.error.code).toBe('METHOD_NOT_ALLOWED');
  });

  it('should return 400 for invalid JSON payload', async () => {
    const req = mockRequest('not json'); // Send invalid body
    const res = mockResponse();
    
    await handler(req as VercelRequest, res as VercelResponse);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res._json.status).toBe('failed');
    expect(res._json.error.code).toBe('BAD_REQUEST');
    expect(res._json.error.message).toContain('Invalid or missing JSON payload');
  });
  
  it('should return 400 if taskType is missing or invalid', async () => {
    const reqMissing = mockRequest({ csvData: 'a,b\n1,2' });
    const resMissing = mockResponse();
    await handler(reqMissing as VercelRequest, resMissing as VercelResponse);
    expect(resMissing.status).toHaveBeenCalledWith(400);
    expect(resMissing._json.error.code).toBe('INVALID_TASK_TYPE');

    const reqInvalid = mockRequest({ taskType: 'unknown', csvData: 'a,b\n1,2' });
    const resInvalid = mockResponse();
    await handler(reqInvalid as VercelRequest, resInvalid as VercelResponse);
    expect(resInvalid.status).toHaveBeenCalledWith(400);
    expect(resInvalid._json.error.code).toBe('INVALID_TASK_TYPE');
  });

  // --- Tests for CSV validation ---
  it('should return 400 if csvData is missing or empty', async () => {
    const reqMissing = mockRequest({ taskType: 'analyze' });
    const resMissing = mockResponse();
    await handler(reqMissing as VercelRequest, resMissing as VercelResponse);
    expect(resMissing.status).toHaveBeenCalledWith(400);
    expect(resMissing._json.error.code).toBe('MISSING_INPUT');

    const reqEmpty = mockRequest({ taskType: 'analyze', csvData: '  ' });
    const resEmpty = mockResponse();
    await handler(reqEmpty as VercelRequest, resEmpty as VercelResponse);
    expect(resEmpty.status).toHaveBeenCalledWith(400);
    expect(resEmpty._json.error.code).toBe('MISSING_INPUT');
  });

  it('should return 400 if csvData is unparseable', async () => {
    // Example of malformed CSV (uneven quotes)
    const req = mockRequest({ taskType: 'analyze', csvData: 'header1,header2\nvalue1,"unclosed quote' });
    const res = mockResponse();
    await handler(req as VercelRequest, res as VercelResponse);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res._json.error.code).toBe('INVALID_CSV_FORMAT');
    expect(res._json.error.message).toContain('CSV Parsing Error'); 
  });
  
  it('should return 400 if csvData is empty after parsing', async () => {
    const req = mockRequest({ taskType: 'analyze', csvData: 'header1,header2' }); // Only headers
    const res = mockResponse();
    await handler(req as VercelRequest, res as VercelResponse);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res._json.error.code).toBe('EMPTY_DATA');
    expect(res._json.error.message).toContain('CSV data is empty'); 
  });

  // --- Tests for 'analyze' task --- 
  it('should successfully handle an analyze task', async () => {
    const csvData = 'category,value1,value2\nAlpha,10,100\nBeta,20,200\nGamma,true,false'; // Mixed types
    const req = mockRequest({ taskType: 'analyze', csvData });
    const res = mockResponse();

    await handler(req as VercelRequest, res as VercelResponse);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res._json.status).toBe('completed');
    expect(res._json.message).toBe('Data analysis complete.');
    expect(res._json.result_schema).toEqual({ type: 'application/json' });
    // Check analysis result structure
    expect(res._json.result_reference).toBeDefined();
    expect(res._json.result_reference.suggestedChartTypes).toEqual(expect.arrayContaining(['bar', 'pie', 'line']));
    expect(res._json.result_reference.analysisDetails).toBeDefined();
    expect(res._json.result_reference.analysisDetails.numericColumns).toEqual(['value1', 'value2']);
    expect(res._json.result_reference.analysisDetails.categoryColumns).toEqual(['category']);
    expect(res._json.result_reference.analysisDetails.booleanColumns).toEqual([]); // Test data doesn't have dominant booleans
    expect(res._json.result_reference.analysisDetails.timeColumns).toEqual([]);
    expect(res._json.result_reference.analysisDetails.allColumnTypes).toEqual({ category: 'string', value1: 'number', value2: 'number' });
  });

  // --- Tests for 'create' task (parameter validation) ---
  it('should return 400 for create task if chartType is missing/invalid', async () => {
    const csvData = 'a,b\n1,2';
    const reqMissing = mockRequest({ taskType: 'create', csvData, options: { labelColumn: 'a', dataColumns: ['b']} });
    const resMissing = mockResponse();
    await handler(reqMissing as VercelRequest, resMissing as VercelResponse);
    expect(resMissing.status).toHaveBeenCalledWith(400);
    expect(resMissing._json.error.code).toBe('INVALID_PARAMETER');
    expect(resMissing._json.error.message).toContain('chartType');
    
    const reqInvalid = mockRequest({ taskType: 'create', csvData, chartType: 'bubble', options: { labelColumn: 'a', dataColumns: ['b']} });
    const resInvalid = mockResponse();
    await handler(reqInvalid as VercelRequest, resInvalid as VercelResponse);
    expect(resInvalid.status).toHaveBeenCalledWith(400);
    expect(resInvalid._json.error.code).toBe('INVALID_PARAMETER');
    expect(resInvalid._json.error.message).toContain('chartType');
  });

  it('should return 400 for create task if options are missing/invalid', async () => {
    const csvData = 'a,b\n1,2';
    const reqMissing = mockRequest({ taskType: 'create', csvData, chartType: 'bar' });
    const resMissing = mockResponse();
    await handler(reqMissing as VercelRequest, resMissing as VercelResponse);
    expect(resMissing.status).toHaveBeenCalledWith(400);
    expect(resMissing._json.error.code).toBe('MISSING_PARAMETER');
    expect(resMissing._json.error.message).toContain('options object');
    
    const reqInvalidLabel = mockRequest({ taskType: 'create', csvData, chartType: 'bar', options: { dataColumns: ['b'] } });
    const resInvalidLabel = mockResponse();
    await handler(reqInvalidLabel as VercelRequest, resInvalidLabel as VercelResponse);
    expect(resInvalidLabel.status).toHaveBeenCalledWith(400);
    expect(resInvalidLabel._json.error.code).toBe('MISSING_PARAMETER');
    expect(resInvalidLabel._json.error.message).toContain('options.labelColumn');
    
    const reqInvalidData = mockRequest({ taskType: 'create', csvData, chartType: 'bar', options: { labelColumn: 'a', dataColumns: [] } });
    const resInvalidData = mockResponse();
    await handler(reqInvalidData as VercelRequest, resInvalidData as VercelResponse);
    expect(resInvalidData.status).toHaveBeenCalledWith(400);
    expect(resInvalidData._json.error.code).toBe('MISSING_PARAMETER');
    expect(resInvalidData._json.error.message).toContain('options.dataColumns');
  });
  
  it('should return 400 for create task if specified columns are not in headers', async () => {
    const csvData = 'a,b\n1,2';
    const reqBadLabel = mockRequest({ taskType: 'create', csvData, chartType: 'bar', options: { labelColumn: 'c', dataColumns: ['b'] } });
    const resBadLabel = mockResponse();
    await handler(reqBadLabel as VercelRequest, resBadLabel as VercelResponse);
    expect(resBadLabel.status).toHaveBeenCalledWith(400);
    expect(resBadLabel._json.error.code).toBe('INVALID_PARAMETER');
    expect(resBadLabel._json.error.message).toContain("Label column 'c' not found");
    
    const reqBadData = mockRequest({ taskType: 'create', csvData, chartType: 'bar', options: { labelColumn: 'a', dataColumns: ['c'] } });
    const resBadData = mockResponse();
    await handler(reqBadData as VercelRequest, resBadData as VercelResponse);
    expect(resBadData.status).toHaveBeenCalledWith(400);
    expect(resBadData._json.error.code).toBe('INVALID_PARAMETER');
    expect(resBadData._json.error.message).toContain("Data column 'c' is invalid");
  });

  // --- Tests for 'create' task (successful chart generation) ---
  it('should successfully handle a create task and call createChartImage', async () => {
    const csvData = 'a,b\n1,2';
    const taskOptions = { labelColumn: 'a', dataColumns: ['b'], title: 'Test Chart' };
    const req = mockRequest({ taskType: 'create', csvData, chartType: 'bar', options: taskOptions });
    const res = mockResponse();

    await handler(req as VercelRequest, res as VercelResponse);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res._json.status).toBe('completed');
    expect(res._json.message).toBe('Chart created successfully.');
    expect(res._json.result_schema).toEqual({ type: 'image/png', encoding: 'base64' });
    expect(res._json.result_reference).toBe('data:image/png;base64,test-image-data'); // From mock

    // Check that the mocked createChartImage was called correctly
    expect(createChartImage).toHaveBeenCalledTimes(1);
    expect(createChartImage).toHaveBeenCalledWith(
      expect.objectContaining({ 
          data: expect.any(Array), // Basic check for parsed data
          headers: ['a', 'b'] 
      }),
      'bar', // chartType
      taskOptions // options
    );
  });

  // --- Tests for 'create' task (chart generation error) ---
  it('should return 500 if createChartImage throws an error', async () => {
    // Configure mock to throw an error
    const errorMessage = 'Canvas context error';
    (createChartImage as vi.Mock).mockRejectedValue(new Error(errorMessage));

    const csvData = 'a,b\n1,2';
    const taskOptions = { labelColumn: 'a', dataColumns: ['b'] };
    const req = mockRequest({ taskType: 'create', csvData, chartType: 'pie', options: taskOptions });
    const res = mockResponse();

    await handler(req as VercelRequest, res as VercelResponse);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res._json.status).toBe('failed');
    expect(res._json.error.code).toBe('CHART_GENERATION_FAILED');
    expect(res._json.error.message).toBe(errorMessage);
    expect(createChartImage).toHaveBeenCalledTimes(1); // Ensure it was still called
  });

}); 