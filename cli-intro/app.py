import time
import re
import requests
import feedparser
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Cache configuration
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_EXPIRY = 600  # 10 minutes cache
cache = {
    "data": None,
    "last_fetched": 0
}

def parse_summary(summary_html):
    """
    Splits the XML summary HTML of a feed entry into separate release items by <h3>.
    For example: <h3>Feature</h3> <p>...</p> <h3>Issue</h3> <p>...</p>
    Returns a list of dicts: [{'type': 'Feature', 'content': '<p>...</p>'}]
    """
    if not summary_html:
        return []
    
    # Split by h3 tag, case-insensitive
    parts = re.split(r'(?i)<h3>(.*?)</h3>', summary_html)
    
    items = []
    # If split was successful, parts[0] is everything before first <h3> (usually empty or whitespace)
    # The subsequent elements come in pairs: [type, content, type, content, ...]
    if len(parts) > 1:
        for i in range(1, len(parts), 2):
            if i + 1 < len(parts):
                item_type = parts[i].strip()
                item_content = parts[i + 1].strip()
                # Clean up empty paragraphs or trailing whitespaces
                if item_content:
                    items.append({
                        "type": item_type,
                        "content": item_content
                    })
    else:
        # Fallback if no <h3> tags were found, treat whole summary as a single generic update
        items.append({
            "type": "Update",
            "content": summary_html.strip()
        })
        
    return items

def fetch_and_parse_feed(force_refresh=False):
    """
    Fetches the RSS feed from Google Cloud, parses it, and structures the release notes.
    """
    now = time.time()
    if not force_refresh and cache["data"] is not None and (now - cache["last_fetched"] < CACHE_EXPIRY):
        return cache["data"], False  # Return cached data, is_fresh=False

    try:
        response = requests.get(FEED_URL, timeout=10)
        response.raise_for_status()
        
        parsed_feed = feedparser.parse(response.text)
        
        # Check if we got valid entries
        if not parsed_feed.entries:
            raise ValueError("No entries found in feed")
            
        release_notes = []
        for entry in parsed_feed.entries:
            title = entry.get("title", "Unknown Date")
            link = entry.get("link", "")
            updated = entry.get("updated", "")
            entry_id = entry.get("id", "")
            summary = entry.get("summary", "")
            
            # Parse the summary HTML into structured sub-items
            items = parse_summary(summary)
            
            release_notes.append({
                "date": title,
                "updated": updated,
                "link": link,
                "id": entry_id,
                "items": items
            })
            
        # Update cache
        cache["data"] = release_notes
        cache["last_fetched"] = now
        return release_notes, True  # Fresh data
        
    except Exception as e:
        print(f"Error fetching or parsing feed: {e}")
        # If fetch fails, return cache if available, otherwise raise exception
        if cache["data"] is not None:
            return cache["data"], False
        raise e

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    try:
        # Check if user requested a force refresh (e.g. ?refresh=true)
        force_refresh = request.args.get('refresh', 'false').lower() == 'true'
        
        notes, is_fresh = fetch_and_parse_feed(force_refresh=force_refresh)
        return jsonify({
            "success": True,
            "is_fresh": is_fresh,
            "last_fetched": cache["last_fetched"],
            "data": notes
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
