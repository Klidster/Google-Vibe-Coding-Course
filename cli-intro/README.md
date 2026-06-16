# BigQuery Release Notes Hub

An elegant, high-fidelity web application built with **Python Flask** and **Vanilla Web Technologies (HTML5, CSS3, JavaScript)**. It fetches, caches, structures, and presents Google Cloud BigQuery Release Notes in a modern timeline dashboard.

## Features

- 🛰️ **Bypass CORS via Flask Backend**: Fetches and parses the official BigQuery Atom feed XML directly on the server-side, bypassing client-side origin limitations.
- ⚡ **Performance Caching**: Employs an in-memory caching mechanism (10-minute expiry) to prevent spamming Google's servers, with a force-refresh capability.
- 📊 **Interactive Dashboard**: Displays live counts of updates categorized by Feature, Issue, and Change.
- 🔍 **Real-Time Word-Highlighting Search**: Instantly filters releases across title and content with highlight tags (`<mark>`) dynamically wrapped around query matches.
- 🏷️ **Dynamic Tag Cloud**: Scans release text to identify popular technical components (e.g. Gemini, SQL, ML, Security, BigQuery Studio) and compiles interactive tag filters.
- 🌗 **Premium Light & Dark Themes**: Fully styled with custom variables, smooth transitions, glassmorphic panels, and user theme selection (persisted via `localStorage`).
- 📱 **Fully Responsive Layout**: Fits screens of all sizes using a flexible layout.
- 🚀 **Smooth Animations**: Transitions and entry effects for timeline cards as you type or apply filters.

## Project Structure

```text
cli-intro/
│
├── app.py                 # Flask Server & Feed Parsing Controller
├── requirements.txt       # Dependencies
├── README.md              # Setup & User Guide
│
├── templates/
│   └── index.html         # Main View Template
│
└── static/
    ├── css/
    │   └── style.css      # Custom stylesheet (Design System, Theme, Animations)
    └── js/
        └── app.js         # Frontend Logic (State, Filtering, Theme Toggling)
```

## Running the Application

Follow these steps to run the application on your machine:

### 1. Requirements
Python 3.12 is installed. The virtual environment (`venv`) has already been initialized and pre-loaded with dependencies (`flask`, `requests`, `feedparser`).

### 2. Activate the Virtual Environment
Activate the environment in your shell:

**Windows (PowerShell):**
```powershell
.\venv\Scripts\Activate.ps1
```

**Windows (CMD):**
```cmd
.\venv\Scripts\activate.bat
```

### 3. Run the Flask Server
Run the Flask server:
```bash
python app.py
```
*Note: Since the virtual environment has its own path, you can also execute it directly:*
```powershell
.\venv\Scripts\python.exe app.py
```

### 4. Open the Web Application
Open your web browser and navigate to:
```text
http://127.0.0.1:5000
```
