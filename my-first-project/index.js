#!/usr/bin/env node

import Parser from 'rss-parser';
import { Command } from 'commander';
import chalk from 'chalk';

const parser = new Parser();
const program = new Command();

// Supported topics by Google News RSS
const TOPICS = {
  world: 'WORLD',
  nation: 'NATION',
  business: 'BUSINESS',
  technology: 'TECHNOLOGY',
  entertainment: 'ENTERTAINMENT',
  sports: 'SPORTS',
  science: 'SCIENCE',
  health: 'HEALTH'
};

program
  .name('google-news')
  .description('A premium CLI tool to get the latest news from Google News')
  .version('1.0.0')
  .option('-s, --search <query>', 'search for specific news articles')
  .option('-t, --topic <topic>', 'fetch news for a specific topic (world, nation, business, technology, entertainment, sports, science, health)')
  .option('-l, --limit <number>', 'limit the number of headlines to display', '10')
  .option('-d, --details', 'show article description/snippet if available', false)
  .addHelpText('after', `
Examples:
  $ google-news
  $ google-news -s "artificial intelligence"
  $ google-news -t technology -l 5
  $ google-news -t business --details
`);

program.parse(process.argv);
const options = program.opts();

// Parse and validate options
const limit = parseInt(options.limit, 10);
if (isNaN(limit) || limit <= 0) {
  console.error(chalk.red('Error: Limit must be a positive integer.'));
  process.exit(1);
}

let topicKey = null;
if (options.topic) {
  const normalized = options.topic.toLowerCase().trim();
  if (TOPICS[normalized]) {
    topicKey = TOPICS[normalized];
  } else {
    console.error(chalk.red(`Error: Invalid topic "${options.topic}".`));
    console.log(chalk.yellow(`Available topics: ${Object.keys(TOPICS).join(', ')}`));
    process.exit(1);
  }
}

// Build the RSS Feed URL
let url = 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en';

if (options.search) {
  const query = encodeURIComponent(options.search);
  url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
} else if (topicKey) {
  url = `https://news.google.com/rss/headlines/section/topic/${topicKey}?hl=en-US&gl=US&ceid=US:en`;
}

// Helper to format date relatively
function formatRelativeTime(dateString) {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    
    if (isNaN(date.getTime())) {
      return dateString; // Fallback to raw string
    }

    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'yesterday';
    return `${diffDays}d ago`;
  } catch (err) {
    return dateString;
  }
}

// Helper to create ANSI terminal hyperlinks if supported
function terminalLink(text, url) {
  // We will return a colored text link. Terminal hyperlinks are cool, but we also print the URL in gray
  // so it's always copyable/clickable in all terminals.
  return `${chalk.cyan.underline(text)}\n  ${chalk.gray(url)}`;
}

async function fetchNews() {
  // Beautiful header banner
  console.log('\n' + chalk.bgCyan.black.bold('  GOOGLE NEWS CLI  ') + '\n');
  
  if (options.search) {
    console.log(chalk.bold(`Search Query: "${chalk.cyan(options.search)}"`));
  } else if (topicKey) {
    console.log(chalk.bold(`Topic: ${chalk.cyan(options.topic.toUpperCase())}`));
  } else {
    console.log(chalk.bold('Top Headlines'));
  }
  console.log(chalk.dim('Fetching latest updates...\n'));

  try {
    const feed = await parser.parseURL(url);
    
    if (!feed.items || feed.items.length === 0) {
      console.log(chalk.yellow('No news items found.'));
      return;
    }

    const itemsToDisplay = feed.items.slice(0, limit);

    itemsToDisplay.forEach((item, index) => {
      const indexStr = chalk.cyan.bold(`${index + 1}.`);
      
      // Parse the title. Google News feeds titles usually end with " - Source Name"
      let title = item.title || 'No Title';
      let source = '';
      
      const lastDashIndex = title.lastIndexOf(' - ');
      if (lastDashIndex !== -1) {
        source = title.substring(lastDashIndex + 3).trim();
        title = title.substring(0, lastDashIndex).trim();
      }

      const timeAgo = formatRelativeTime(item.pubDate);
      const sourceBadge = source ? chalk.bgHex('#303030').hex('#A0A0A0')(` ${source} `) : '';
      const timeBadge = chalk.yellow(`(${timeAgo})`);

      console.log(`${indexStr} ${chalk.white.bold(title)}`);
      
      if (sourceBadge || timeBadge) {
        console.log(`   ${sourceBadge} ${timeBadge}`);
      }

      if (options.details && item.contentSnippet) {
        // Strip HTML tag entities if any
        const snippet = item.contentSnippet.replace(/&nbsp;/g, ' ').replace(/<[^>]*>?/gm, '');
        console.log(`   ${chalk.italic.gray(snippet)}`);
      }

      console.log(`   ${chalk.blue.underline(item.link)}\n`);
    });

    console.log(chalk.dim(`Displayed ${itemsToDisplay.length} of ${feed.items.length} articles.`));
  } catch (error) {
    console.error(chalk.red('Failed to fetch news. Please check your internet connection and try again.'));
    console.error(chalk.red(`Details: ${error.message}`));
  }
}

fetchNews();
