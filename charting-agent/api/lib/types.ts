export interface ParsedCsvData {
  data: { [key: string]: any }[]; // Array of objects where keys are headers
  headers: string[];
} 