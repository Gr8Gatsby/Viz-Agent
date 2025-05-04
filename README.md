# Charting Agent Specification

## Overview

This document outlines the specification for a client-side charting agent designed to operate within the Agent-to-Agent (A2A) communication protocol. The agent accepts Comma-Separated Value (CSV) data and generates various chart visualizations as images.

It leverages web technologies and JavaScript charting libraries to perform its tasks directly in the user's browser or a compatible environment, without relying on Large Language Models (LLMs) for chart generation or requiring a dedicated backend server. Deployment is intended for static hosting platforms like GitHub Pages.

## Features

*   **A2A Protocol Compliance:** Adheres to the A2A protocol, presenting a valid Agent Card for discovery and interaction.
*   **CSV Input:** Accepts data inputs formatted as CSV files.
*   **Chart Generation:** Produces chart visualizations (e.g., line, bar, pie) from the input data.
*   **Image Output:** Returns generated charts as image files (e.g., PNG, JPG, SVG).
*   **Framework-Based:** Utilizes established JavaScript/TypeScript charting libraries (e.g., Chart.js, D3.js, Plotly.js) for reliable chart rendering.
*   **Client-Side Operation:** All processing and generation occur client-side.
*   **Static Hosting:** Designed for deployment on static web hosting services like GitHub Pages.

## Agent Card (A2A Protocol)

The agent will expose an Agent Card with the following (example) details:

*   **Name:** `Simple Charting Agent`
*   **Description:** `Generates chart images from CSV data.`
*   **Capabilities:**
    *   `Accepts: text/csv`
    *   `Returns: image/png, image/jpeg, image/svg`
*   **Methods:**
    *   `generateChart(data: csv, type: string): image` (Specific method details TBD)
*   **Endpoint:** (URL where the agent is hosted, e.g., GitHub Pages URL)

## Input/Output

*   **Input:**
    *   A file with the `.csv` extension.
    *   Potentially, parameters specifying chart type (e.g., "bar", "line", "pie") and configuration options (e.g., axes labels, title).
*   **Output:**
    *   An image file (PNG, JPG, or SVG) representing the generated chart.

## Technology Stack

*   **Language:** TypeScript
*   **Runtime:** Node.js (for development, building, testing)
*   **Frameworks/Libraries:**
    *   A charting library (e.g., Chart.js, D3.js, Plotly.js - specific choice TBD)
    *   A build tool (e.g., Webpack, Vite) for bundling assets for the browser.
    *   Testing framework (e.g., Jest)
*   **Deployment:** Static file hosting (GitHub Pages)

## Setup and Usage (Development)

1.  **Prerequisites:** Node.js and npm/yarn installed.
2.  **Clone Repository:** `git clone <repository-url>`
3.  **Install Dependencies:** `npm install` or `yarn install`
4.  **Run Development Server:** `npm run dev` or `yarn dev` (command TBD)
5.  **Build for Production:** `npm run build` or `yarn build` (command TBD)

## Deployment

The agent is designed to be deployed as a static website. The build process will generate static HTML, CSS, and JavaScript files in a designated output directory (e.g., `dist/`). These files can be directly uploaded to GitHub Pages or any other static hosting provider. 