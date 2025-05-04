# Charting Agent Specification

## Overview

This document outlines the specification for a client-side charting agent designed to operate within the Agent-to-Agent (A2A) communication protocol. The agent accepts Comma-Separated Value (CSV) data, **analyzes it to determine suitable chart types, suggests these types to the caller, and then generates a requested chart visualization as an image.**

It leverages web technologies and JavaScript charting libraries to perform its tasks directly in the user's browser or a compatible environment, without relying on Large Language Models (LLMs) for chart generation or requiring a dedicated backend server. Deployment is intended for static hosting platforms like GitHub Pages.

## Features

*   **A2A Protocol Compliance:** Adheres to the A2A protocol, presenting a valid Agent Card for discovery and interaction.
*   **CSV Input:** Accepts data inputs formatted as CSV files.
*   **Data Analysis:** Analyzes CSV structure and data types to suggest appropriate chart visualizations.
*   **Chart Suggestion:** Returns a list of recommended chart types based on the data analysis.
*   **Chart Generation:** Produces chart visualizations (e.g., line, bar, pie) from the input data based on the caller's selection.
*   **Image Output:** Returns generated charts as image files (e.g., PNG, JPG, SVG).
*   **Framework-Based:** Utilizes established JavaScript/TypeScript charting libraries (e.g., Chart.js, D3.js) for reliable chart rendering.
*   **Client-Side Operation:** All processing and generation occur client-side.
*   **Static Hosting:** Designed for deployment on static web hosting services like GitHub Pages.

## Agent Card (A2A Protocol)

The agent will expose an Agent Card with the following (example) details:

*   **Name:** `Simple Charting Agent`
*   **Description:** `Analyzes CSV data and generates suggested chart images.`
*   **Capabilities:**
    *   `Accepts: text/csv`
    *   `Returns: application/json` (for analysis results), `image/png`, `image/jpeg`, `image/svg` (for generated charts)
*   **Methods:** Defined in the Agent Card JSON.
*   **Endpoint:** Coordinator expects an interactive endpoint like `/.well-known/a2a/tasks/send`.
*   **Agent Card Access:** The agent card is defined statically at `/.well-known/agent.json`.
*   **Method Access:** The underlying JavaScript functions (`analyzeData`, `createChart`) are available under `window.agent` for local testing or alternative integrations.

**Note on Endpoint Compatibility:** The requirement for an interactive `/send` endpoint is **incompatible** with deployment as a purely static site on GitHub Pages. Static hosting cannot process POST requests. Fulfilling this requirement necessitates a backend component (e.g., serverless function).

*Note: `AnalysisResponse`, `ChartResponse`, and `ErrorResponse` will follow the structured JSON formats detailed in the Error Handling section.*

## Input/Output

*   **Interaction Flow:**
    1.  The calling agent sends the CSV data to the `analyzeData` method.
    2.  The Charting Agent analyzes the data and returns a structured JSON response containing suggested chart types (e.g., `['bar', 'line']`) and potentially information about which columns are suitable for axes/labels.
    3.  The calling agent (potentially after user interaction) selects a chart type from the suggestions.
    4.  The calling agent sends the *original* CSV data and the chosen `chartType` (and any optional `options`) to the `createChart` method.
    5.  The Charting Agent generates the chart and returns it as an image file within a structured JSON response, or returns a structured error response if generation fails.

*   **Input (`analyzeData`):**
    *   A file with the `.csv` extension.
*   **Output (`analyzeData`):**
    *   Structured JSON (see `AnalysisResponse` below).
*   **Input (`createChart`):**
    *   A file with the `.csv` extension.
    *   `chartType`: A string specifying the desired chart type (e.g., "bar", "line", "pie"). Should ideally be one suggested by `analyzeData`.
    *   `options` (Optional): An object for configuration (e.g., axes labels, title, colors).
*   **Output (`createChart`):**
    *   Structured JSON containing the image data on success (see `ChartResponse` below) or error details on failure (see `ErrorResponse` below).

## Error Handling and Response Structures

The agent will use structured JSON responses to clearly communicate outcomes and errors for both `analyzeData` and `createChart` methods.

**1. Success Response (`analyzeData` -> `AnalysisResponse`)**

```json
{
  "status": "success",
  "result": {
    "suggestedChartTypes": ["bar", "line", "pie"],
    "analysisDetails": { 
      // Optional: More info, e.g., potential axis mappings
      "numericColumns": ["ValueA", "ValueB"],
      "categoryColumns": ["CategoryName"],
      "timeColumns": ["Date"] 
    }
  }
}
```

**2. Success Response (`createChart` -> `ChartResponse`)**

```json
{
  "status": "success",
  "result": {
    "mimeType": "image/png", 
    "data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg..." // Base64 encoded image data
  }
}
```

**3. Error Response (Both Methods -> `ErrorResponse`)**

```json
{
  "status": "error",
  "error": {
    "code": "INVALID_CSV_FORMAT", // Machine-readable code
    "message": "Failed to parse CSV data. Check formatting near line 5." // Human-readable message
  }
}
```

*   **Potential Error Codes:**
    *   `INVALID_CSV_FORMAT`: Cannot parse the input CSV.
    *   `EMPTY_DATA`: The CSV file contains no usable data.
    *   `INSUFFICIENT_DATA`: Not enough data/columns for analysis or the requested chart.
    *   `UNSUPPORTED_CHART_TYPE`: The `chartType` requested in `createChart` is not supported.
    *   `MISSING_REQUIRED_OPTIONS`: Required `options` for the chosen chart type were not provided.
    *   `CHART_GENERATION_FAILED`: Internal error during chart rendering or image conversion.
    *   `ANALYSIS_FAILED`: Internal error during data analysis.

This structured approach ensures clarity and robustness in communication.

## Technology Stack

*   **Language:** TypeScript
*   **Runtime:** Node.js (for development, building, testing)
*   **Frameworks/Libraries:**
    *   **Charting:** Primarily [Chart.js](https://www.chartjs.org/) for common chart types (bar, line, pie). [D3.js](https://d3js.org/) may be considered for more complex or custom visualizations.
    *   **Build Tool:** [Vite](https://vitejs.dev/) for fast development and optimized static builds.
    *   **Testing:** [Vitest](https://vitest.dev/) for unit and integration testing.
*   **Deployment:** Static file hosting (GitHub Pages)

## Setup and Usage (Development)

1.  **Prerequisites:** Node.js and npm/yarn installed.
2.  **Clone Repository:** `git clone <repository-url>`
3.  **Install Dependencies:** `npm install` or `yarn install`
4.  **Run Development Server:** `npm run dev` or `yarn dev` (command TBD)
5.  **Build for Production:** `npm run build` or `yarn build` (command TBD)

## Deployment

The agent is designed to be deployed as a static website. The build process will generate static HTML, CSS, and JavaScript files in a designated output directory (e.g., `dist/`). These files can be directly uploaded to GitHub Pages or any other static hosting provider. 