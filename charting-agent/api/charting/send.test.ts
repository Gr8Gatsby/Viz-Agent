import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler from './send'; // Import the handler function

// Import the actual module we want to spy on
import * as chartingLogic from '../../src/charting-logic';

// --- Mocking Setup with spyOn ---
let createChartImageSpy: ReturnType<typeof vi.spyOn>;

// Helper function to create mock request/response objects
const mockRequest = (body: any = null, method: string = 'POST'): Partial<VercelRequest> => ({
  method,
  body,
});

const mockResponse = (): Partial<VercelResponse> & { _status: number; _json: any; _headers: Record<string, string>; } => {
  const res: any = {};
  res._status = 200; 
  res._json = null;
  res._headers = {};
  res.status = vi.fn((code: number) => { res._status = code; return res; });
  res.json = vi.fn((data: any) => { res._json = data; return res; });
  res.setHeader = vi.fn((key: string, value: string) => { res._headers[key.toLowerCase()] = value; return res; });
  res.end = vi.fn();
  return res as Partial<VercelResponse> & { _status: number; _json: any; _headers: Record<string, string>; };
};

describe('API Handler: /api/charting', () => { // Updated describe block

  beforeEach(() => {
    // Create a spy on the actual function before each test
    createChartImageSpy = vi.spyOn(chartingLogic, 'createChartImage');
    // Default mock implementation (can be overridden in specific tests)
    createChartImageSpy.mockResolvedValue('data:image/png;base64,test-image-data-spy'); 
  });

  // Restore original implementation after each test
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return 405 if method is not POST', async () => {
    const req = mockRequest(null, 'GET');
    const res = mockResponse();
    await handler(req as VercelRequest, res as VercelResponse);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.setHeader).toHaveBeenCalledWith('Allow', ['POST']);
    expect(res.json).toHaveBeenCalled(); 
    expect(res._json).toEqual({ status: 'failed', error: { code: 'METHOD_NOT_ALLOWED', message: 'Method GET Not Allowed. Only POST is supported.' }});
    expect(res.end).not.toHaveBeenCalled();
  });

  it('should return 400 for invalid JSON payload', async () => {
    const req = mockRequest('not json'); 
    const res = mockResponse();
    await handler(req as VercelRequest, res as VercelResponse);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res._json.error.code).toBe('BAD_REQUEST');
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
    const req = mockRequest({ taskType: 'analyze', csvData: 'header1,header2\nvalue1,"unclosed quote' });
    const res = mockResponse();
    await handler(req as VercelRequest, res as VercelResponse);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res._json.error.code).toBe('INVALID_CSV_FORMAT');
  });
  
  it('should return 400 if csvData is empty after parsing', async () => {
    const req = mockRequest({ taskType: 'analyze', csvData: 'header1,header2' });
    const res = mockResponse();
    await handler(req as VercelRequest, res as VercelResponse);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res._json.error.code).toBe('EMPTY_DATA');
  });

  // --- Tests for 'analyze' task --- 
  it('should successfully handle an analyze task', async () => {
    const csvData = 'category,value1,value2\nAlpha,10,100\nBeta,20,200';
    const req = mockRequest({ taskType: 'analyze', csvData });
    const res = mockResponse();
    await handler(req as VercelRequest, res as VercelResponse);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res._json.status).toBe('completed');
    expect(res._json.result_schema).toEqual({ type: 'application/json' });
    expect(res._json.result_reference.suggestedChartTypes).toEqual(expect.arrayContaining(['bar', 'pie', 'line']));
    expect(res._json.result_reference.analysisDetails.numericColumns).toEqual(['value1', 'value2']);
    expect(res._json.result_reference.analysisDetails.categoryColumns).toEqual(['category']);
  });

  // --- Tests for 'create' task (parameter validation) ---
  it('should return 400 for create task if chartType is missing/invalid', async () => {
    const csvData = 'a,b\n1,2';
    const reqMissing = mockRequest({ taskType: 'create', csvData, options: { labelColumn: 'a', dataColumns: ['b']} });
    const resMissing = mockResponse();
    await handler(reqMissing as VercelRequest, resMissing as VercelResponse);
    expect(resMissing.status).toHaveBeenCalledWith(400);
    expect(resMissing._json.error.code).toBe('INVALID_PARAMETER');
    const reqInvalid = mockRequest({ taskType: 'create', csvData, chartType: 'bubble', options: { labelColumn: 'a', dataColumns: ['b']} });
    const resInvalid = mockResponse();
    await handler(reqInvalid as VercelRequest, resInvalid as VercelResponse);
    expect(resInvalid.status).toHaveBeenCalledWith(400);
    expect(resInvalid._json.error.code).toBe('INVALID_PARAMETER');
  });

  it('should return 400 for create task if options are missing/invalid', async () => {
    const csvData = 'a,b\n1,2';
    const reqMissing = mockRequest({ taskType: 'create', csvData, chartType: 'bar' });
    const resMissing = mockResponse();
    await handler(reqMissing as VercelRequest, resMissing as VercelResponse);
    expect(resMissing.status).toHaveBeenCalledWith(400);
    expect(resMissing._json.error.code).toBe('MISSING_PARAMETER');
    const reqInvalidLabel = mockRequest({ taskType: 'create', csvData, chartType: 'bar', options: { dataColumns: ['b'] } });
    const resInvalidLabel = mockResponse();
    await handler(reqInvalidLabel as VercelRequest, resInvalidLabel as VercelResponse);
    expect(resInvalidLabel.status).toHaveBeenCalledWith(400);
    expect(resInvalidLabel._json.error.code).toBe('MISSING_PARAMETER');
    const reqInvalidData = mockRequest({ taskType: 'create', csvData, chartType: 'bar', options: { labelColumn: 'a', dataColumns: [] } });
    const resInvalidData = mockResponse();
    await handler(reqInvalidData as VercelRequest, resInvalidData as VercelResponse);
    expect(resInvalidData.status).toHaveBeenCalledWith(400);
    expect(resInvalidData._json.error.code).toBe('MISSING_PARAMETER');
  });
  
  it('should return 400 for create task if specified columns are not in headers', async () => {
    const csvData = 'a,b\n1,2';
    const reqBadLabel = mockRequest({ taskType: 'create', csvData, chartType: 'bar', options: { labelColumn: 'c', dataColumns: ['b'] } });
    const resBadLabel = mockResponse();
    await handler(reqBadLabel as VercelRequest, resBadLabel as VercelResponse);
    expect(resBadLabel.status).toHaveBeenCalledWith(400);
    expect(resBadLabel._json.error.code).toBe('INVALID_PARAMETER');
    const reqBadData = mockRequest({ taskType: 'create', csvData, chartType: 'bar', options: { labelColumn: 'a', dataColumns: ['c'] } });
    const resBadData = mockResponse();
    await handler(reqBadData as VercelRequest, resBadData as VercelResponse);
    expect(resBadData.status).toHaveBeenCalledWith(400);
    expect(resBadData._json.error.code).toBe('INVALID_PARAMETER');
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
    expect(res._json.result_reference).toBe('data:image/png;base64,test-image-data-spy'); // Check mock value
    // Check spy call
    expect(createChartImageSpy).toHaveBeenCalledTimes(1);
    expect(createChartImageSpy).toHaveBeenCalledWith(expect.objectContaining({ headers: ['a', 'b'] }), 'bar', taskOptions );
  });

  // --- Tests for 'create' task (chart generation error) ---
  it('should return 500 if createChartImage throws an error', async () => {
    const errorMessage = 'Spy error';
    // Override mock implementation for this specific test
    createChartImageSpy.mockRejectedValueOnce(new Error(errorMessage)); 
    const csvData = 'a,b\n1,2';
    const taskOptions = { labelColumn: 'a', dataColumns: ['b'] };
    const req = mockRequest({ taskType: 'create', csvData, chartType: 'pie', options: taskOptions });
    const res = mockResponse();
    await handler(req as VercelRequest, res as VercelResponse);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res._json.error.code).toBe('CHART_GENERATION_FAILED');
    expect(res._json.error.message).toBe(errorMessage);
    expect(createChartImageSpy).toHaveBeenCalledTimes(1); // Ensure it was still called
  });

}); 