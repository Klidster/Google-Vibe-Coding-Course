# Google News CLI 📰

A elegant, lightweight, and premium Node.js command-line interface tool to fetch the latest news from Google News instantly.

No API keys are required as it parses the official Google News RSS feed directly.

---

## ⚡ Features
- **Top Headlines**: Get the latest breaking news by default.
- **Search**: Search for articles using any keywords or phrases.
- **Topic Filtering**: Filter stories by popular sections: `world`, `nation`, `business`, `technology`, `entertainment`, `sports`, `science`, `health`.
- **Customizable limit**: Define the exact number of articles you want to see.
- **Detailed Snippets**: Show related articles and coverage details using the `--details` flag.
- **Aesthetic Terminal Design**: Beautifully colored, padded output using `chalk` with relative-time calculations.

---

## 🚀 Installation & Setup

Ensure you have [Node.js](https://nodejs.org/) installed (v16+ recommended).

1. Clone or copy the files into a folder.
2. Install the package dependencies:
   ```bash
   npm install
   ```
3. (Optional) Make the command globally available:
   ```bash
   npm link
   ```
   Now you can run the tool using `google-news` from anywhere!

---

## 🛠️ Usage

```bash
# Get top headlines (default is 10)
node index.js

# If linked, run globally:
google-news
```

### Options

| Flag | Description | Default / Allowed Values |
| --- | --- | --- |
| `-s, --search <query>` | Search query to look up | - |
| `-t, --topic <topic>` | Fetch news for specific topic | `world`, `nation`, `business`, `technology`, `entertainment`, `sports`, `science`, `health` |
| `-l, --limit <number>` | Limit the number of news items displayed | `10` |
| `-d, --details` | Show article description/snippet and related coverage | `false` |
| `-h, --help` | Display options and help menu | - |

---

## 💡 Examples

Fetch **5** technology stories:
```bash
node index.js -t technology -l 5
```

Search for stories about **"artificial intelligence"** with descriptions:
```bash
node index.js -s "artificial intelligence" -l 3 -d
```

Get top **business** headlines:
```bash
node index.js -t business
```

---

## 📄 License
ISC License.
