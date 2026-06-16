/**
 * BigQuery Release Notes Hub - Frontend Logic
 * Vanilla JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
    // State Variables
    let releaseNotes = [];
    let filteredNotes = [];
    let activeTypeFilter = 'all';
    let activeTagFilter = null;
    let activeSearchQuery = '';
    let sortOrder = 'desc'; // 'desc' = Newest First, 'asc' = Oldest First
    let searchDebounceTimeout = null;

    // Predefined keywords to extract from release notes
    const TARGET_KEYWORDS = [
        { term: 'Gemini', regex: /\b(Gemini|Cloud Assist|Code Assist)\b/i, label: 'Gemini AI' },
        { term: 'SQL', regex: /\b(SQL|queries|query|syntax)\b/i, label: 'SQL' },
        { term: 'ML', regex: /\b(ML|Machine Learning|AI\.KEY_DRIVERS|AI)\b/i, label: 'BigQuery ML' },
        { term: 'Security', regex: /\b(security|encryption|credentials|IAM|permission|access|authorized)\b/i, label: 'Security' },
        { term: 'Studio', regex: /\b(Studio|workspace|console|Jobs explorer|Job history)\b/i, label: 'BigQuery Studio' },
        { term: 'Performance', regex: /\b(performance|optimize|capacity|monitoring|execution)\b/i, label: 'Performance' },
        { term: 'Storage', regex: /\b(storage|datasets|tables|partition|clustering|object tables|ObjectRef)\b/i, label: 'Storage' },
        { term: 'Quotas', regex: /\b(quotas|limit|billing|cost|usage)\b/i, label: 'Quotas & Cost' },
        { term: 'Preview', regex: /\b(Preview)\b/i, label: 'Preview' },
        { term: 'GA', regex: /\b(Generally Available|GA)\b/i, label: 'GA' },
        { term: 'API', regex: /\b(API|client library|python|java|nodejs|endpoint)\b/i, label: 'API & Clients' },
        { term: 'External', regex: /\b(external|federated|connection|objectref)\b/i, label: 'External Sources' }
    ];

    // DOM Elements
    const elements = {
        notesFeed: document.getElementById('notes-feed'),
        searchInput: document.getElementById('search-input'),
        searchClearBtn: document.getElementById('search-clear-btn'),
        filterButtons: document.querySelectorAll('.filter-btn'),
        sortOrderBtn: document.getElementById('sort-order-btn'),
        sortLabel: document.getElementById('sort-label'),
        sortIcon: document.getElementById('sort-icon'),
        refreshBtn: document.getElementById('refresh-btn'),
        refreshIcon: document.querySelector('.refresh-icon'),
        themeToggle: document.getElementById('theme-toggle'),
        emptyState: document.getElementById('empty-state'),
        errorState: document.getElementById('error-state'),
        errorMessage: document.getElementById('error-message'),
        retryBtn: document.getElementById('retry-btn'),
        clearSearchBtnEmpty: document.getElementById('clear-search-btn-empty'),
        scrollTopBtn: document.getElementById('scroll-top-btn'),
        
        // Stats
        statTotal: document.getElementById('stat-total'),
        statFeatures: document.getElementById('stat-features'),
        statIssues: document.getElementById('stat-issues'),
        statChanges: document.getElementById('stat-changes'),
        
        // Sidebar / Tag Cloud
        keywordTags: document.getElementById('keyword-tags'),
        feedStatus: document.getElementById('feed-status'),
        lastCheckedTime: document.getElementById('last-checked-time'),
        
        // Active Filters Bar
        activeFiltersBar: document.getElementById('active-filters-bar'),
        activeTagsList: document.getElementById('active-tags-list'),
        resetAllFiltersBtn: document.getElementById('reset-all-filters-btn')
    };

    // Initialize Theme
    initTheme();
    // Fetch Data
    fetchReleaseNotes();

    // ==========================================================================
    // Core Functions - Data Fetching & Extraction
    // ==========================================================================

    async function fetchReleaseNotes(forceRefresh = false) {
        setLoadingState(true);
        elements.errorState.style.display = 'none';
        elements.emptyState.style.display = 'none';
        
        if (forceRefresh) {
            elements.refreshIcon.classList.add('spinning');
            elements.refreshBtn.disabled = true;
        }

        try {
            const response = await fetch(`/api/release-notes${forceRefresh ? '?refresh=true' : ''}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            
            if (result.success) {
                releaseNotes = processNotes(result.data);
                
                // Update Feed Info Panel
                elements.feedStatus.textContent = result.is_fresh ? 'Live Synced' : 'Cached';
                elements.feedStatus.className = 'meta-value';
                
                const lastFetchedDate = new Date(result.last_fetched * 1000);
                elements.lastCheckedTime.textContent = lastFetchedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                // Calculate Stats and Tag Cloud
                calculateStats(releaseNotes);
                renderTagCloud();

                // Apply current filters
                filterAndSortNotes();
            } else {
                throw new Error(result.error || 'Failed to fetch release notes');
            }
        } catch (error) {
            console.error('Error fetching release notes:', error);
            elements.errorMessage.textContent = error.message || 'Unable to load feed data.';
            elements.notesFeed.innerHTML = '';
            elements.errorState.style.display = 'flex';
            elements.feedStatus.textContent = 'Offline';
            elements.feedStatus.className = 'meta-value text-issue';
        } finally {
            setLoadingState(false);
            if (forceRefresh) {
                elements.refreshIcon.classList.remove('spinning');
                elements.refreshBtn.disabled = false;
            }
        }
    }

    function processNotes(rawNotes) {
        // Map raw notes and extract keywords and standardize types
        return rawNotes.map(dayEntry => {
            const parsedItems = dayEntry.items.map(item => {
                const textContent = item.content.replace(/<[^>]*>/g, ' '); // Strip HTML tags to scan text
                
                // Extract matching tags
                const tags = [];
                TARGET_KEYWORDS.forEach(kw => {
                    if (kw.regex.test(textContent) || kw.regex.test(item.type)) {
                        tags.push(kw.term);
                    }
                });

                // Standardize types for easier filtering (Feature, Issue, Change, Deprecation)
                let stdType = 'other';
                const typeLower = item.type.toLowerCase();
                if (typeLower.includes('feature')) stdType = 'feature';
                else if (typeLower.includes('issue') || typeLower.includes('bug')) stdType = 'issue';
                else if (typeLower.includes('change')) stdType = 'change';
                else if (typeLower.includes('deprecation')) stdType = 'deprecation';

                return {
                    ...item,
                    stdType,
                    tags
                };
            });

            return {
                ...dayEntry,
                items: parsedItems
            };
        });
    }

    function setLoadingState(isLoading) {
        if (isLoading) {
            elements.notesFeed.innerHTML = `
                <div class="loading-state">
                    <div class="skeleton-card glass-panel">
                        <div class="skeleton-header"></div>
                        <div class="skeleton-line width-90"></div>
                        <div class="skeleton-line width-80"></div>
                        <div class="skeleton-line width-60"></div>
                    </div>
                    <div class="skeleton-card glass-panel">
                        <div class="skeleton-header"></div>
                        <div class="skeleton-line width-80"></div>
                        <div class="skeleton-line width-70"></div>
                    </div>
                    <div class="skeleton-card glass-panel">
                        <div class="skeleton-header"></div>
                        <div class="skeleton-line width-75"></div>
                        <div class="skeleton-line width-50"></div>
                    </div>
                </div>
            `;
        }
    }

    // ==========================================================================
    // Stats & Tag Cloud Management
    // ==========================================================================

    function calculateStats(notes) {
        let totalItems = 0;
        let features = 0;
        let issues = 0;
        let changes = 0;

        notes.forEach(day => {
            day.items.forEach(item => {
                totalItems++;
                if (item.stdType === 'feature') features++;
                else if (item.stdType === 'issue') issues++;
                else if (item.stdType === 'change') changes++;
            });
        });

        // Animate counter values
        animateCounter(elements.statTotal, totalItems);
        animateCounter(elements.statFeatures, features);
        animateCounter(elements.statIssues, issues);
        animateCounter(elements.statChanges, changes);
    }

    function animateCounter(element, targetValue) {
        let current = 0;
        const duration = 800; // ms
        const increment = targetValue / (duration / 16); // 60fps
        const timer = setInterval(() => {
            current += increment;
            if (current >= targetValue) {
                element.textContent = targetValue;
                clearInterval(timer);
            } else {
                element.textContent = Math.floor(current);
            }
        }, 16);
    }

    function renderTagCloud() {
        const tagCounts = {};
        
        // Count keyword frequency
        releaseNotes.forEach(day => {
            day.items.forEach(item => {
                item.tags.forEach(tag => {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                });
            });
        });

        // Convert counts to tag cloud elements
        elements.keywordTags.innerHTML = '';
        
        if (Object.keys(tagCounts).length === 0) {
            elements.keywordTags.innerHTML = '<span class="loading-tag">No tags found</span>';
            return;
        }

        // Sort tags by frequency descending
        const sortedTags = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]);

        sortedTags.forEach(tag => {
            const kwDef = TARGET_KEYWORDS.find(k => k.term === tag);
            const label = kwDef ? kwDef.label : tag;
            const count = tagCounts[tag];
            
            const tagEl = document.createElement('span');
            tagEl.className = `cloud-tag ${activeTagFilter === tag ? 'active' : ''}`;
            tagEl.dataset.tag = tag;
            tagEl.innerHTML = `
                <span>${label}</span>
                <span class="tag-count">${count}</span>
            `;
            
            tagEl.addEventListener('click', () => {
                toggleTagFilter(tag);
            });

            elements.keywordTags.appendChild(tagEl);
        });
    }

    // ==========================================================================
    // Filtering, Sorting, Rendering
    // ==========================================================================

    function toggleTagFilter(tag) {
        if (activeTagFilter === tag) {
            activeTagFilter = null; // Unselect
        } else {
            activeTagFilter = tag; // Select
        }
        
        // Re-render tag cloud to update active classes
        renderTagCloud();
        // Re-filter notes
        filterAndSortNotes();
    }

    function filterAndSortNotes() {
        filteredNotes = [];

        releaseNotes.forEach(dayEntry => {
            const matchingItems = dayEntry.items.filter(item => {
                // 1. Filter by Standard Type Category (Feature, Issue, etc)
                if (activeTypeFilter !== 'all' && item.stdType !== activeTypeFilter) {
                    return false;
                }

                // 2. Filter by Tag Cloud Keyword
                if (activeTagFilter && !item.tags.includes(activeTagFilter)) {
                    return false;
                }

                // 3. Filter by Search Query
                if (activeSearchQuery) {
                    const textToSearch = `${item.type} ${item.content}`.toLowerCase();
                    const words = activeSearchQuery.toLowerCase().split(/\s+/).filter(w => w);
                    // Match ALL words of search query (AND search)
                    return words.every(word => textToSearch.includes(word));
                }

                return true;
            });

            if (matchingItems.length > 0) {
                filteredNotes.push({
                    ...dayEntry,
                    items: matchingItems
                });
            }
        });

        // Sort the release dates
        filteredNotes.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        });

        // Update active filter warning bar
        updateActiveFiltersBar();

        // Render notes list
        renderNotesFeed();
    }

    function updateActiveFiltersBar() {
        const hasFilters = activeTypeFilter !== 'all' || activeTagFilter !== null || activeSearchQuery !== '';
        
        if (hasFilters) {
            elements.activeFiltersBar.style.display = 'flex';
            elements.activeTagsList.innerHTML = '';

            // Add Search Tag
            if (activeSearchQuery) {
                addActiveFilterTag(`Search: "${activeSearchQuery}"`, () => {
                    elements.searchInput.value = '';
                    activeSearchQuery = '';
                    elements.searchClearBtn.style.display = 'none';
                    filterAndSortNotes();
                });
            }

            // Add Category Tag
            if (activeTypeFilter !== 'all') {
                const categoryNames = {
                    feature: 'Features',
                    issue: 'Issues',
                    change: 'Changes',
                    deprecation: 'Deprecations'
                };
                addActiveFilterTag(`Category: ${categoryNames[activeTypeFilter]}`, () => {
                    activeTypeFilter = 'all';
                    elements.filterButtons.forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.type === 'all');
                    });
                    filterAndSortNotes();
                });
            }

            // Add Keyword Tag
            if (activeTagFilter) {
                const kwDef = TARGET_KEYWORDS.find(k => k.term === activeTagFilter);
                const label = kwDef ? kwDef.label : activeTagFilter;
                addActiveFilterTag(`Keyword: ${label}`, () => {
                    activeTagFilter = null;
                    renderTagCloud();
                    filterAndSortNotes();
                });
            }
        } else {
            elements.activeFiltersBar.style.display = 'none';
        }
    }

    function addActiveFilterTag(label, removeCallback) {
        const tag = document.createElement('div');
        tag.className = 'active-tag';
        tag.innerHTML = `
            <span>${label}</span>
            <button class="active-tag-remove">&times;</button>
        `;
        tag.querySelector('.active-tag-remove').addEventListener('click', removeCallback);
        elements.activeTagsList.appendChild(tag);
    }

    function highlightText(text, searchWord) {
        if (!searchWord) return text;
        
        // Escape regex special chars
        const escapedWord = searchWord.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`(${escapedWord})`, 'gi');
        
        // Replace matches that are NOT inside HTML tags to avoid breaking markup
        // This is a simple safe html highlighter replacing text occurrences in text nodes
        return text.replace(regex, '<mark>$1</mark>');
    }

    function highlightSearchTerms(htmlContent, searchString) {
        if (!searchString) return htmlContent;
        
        // Split search query by space to highlight individual words
        const words = searchString.split(/\s+/).filter(w => w.length > 1);
        if (words.length === 0) return htmlContent;

        let highlighted = htmlContent;
        
        // We parse the HTML elements safely using a DOM parser to avoid corrupting tags
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;

        // Traverse and highlight text nodes only
        function traverseAndHighlight(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                let text = node.textContent;
                let hasChanges = false;
                
                // Highlight words
                words.forEach(word => {
                    const escapedWord = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                    const regex = new RegExp(`\\b(${escapedWord})\\b`, 'gi');
                    if (regex.test(text)) {
                        text = text.replace(regex, '___MARK_START___$1___MARK_END___');
                        hasChanges = true;
                    }
                });

                if (hasChanges) {
                    const wrapper = document.createElement('span');
                    // Escape basic html inside text, then apply highlighting tags
                    let safeHtml = text
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/___MARK_START___/g, '<mark>')
                        .replace(/___MARK_END___/g, '</mark>');
                    wrapper.innerHTML = safeHtml;
                    node.parentNode.replaceChild(wrapper, node);
                }
            } else {
                // Recursively process child nodes
                const children = Array.from(node.childNodes);
                children.forEach(traverseAndHighlight);
            }
        }

        traverseAndHighlight(tempDiv);
        return tempDiv.innerHTML;
    }

    function renderNotesFeed() {
        elements.notesFeed.innerHTML = '';
        
        if (filteredNotes.length === 0) {
            elements.emptyState.style.display = 'flex';
            return;
        }

        elements.emptyState.style.display = 'none';

        filteredNotes.forEach(day => {
            // Create a Date Group container
            const dateGroup = document.createElement('div');
            dateGroup.className = 'date-group';
            
            // Add timeline elements
            dateGroup.innerHTML = `
                <div class="date-marker"></div>
                <div class="date-header">
                    <div class="date-title">
                        <span>${day.date}</span>
                        <span class="date-sub">${day.items.length} ${day.items.length === 1 ? 'update' : 'updates'}</span>
                    </div>
                </div>
                <div class="date-items"></div>
            `;

            const itemsContainer = dateGroup.querySelector('.date-items');

            // Render release cards for this day
            day.items.forEach(item => {
                const noteCard = document.createElement('div');
                noteCard.className = `note-card border-${item.stdType}`;
                
                // Highlight search term matches inside card content
                const highlightedContent = highlightSearchTerms(item.content, activeSearchQuery);
                const highlightedType = highlightText(item.type, activeSearchQuery);

                // Build note card layout
                noteCard.innerHTML = `
                    <div class="note-header">
                        <span class="note-badge badge-${item.stdType}">${highlightedType}</span>
                        <div class="note-card-meta">
                            <a href="${day.link}" target="_blank" rel="noopener noreferrer" class="external-link" title="Open official release notes section">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"></path>
                                </svg>
                            </a>
                        </div>
                    </div>
                    <div class="note-content">
                        ${highlightedContent}
                    </div>
                `;

                // If note has tag metadata, render tag badges at bottom of card
                if (item.tags.length > 0) {
                    const tagsContainer = document.createElement('div');
                    tagsContainer.className = 'note-tags';
                    
                    item.tags.forEach(tag => {
                        const kwDef = TARGET_KEYWORDS.find(k => k.term === tag);
                        const label = kwDef ? kwDef.label : tag;
                        
                        const tagBadge = document.createElement('span');
                        tagBadge.className = `card-tag ${activeTagFilter === tag ? 'active' : ''}`;
                        tagBadge.textContent = label;
                        tagBadge.addEventListener('click', (e) => {
                            e.stopPropagation(); // Avoid triggering card events if any
                            toggleTagFilter(tag);
                        });
                        tagsContainer.appendChild(tagBadge);
                    });
                    noteCard.appendChild(tagsContainer);
                }

                itemsContainer.appendChild(noteCard);
            });

            elements.notesFeed.appendChild(dateGroup);
        });
    }

    // ==========================================================================
    // Event Handlers & Subscriptions
    // ==========================================================================

    // Search bar input with debounce
    elements.searchInput.addEventListener('input', (e) => {
        const value = e.target.value;
        elements.searchClearBtn.style.display = value ? 'block' : 'none';

        clearTimeout(searchDebounceTimeout);
        searchDebounceTimeout = setTimeout(() => {
            activeSearchQuery = value.trim();
            filterAndSortNotes();
        }, 250); // 250ms debounce
    });

    // Clear search button in input
    elements.searchClearBtn.addEventListener('click', () => {
        elements.searchInput.value = '';
        elements.searchClearBtn.style.display = 'none';
        activeSearchQuery = '';
        filterAndSortNotes();
        elements.searchInput.focus();
    });

    // Clear search button in empty state
    elements.clearSearchBtnEmpty.addEventListener('click', resetAllFilters);
    elements.resetAllFiltersBtn.addEventListener('click', resetAllFilters);

    function resetAllFilters() {
        elements.searchInput.value = '';
        elements.searchClearBtn.style.display = 'none';
        activeSearchQuery = '';
        activeTagFilter = null;
        activeTypeFilter = 'all';
        elements.filterButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === 'all');
        });
        renderTagCloud();
        filterAndSortNotes();
    }

    // Category filter buttons
    elements.filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            elements.filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            activeTypeFilter = button.dataset.type;
            filterAndSortNotes();
        });
    });

    // Sort order button
    elements.sortOrderBtn.addEventListener('click', () => {
        if (sortOrder === 'desc') {
            sortOrder = 'asc';
            elements.sortLabel.textContent = 'Oldest First';
            elements.sortOrderBtn.setAttribute('data-order', 'asc');
        } else {
            sortOrder = 'desc';
            elements.sortLabel.textContent = 'Newest First';
            elements.sortOrderBtn.setAttribute('data-order', 'desc');
        }
        filterAndSortNotes();
    });

    // Refresh feed button
    elements.refreshBtn.addEventListener('click', () => {
        fetchReleaseNotes(true);
    });

    // Error state retry button
    elements.retryBtn.addEventListener('click', () => {
        fetchReleaseNotes();
    });

    // Back to top scroll button logic
    window.addEventListener('scroll', () => {
        if (window.scrollY > 400) {
            elements.scrollTopBtn.classList.add('visible');
        } else {
            elements.scrollTopBtn.classList.remove('visible');
        }
    });

    elements.scrollTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // ==========================================================================
    // Theme Management (Light / Dark Mode)
    // ==========================================================================

    function initTheme() {
        const storedTheme = localStorage.getItem('theme');
        // Check system preference if no stored theme
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (storedTheme === 'light') {
            setLightMode();
        } else if (storedTheme === 'dark' || systemPrefersDark) {
            setDarkMode();
        } else {
            setDarkMode(); // Default fallback
        }

        elements.themeToggle.addEventListener('click', () => {
            if (document.body.classList.contains('dark-theme')) {
                setLightMode();
            } else {
                setDarkMode();
            }
        });
    }

    function setDarkMode() {
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
        localStorage.setItem('theme', 'dark');
    }

    function setLightMode() {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
        localStorage.setItem('theme', 'light');
    }
});
