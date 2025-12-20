'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Star, GitFork, Zap, Calendar, Code, 
  ExternalLink, ArrowUpRight, Github, 
  Filter, Search, Layers, Activity, AlertCircle,
  TrendingUp, Sun, Moon, X, Info, MessageSquare,
  Languages, ArrowLeft, RefreshCw, Database,
  ChevronDown, Flame
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// API Configuration - Backend URL for direct API calls
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Repository {
  name: string;
  full_name: string;
  description: string;
  stars: number;
  forks: number;
  language: string;
  url: string;
  created_at: string;
  days_old: number;
  open_issues: number;
  topics: string[];
  
  // NEW: Velocity metrics (time-series based)
  velocity_metrics: {
    stars_7d: number;
    stars_30d: number;
    stars_90d: number;
    velocity_7d: number;
    velocity_30d: number;
    velocity_90d: number;
    acceleration_7d_vs_30d: number;
    acceleration_30d_vs_90d: number;
    forks_7d: number;
    forks_30d: number;
    trend: 'viral' | 'accelerating' | 'steady' | 'decelerating' | 'cooling' | 'new';
    intent_score: number;
  };
}

interface AnalysisData {
  total_repos: number;
  avg_velocity_7d: number;
  avg_velocity_30d: number;
  trends: { [key: string]: number };
  viral_count: number;
  accelerating_count: number;
}

interface DashboardData {
  sector: string;
  timestamp: string;
  repos: Repository[];
  analysis: AnalysisData;
  metadata: {
    search_date: string;
    days_back: number;
    min_stars: number;
    count: number;
    page?: number;
    has_more?: boolean;
    tracking_mode?: string;
  };
}

const SECTORS = [
  { id: 'all', name: 'All Sectors', icon: Layers, keywords: [] },
  { id: 'ai', name: 'AI & ML', icon: Activity, keywords: ['ai', 'llm', 'machine-learning', 'deep-learning', 'neural', 'gpt', 'agent'] },
  { id: 'finance', name: 'FinTech', icon: TrendingUp, keywords: ['fintech', 'crypto', 'blockchain', 'defi', 'trading', 'payment'] },
  { id: 'health', name: 'HealthTech', icon: Activity, keywords: ['health', 'medical', 'healthcare', 'biotech', 'fitness', 'wellness'] },
  { id: 'devtools', name: 'DevTools', icon: Code, keywords: ['developer', 'devops', 'ci-cd', 'testing', 'deployment', 'docker'] },
  { id: 'security', name: 'Security', icon: Zap, keywords: ['security', 'cybersecurity', 'encryption', 'auth', 'privacy'] },
  { id: 'web3', name: 'Web3', icon: Zap, keywords: ['web3', 'ethereum', 'solidity', 'nft', 'dao', 'smart-contract'] },
  { id: 'data', name: 'Data', icon: Layers, keywords: ['data', 'analytics', 'visualization', 'database', 'etl', 'pipeline'] },
  { id: 'mobile', name: 'Mobile', icon: Layers, keywords: ['mobile', 'ios', 'android', 'react-native', 'flutter'] },
];

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [readme, setReadme] = useState<string | null>(null);
  const [originalReadme, setOriginalReadme] = useState<string | null>(null);
  const [readmeLoading, setReadmeLoading] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [showReadme, setShowReadme] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [timeHorizon, setTimeHorizon] = useState<number | null>(null); // null = show all repos
  const [semanticQuery, setSemanticQuery] = useState('');
  const [isSearchingSemantic, setIsSearchingSemantic] = useState(false);
  const [sortBy, setSortBy] = useState<'trend' | 'velocity_7d' | 'velocity_30d' | 'stars' | 'forks'>('trend');
  const [isSubscribeModalOpen, setIsSubscribeModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [subscribeStatus, setSubscribeStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const fetchTrackerData = useCallback(async (targetPage = 1) => {
    if (targetPage === 1) {
    setLoading(true);
      setPage(1);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }
    
    setError(null);
    setIsSearchingSemantic(false);
    setSemanticQuery('');
    try {
      const params = new URLSearchParams({
        limit: '50',
        page: targetPage.toString(),
        sort_by: sortBy,
        _t: Date.now().toString() // Cache breaker
      });
      if (selectedSector !== 'all') params.append('sector', selectedSector);
      if (timeHorizon) params.append('time_horizon', timeHorizon.toString());
      if (selectedTag) params.append('tag', selectedTag);
      
      const res = await fetch(`${API_URL}/api/repos?${params.toString()}`, {
        cache: 'no-store', // Disable Next.js data cache
        headers: {
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        },
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errData.error || `HTTP ${res.status}: Failed to fetch data`);
      }
      const jsonData = await res.json();
      
      // Validate response structure
      if (!jsonData || !Array.isArray(jsonData.repos)) {
        throw new Error('Invalid response format from server');
      }
      
      if (targetPage === 1) {
      setData(jsonData);
      } else {
        setData(prev => {
          if (!prev) return jsonData;
          return {
            ...prev,
            repos: [...prev.repos, ...jsonData.repos],
            metadata: jsonData.metadata
          };
        });
      }

      setHasMore(jsonData.metadata?.has_more ?? jsonData.repos.length === 50);
      setPage(targetPage);
    } catch (err: any) {
      console.error('Error loading data:', err);
      let errorMessage = 'Failed to connect to tracker';
      
      if (err.name === 'AbortError' || err.name === 'TimeoutError') {
        errorMessage = 'Request timed out. The server might be busy.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      if (targetPage === 1) {
      setError(errorMessage);
      setData(null);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [sortBy, selectedSector, timeHorizon, selectedTag]); // All active filters as dependencies

  useEffect(() => {
    if (selectedRepo) {
      setReadmeLoading(true);
      setReadme(null);
      setOriginalReadme(null);
      setIsTranslating(false);
      setShowReadme(false);
      fetch(`${API_URL}/api/readme?fullName=${selectedRepo.full_name}`)
      .then(res => res.json())
      .then(data => {
          const content = data.markdown || 'Could not load README.';
          setReadme(content);
          setOriginalReadme(content);
          setReadmeLoading(false);
      })
      .catch(err => {
          console.error('Error fetching README:', err);
          setReadme('Failed to load README content.');
          setReadmeLoading(false);
        });
    }
  }, [selectedRepo]);

  const handleTranslate = async () => {
    if (!readme || isTranslating) return;
    
    setIsTranslating(true);
    try {
      const res = await fetch(`${API_URL}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: readme })
      });
      
      const data = await res.json();
      if (data.translatedText) {
        setReadme(data.translatedText);
      } else {
        throw new Error('Translation failed');
      }
    } catch (err) {
      console.error('Translation error:', err);
      alert('Translation failed. Please try again later.');
    } finally {
      setIsTranslating(false);
    }
  };

  const resetTranslation = () => {
    setReadme(originalReadme);
    setIsTranslating(false);
  };

  const handleForceUpdate = async () => {
    if (isUpdating) return;
    
    const confirmed = confirm('This will trigger a full database sync. It may take 2-5 minutes. Continue?');
    if (!confirmed) return;
    
    setIsUpdating(true);
    setError(null);
    
    try {
      const res = await fetch(`${API_URL}/api/update`, { 
        method: 'POST',
        signal: AbortSignal.timeout(180000) // 3 minute timeout
      });
      const data = await res.json();
      
      if (data.success) {
        alert('✅ Update triggered successfully! Refreshing data in 2 minutes...');
        // Auto-refresh after 2 minutes
        setTimeout(() => {
          fetchTrackerData(1);
          setIsUpdating(false);
        }, 120000);
      } else {
        throw new Error(data.error || 'Failed to trigger update');
      }
    } catch (err: any) {
      console.error('Update error:', err);
      const errorMsg = err.name === 'TimeoutError' 
        ? 'Update request timed out. Check the server logs.'
        : 'Failed to start update. Please try again.';
      alert(`❌ ${errorMsg}`);
      setIsUpdating(false);
      setError(errorMsg);
    }
  };

  const handleForceBackfill = async () => {
    if (isBackfilling) return;
    
    const confirmBackfill = confirm("⚠️ This will start a 1-year deep scan covering all sectors.\n\n⏱️ Estimated time: 5-10 minutes\n💰 This will use GitHub API quota and Groq credits\n\nProceed?");
    if (!confirmBackfill) return;

    setIsBackfilling(true);
    setError(null);
    
    try {
      const res = await fetch(`${API_URL}/api/backfill`, { 
        method: 'POST',
        signal: AbortSignal.timeout(600000) // 10 minute timeout
      });
      const data = await res.json();
      
      if (data.success) {
        alert(`✅ ${data.message}\n\nThe backfill is running in the background. Check back in 5-10 minutes.`);
        // Automatically refresh after 5 minutes
        setTimeout(() => {
          fetchTrackerData(1);
          setIsBackfilling(false);
        }, 300000);
      } else {
        throw new Error(data.error || 'Failed to trigger backfill');
      }
    } catch (err: any) {
      console.error('Backfill error:', err);
      const errorMsg = err.name === 'TimeoutError'
        ? 'Backfill request timed out. It may still be running on the server.'
        : 'Failed to start backfill. Check server logs.';
      alert(`❌ ${errorMsg}`);
      setIsBackfilling(false);
      setError(errorMsg);
    }
  };

  const handleSemanticSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!semanticQuery.trim()) return;

    setLoading(true);
    setIsSearchingSemantic(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_URL}/api/search/semantic?q=${encodeURIComponent(semanticQuery)}`,
        { signal: AbortSignal.timeout(30000) }
      );
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errData.error || 'Semantic search failed');
      }
      
      const jsonData = await res.json();
      
      if (!jsonData.repos || !Array.isArray(jsonData.repos)) {
        throw new Error('Invalid response from semantic search');
      }
      
      // Calculate real analytics for semantic results
      const repos = jsonData.repos;
      const avgVel7d = repos.length > 0 
        ? repos.reduce((sum: number, r: any) => sum + (r.velocity_metrics?.velocity_7d || 0), 0) / repos.length 
        : 0;
      const avgVel30d = repos.length > 0
        ? repos.reduce((sum: number, r: any) => sum + (r.velocity_metrics?.velocity_30d || 0), 0) / repos.length
        : 0;
      
      // Count trends
      const trends: { [key: string]: number } = {};
      repos.forEach((r: any) => {
        const trend = r.velocity_metrics?.trend || 'unknown';
        trends[trend] = (trends[trend] || 0) + 1;
      });
      
      // We wrap the semantic results in a structure that matches DashboardData
      setData({
        sector: 'semantic-search',
        timestamp: new Date().toISOString(),
        repos: repos,
        analysis: {
          total_repos: repos.length,
          avg_velocity_7d: avgVel7d,
          avg_velocity_30d: avgVel30d,
          trends: trends,
          viral_count: trends['viral'] || 0,
          accelerating_count: trends['accelerating'] || 0
        },
        metadata: {
          search_date: new Date().toISOString(),
          days_back: 0,
          min_stars: 0,
          count: repos.length
        }
      });
    } catch (err: any) {
      console.error('Semantic search error:', err);
      let errorMessage = 'Semantic search is currently unavailable.';
      
      if (err.name === 'AbortError' || err.name === 'TimeoutError') {
        errorMessage = 'Search timed out. Please try again.';
      } else if (err.message.includes('Weaviate')) {
        errorMessage = 'Semantic search database is not running. Ensure Weaviate is configured.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || subscribeLoading) return;

    setSubscribeLoading(true);
    setSubscribeStatus(null);

    try {
      const res = await fetch(`${API_URL}/api/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });

      const jsonData = await res.json();

      if (res.ok) {
        setSubscribeStatus({ type: 'success', message: 'You are on the list!' });
        setEmail('');
      } else {
        throw new Error(jsonData.error || 'Subscription failed');
      }
    } catch (err: any) {
      setSubscribeStatus({ type: 'error', message: err.message });
    } finally {
      setSubscribeLoading(false);
    }
  };

  useEffect(() => {
    // Fetch data whenever filters change
    fetchTrackerData(1);
  }, [selectedSector, sortBy, timeHorizon, selectedTag, fetchTrackerData]);

  if (loading && !data) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
        <div className="flex flex-col items-center gap-4">
          <div className={`w-12 h-12 border-4 rounded-full animate-spin ${theme === 'dark' ? 'border-zinc-800 border-t-blue-500' : 'border-zinc-200 border-t-blue-600'}`}></div>
          <p className={`${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'} font-medium tracking-tight`}>Analyzing GitHub Velocity...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
        <div className={`max-w-md mx-4 p-8 rounded-3xl border ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-lg'}`}>
          <div className="flex flex-col items-center gap-6 text-center">
            <div className={`p-4 rounded-2xl ${theme === 'dark' ? 'bg-red-500/10' : 'bg-red-50'}`}>
              <AlertCircle size={32} className="text-red-500" />
            </div>
            <div>
              <h3 className="text-xl font-black mb-2">Connection Error</h3>
              <p className={`text-sm ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'} mb-4`}>{error}</p>
            </div>
            <button
              onClick={() => fetchTrackerData(1)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-sm transition-all active:scale-95"
            >
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data || !Array.isArray(data.repos)) return null;

  // For semantic search, we just display the results as-is
  // For regular browsing, backend handles all filtering (sector, tag, time_horizon, sort)
  const displayedRepos = data.repos.filter(repo => {
    if (!repo) return false;
    // Hide low-relevancy noise identified by AI
    if ((repo as any).relevancy_score === 0) return false;
    return true;
  });

  const getSectorCount = (sectorId: string, keywords: string[]) => {
    if (!data || !Array.isArray(data.repos)) return 0;
    
    // Count repos matching this sector
    if (sectorId === 'all') return data.repos.length;
    
    return data.repos.filter(repo => {
      if (!repo) return false;
      const text = `${repo.name || ''} ${repo.description || ''} ${(repo.topics || []).join(' ')}`.toLowerCase();
      return keywords.some(kw => text.includes(kw.toLowerCase()));
    }).length;
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${theme === 'dark' ? 'bg-zinc-950 text-zinc-100' : 'bg-white text-zinc-900'} selection:bg-blue-500/30 font-sans`}>
      {/* Navbar */}
      <nav className={`border-b sticky top-0 z-50 backdrop-blur-xl ${theme === 'dark' ? 'border-zinc-900 bg-zinc-950/50' : 'border-zinc-100 bg-white/80'}`}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
          <div 
            className="flex items-center gap-2 cursor-pointer shrink-0" 
            onClick={() => {
              setSelectedRepo(null);
              setShowReadme(false);
              fetchTrackerData(1);
            }}
          >
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Zap size={18} className="text-white fill-white" />
            </div>
            <span className="font-bold text-lg tracking-tight hidden md:inline">Velocity Radar.</span>
          </div>

          {/* Semantic Search Bar - Commented Out
          <div className="flex-1 max-w-xl">
            <form onSubmit={handleSemanticSearch} className="relative group">
              <Search className={`absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 transition-colors ${theme === 'dark' ? 'text-zinc-600 group-focus-within:text-blue-500' : 'text-zinc-300 group-focus-within:text-blue-600'}`} size={14} />
              <input
                type="text"
                value={semanticQuery}
                onChange={(e) => setSemanticQuery(e.target.value)}
                placeholder="Search..."
                className={`w-full pl-9 sm:pl-11 pr-4 py-2 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-medium transition-all outline-none border ${
                  theme === 'dark' 
                    ? 'bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500/50 focus:bg-zinc-900/80' 
                    : 'bg-zinc-50 border-zinc-100 text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500/30 focus:bg-white focus:shadow-sm'
                }`}
              />
              {isSearchingSemantic && (
                <button 
                  type="button"
                  onClick={() => fetchTrackerData(1)}
                  className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                >
                  <X size={12} className="text-zinc-500" />
                </button>
              )}
            </form>
          </div>
          */}

          <div className="flex items-center gap-1 sm:gap-2 md:gap-4 shrink-0">
            <button 
              onClick={handleForceBackfill}
              disabled={isBackfilling}
              className={`p-1.5 sm:p-2 rounded-lg transition-all ${
                isBackfilling 
                  ? 'animate-pulse text-amber-500' 
                  : theme === 'dark' ? 'text-zinc-400 hover:text-white hover:bg-zinc-900' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
              title="1-Year Deep Backfill"
            >
              <Database size={18} />
            </button>
            <button 
              onClick={handleForceUpdate}
              disabled={isUpdating}
              className={`p-1.5 sm:p-2 rounded-lg transition-all ${
                isUpdating 
                  ? 'animate-spin text-blue-500' 
                  : theme === 'dark' ? 'text-zinc-400 hover:text-white hover:bg-zinc-900' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
              title="Force Database Sync"
            >
              <RefreshCw size={18} />
            </button>
            
            <button 
              onClick={() => setIsSubscribeModalOpen(true)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                theme === 'dark' 
                  ? 'bg-blue-600/10 border-blue-500/30 text-blue-400 hover:bg-blue-600/20' 
                  : 'bg-blue-50 border-blue-100 text-blue-600 hover:bg-blue-100 shadow-sm'
              }`}
            >
              <span className="hidden sm:inline">Stay Notified</span>
            </button>

            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`p-1.5 sm:p-2 rounded-lg transition-colors ${theme === 'dark' ? 'text-zinc-400 hover:text-white hover:bg-zinc-900' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'}`}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* GitHub Link - Commented Out
            <a href="https://github.com/tharunmarella/gitHubVelocityTracker" target="_blank" className={`p-1.5 sm:p-2 transition-colors hidden xs:block ${theme === 'dark' ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}>
              <Github size={18} />
            </a>
            */}
          </div>
        </div>
      </nav>

      {selectedRepo ? (
        <main className="max-w-7xl mx-auto px-4 py-6 sm:py-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-8 sm:mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6 sm:gap-8">
            <div className="flex items-center gap-4 sm:gap-6">
              <button 
                onClick={() => {
                  setSelectedRepo(null);
                  setShowReadme(false);
                }}
                className={`p-3 sm:p-4 rounded-2xl sm:rounded-3xl border transition-all ${
                  theme === 'dark' ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700' : 'bg-white border-zinc-100 text-zinc-500 hover:text-zinc-900 hover:border-zinc-200 shadow-sm'
                }`}
              >
                <ArrowLeft size={20} className="sm:size-6" />
              </button>
              <div>
                <div className="flex items-center gap-3 sm:gap-4 mb-1">
                  <h1 className="text-2xl sm:text-4xl font-black tracking-tight">{selectedRepo.name}</h1>
                  <a 
                    href={selectedRepo.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl border transition-all ${
                      theme === 'dark' ? 'bg-zinc-900 border-zinc-800 text-zinc-600 hover:text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-400 hover:text-zinc-900'
                    }`}
                  >
                    <ExternalLink size={14} className="sm:size-[18px]" />
                  </a>
                </div>
                <p className={`text-[10px] sm:text-base font-bold uppercase tracking-widest sm:tracking-[0.2em] ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  {selectedRepo.full_name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              <div className={`px-4 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl border flex flex-col items-center min-w-[100px] sm:min-w-[120px] ${theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-blue-50/50 border-blue-100'}`}>
                <span className={`text-[8px] sm:text-[10px] font-black uppercase tracking-widest mb-0.5 sm:mb-1 ${theme === 'dark' ? 'text-zinc-600' : 'text-blue-400'}`}>7d Velocity</span>
                <span className="text-xl sm:text-2xl font-black text-blue-500">{selectedRepo.velocity_metrics?.velocity_7d?.toFixed(1) || '0.0'}<span className="text-xs ml-1">★/d</span></span>
        </div>
              <div className={`px-4 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl border flex flex-col items-center min-w-[100px] sm:min-w-[120px] ${
                selectedRepo.velocity_metrics?.trend === 'viral' ? 'bg-red-50 border-red-200' :
                selectedRepo.velocity_metrics?.trend === 'accelerating' ? 'bg-green-50 border-green-200' :
                theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-50/50 border-zinc-100'
              }`}>
                <span className={`text-[8px] sm:text-[10px] font-black uppercase tracking-widest mb-0.5 sm:mb-1 ${theme === 'dark' ? 'text-zinc-600' : 'text-zinc-400'}`}>Trend</span>
                <span className="text-xl sm:text-2xl font-black capitalize">
                  {selectedRepo.velocity_metrics?.trend === 'viral' && '🔥'}
                  {selectedRepo.velocity_metrics?.trend === 'accelerating' && '🚀'}
                  {selectedRepo.velocity_metrics?.trend === 'steady' && '📊'}
                  {selectedRepo.velocity_metrics?.trend === 'decelerating' && '📉'}
                  {selectedRepo.velocity_metrics?.trend === 'new' && '✨'}
                  {selectedRepo.velocity_metrics?.trend === 'cooling' && '❄️'}
                </span>
        </div>
              <a 
                href={selectedRepo.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-[9px] sm:text-[10px] transition-all shadow-lg shadow-blue-500/20 active:scale-95 flex items-center gap-2"
              >
                <Github size={14} className="sm:size-4" />
                View Source
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 sm:gap-16">
            <div className="space-y-8 sm:space-y-12">
              <div className={`p-6 sm:p-10 rounded-[2rem] sm:rounded-[2.5rem] border ${theme === 'dark' ? 'bg-zinc-900/20 border-zinc-900' : 'bg-zinc-50 border-zinc-100'}`}>
                <h4 className={`text-[10px] font-black uppercase tracking-[0.4em] mb-6 sm:mb-10 flex items-center gap-3 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  <Activity size={16} />
                  Momentum Data
                </h4>
                <div className="space-y-6 sm:space-y-10">
                  <div className="grid grid-cols-1 sm:grid-cols-1 gap-6 sm:gap-10">
                    <div>
                      <div className={`text-[10px] font-black uppercase tracking-widest mb-2 sm:mb-3 ${theme === 'dark' ? 'text-zinc-600' : 'text-zinc-400'}`}>7-Day Velocity</div>
                      <div className="text-3xl sm:text-4xl font-black tabular-nums tracking-tighter">{selectedRepo.velocity_metrics?.velocity_7d?.toFixed(1) || '0.0'} <span className="text-xs sm:text-sm text-zinc-500 lowercase font-bold tracking-normal">★/day</span></div>
                      <div className={`text-[10px] mt-1 ${theme === 'dark' ? 'text-zinc-600' : 'text-zinc-400'}`}>+{selectedRepo.velocity_metrics?.stars_7d || 0} stars gained</div>
                    </div>
                    <div>
                      <div className={`text-[10px] font-black uppercase tracking-widest mb-2 sm:mb-3 ${theme === 'dark' ? 'text-zinc-600' : 'text-zinc-400'}`}>30-Day Velocity</div>
                      <div className="text-3xl sm:text-4xl font-black tabular-nums tracking-tighter">{selectedRepo.velocity_metrics?.velocity_30d?.toFixed(1) || '0.0'} <span className="text-xs sm:text-sm text-zinc-500 lowercase font-bold tracking-normal">★/day</span></div>
                      <div className={`text-[10px] mt-1 ${theme === 'dark' ? 'text-zinc-600' : 'text-zinc-400'}`}>+{selectedRepo.velocity_metrics?.stars_30d || 0} stars gained</div>
                    </div>
                    <div>
                      <div className={`text-[10px] font-black uppercase tracking-widest mb-2 sm:mb-3 ${theme === 'dark' ? 'text-zinc-600' : 'text-zinc-400'}`}>Trend</div>
                      <div className="text-3xl sm:text-4xl font-black capitalize tracking-tighter">
                        {selectedRepo.velocity_metrics?.trend || 'unknown'}
                        <span className="text-xs sm:text-sm ml-2">
                          {selectedRepo.velocity_metrics?.trend === 'viral' && '🔥'}
                          {selectedRepo.velocity_metrics?.trend === 'accelerating' && '🚀'}
                          {selectedRepo.velocity_metrics?.trend === 'steady' && '📊'}
                          {selectedRepo.velocity_metrics?.trend === 'decelerating' && '📉'}
                          {selectedRepo.velocity_metrics?.trend === 'new' && '✨'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`p-6 sm:p-10 rounded-[2rem] sm:rounded-[2.5rem] border ${theme === 'dark' ? 'bg-zinc-900/20 border-zinc-900' : 'bg-zinc-50 border-zinc-100'}`}>
                <h4 className={`text-[10px] font-black uppercase tracking-[0.4em] mb-6 sm:mb-8 flex items-center gap-3 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  <Layers size={16} />
                  Contextual Tags
                </h4>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {selectedRepo.topics.map(topic => (
                    <span key={topic} className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-bold border transition-all lowercase ${
                      theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700' : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300 shadow-sm'
                    }`}>
                      #{topic}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6 sm:space-y-8">
              <div className="flex items-center justify-between gap-4">
                <div className={`flex items-center gap-2 sm:gap-3 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  <MessageSquare size={16} className="sm:size-[18px]" />
                  <h4 className="text-[10px] font-black uppercase tracking-[0.4em]">Market Breakdown</h4>
                </div>
                
                <button 
                  onClick={() => setShowReadme(!showReadme)}
                  className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl transition-all border shrink-0 ${
                    showReadme 
                      ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20' 
                      : theme === 'dark' ? 'text-zinc-400 border-zinc-800 hover:text-white bg-zinc-900/50' : 'text-zinc-500 border-zinc-200 hover:text-zinc-900 bg-white shadow-sm'
                  }`}
                >
                  {showReadme ? 'AI Summary' : 'README'}
                </button>
              </div>

              <div className={`rounded-[2rem] sm:rounded-[3rem] border shadow-sm min-h-[400px] sm:min-h-[600px] overflow-hidden ${
                theme === 'dark' 
                  ? 'bg-zinc-900/10 border-zinc-900' 
                  : 'bg-zinc-50/20 border-zinc-100'
              }`}>
                {!showReadme ? (
                  <div className="p-6 sm:p-10 md:p-16 space-y-6 sm:space-y-8">
                    <div className={`inline-block px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                      AI Market Intelligence
                    </div>
                    <div className={`prose prose-sm sm:prose-base lg:prose-lg max-w-none ${theme === 'dark' ? 'prose-invert' : ''}`}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {(selectedRepo as any).market_summary || 'Market analysis is currently being generated. Please trigger a manual sync to populate this data.'}
                      </ReactMarkdown>
                    </div>
                    <div className="pt-6 sm:pt-8 border-t border-zinc-100 dark:border-zinc-900">
                      <p className={`text-[8px] sm:text-[10px] ${theme === 'dark' ? 'text-zinc-600' : 'text-zinc-400'} uppercase font-black tracking-widest`}>
                        Generated by GPT-OSS 120B • Comprehensive Analysis
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className={`prose prose-sm sm:prose-base lg:prose-lg max-w-none p-6 sm:p-10 md:p-16 ${
                    theme === 'dark' ? 'prose-invert' : ''
                  }`}>
                    {readmeLoading ? (
                      <div className="flex flex-col items-center justify-center py-24 sm:py-48 gap-6 sm:gap-8">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-zinc-800 border-t-blue-500 rounded-full animate-spin"></div>
                        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-500 animate-pulse text-center">Scanning Documentation...</p>
                      </div>
                    ) : (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {readme || ''}
                      </ReactMarkdown>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      ) : (
        <main className="max-w-7xl mx-auto px-4 py-6 sm:py-12 animate-in fade-in duration-700">
          <div className="mb-12 sm:mb-20">
            <div className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-6 ${theme === 'dark' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
              GitHub Trend Radar
            </div>
            <h1 className={`text-4xl sm:text-7xl font-black tracking-tighter mb-6 leading-[1.1] ${
              theme === 'dark' 
                ? 'bg-gradient-to-br from-white via-zinc-200 to-zinc-600 bg-clip-text text-transparent' 
                : 'bg-gradient-to-br from-zinc-900 via-zinc-800 to-blue-600 bg-clip-text text-transparent'
            }`}>
              Spot the next big thing.
            </h1>
            <p className={`${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'} text-lg sm:text-xl max-w-2xl font-medium leading-relaxed`}>
              Tracking the fastest-growing open source projects and decoding developer intent in real-time.
            </p>
        </div>

          <div className="flex flex-col lg:flex-row gap-8 sm:gap-12 items-start">
            <div className="w-full lg:w-72 lg:sticky lg:top-24 space-y-6 sm:space-y-8">
              <div className={`border p-4 sm:p-6 rounded-3xl ${theme === 'dark' ? 'bg-zinc-900/20 border-zinc-800/50' : 'bg-zinc-50 border-zinc-100'}`}>
                <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 sm:mb-6 flex items-center gap-2 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  <Filter size={14} />
                  Focus Sector
                </h4>
                <div className="flex lg:flex-col overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 gap-2 scrollbar-hide -mx-2 px-2 lg:mx-0 lg:px-0">
                  {SECTORS.map(sector => (
                    <button
                      key={sector.id}
                      onClick={() => {
                        setSelectedSector(sector.id);
                        setSelectedTag(null);
                      }}
                      className={`flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-bold transition-all shrink-0 lg:shrink ${
                        selectedSector === sector.id 
                          ? (theme === 'dark' ? 'bg-blue-600/10 text-blue-500 border border-blue-500/20 shadow-lg shadow-blue-500/5' : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20')
                          : (theme === 'dark' ? 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300 border border-transparent' : 'text-zinc-500 hover:bg-white hover:text-zinc-900 border border-transparent')
                      }`}
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <sector.icon size={14} className="sm:size-4" />
                        <span className="whitespace-nowrap">{sector.name}</span>
                      </div>
                      <span className={`text-[9px] sm:text-[10px] tabular-nums ml-2 ${
                        selectedSector === sector.id 
                          ? (theme === 'dark' ? 'text-blue-400' : 'text-blue-100')
                          : (theme === 'dark' ? 'text-zinc-700' : 'text-zinc-300')
                      }`}>
                        {getSectorCount(sector.id, sector.keywords)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className={`border p-4 sm:p-6 rounded-3xl ${theme === 'dark' ? 'bg-zinc-900/20 border-zinc-800/50' : 'bg-zinc-50 border-zinc-100'}`}>
                <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 sm:mb-6 flex items-center justify-between ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  <div className="flex items-center gap-2">
                    <Search size={14} />
                    Discovery Tags
                  </div>
                  {selectedTag && (
                    <button 
                      onClick={() => setSelectedTag(null)}
                      className="text-[8px] font-black text-blue-500 hover:underline cursor-pointer"
                    >
                      CLEAR
                    </button>
                  )}
                </h4>
                <div className="flex flex-wrap lg:flex-wrap overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 gap-2 scrollbar-hide -mx-1 px-1 lg:mx-0 lg:px-0">
                  {Array.from(new Set(
                    data.repos.flatMap(repo => {
                      if (!repo) return [];
                      return [
                        ...(Array.isArray(repo.topics) ? repo.topics : []),
                        ...(Array.isArray((repo as any).market_tags) ? (repo as any).market_tags : [])
                      ];
                    })
                  )).slice(0, 15).map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                      className={`px-3 py-1.5 rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-all border shrink-0 ${
                        selectedTag === tag
                          ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                          : theme === 'dark' 
                            ? 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white' 
                            : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-900'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              </div>

            <div className="flex-1 space-y-4 w-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between px-2 mb-4 sm:mb-6 gap-4">
                <div>
                  <h3 className={`text-xs sm:text-sm font-black uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    {isSearchingSemantic ? `Results for: "${semanticQuery}"` : 'Trending Repositories'}
                  </h3>
                </div>

                <div className={`flex items-center p-1 rounded-xl border self-start sm:self-auto ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-100'}`}>
                  {[
                    { label: 'ALL', value: null },
                    { label: '30D', value: 30 },
                    { label: '6M', value: 180 },
                    { label: '1Y', value: 365 },
                  ].map((window) => (
                    <button
                      key={window.value || 'all'}
                      onClick={() => setTimeHorizon(window.value)}
                      className={`px-3 sm:px-4 py-1.5 rounded-lg text-[9px] sm:text-[10px] font-black tracking-widest transition-all ${
                        timeHorizon === window.value
                          ? 'bg-blue-600 text-white shadow-sm'
                          : theme === 'dark' ? 'text-zinc-600 hover:text-white' : 'text-zinc-400 hover:text-zinc-900'
                      }`}
                    >
                      {window.label}
                    </button>
                  ))}
            </div>
          </div>

              {/* Sort By - Modern Segmented Control */}
              <div className={`border p-4 sm:p-6 rounded-3xl ${theme === 'dark' ? 'bg-zinc-900/20 border-zinc-800/50' : 'bg-zinc-50 border-zinc-100'}`}>
                <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  <TrendingUp size={14} />
                  Sort Strategy
                </h4>
                
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'trend', label: 'Trending', icon: Flame },
                    { id: 'velocity_7d', label: '7D Growth', icon: Zap },
                    { id: 'velocity_30d', label: '30D Growth', icon: Activity },
                    { id: 'stars', label: 'Top Stars', icon: Star },
                    { id: 'forks', label: 'Most Forked', icon: GitFork },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setSortBy(option.id as any)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border ${
                        sortBy === option.id
                          ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20 scale-[1.02]'
                          : theme === 'dark'
                            ? 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                            : 'bg-white border-zinc-200 text-zinc-400 hover:border-zinc-300 hover:text-zinc-600'
                      }`}
                    >
                      <option.icon size={14} className={sortBy === option.id ? 'text-white' : 'text-current'} />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {displayedRepos.length === 0 ? (
                <div className={`border p-12 sm:p-20 rounded-[2rem] sm:rounded-[3rem] text-center flex flex-col items-center justify-center ${theme === 'dark' ? 'bg-zinc-900/10 border-zinc-900' : 'bg-zinc-50/50 border-zinc-100 shadow-inner'}`}>
                  <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mb-6 ${theme === 'dark' ? 'bg-zinc-950' : 'bg-white shadow-sm'}`}>
                    <Database size={24} className={theme === 'dark' ? 'text-zinc-800' : 'text-zinc-200'} />
                  </div>
                  <h4 className="text-lg sm:text-xl font-black tracking-tight mb-2">No Projects Detected</h4>
                  <p className={`max-w-xs mx-auto text-xs sm:text-sm font-medium leading-relaxed mb-8 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    The database is currently empty. Trigger a **Deep Scan** or **Daily Sync** to begin discovery.
                  </p>
                  <button 
                    onClick={handleForceUpdate}
                    disabled={isUpdating}
                    className="px-6 sm:px-8 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-3"
                  >
                    {isUpdating ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} className="fill-white" />}
                    Initialize Discovery
                  </button>
                </div>
              ) : (
                displayedRepos.map((repo, idx) => (
              <div 
                key={repo.full_name} 
                    onClick={() => setSelectedRepo(repo)}
                    className={`group border transition-all p-5 sm:p-8 rounded-[2rem] sm:rounded-3xl relative overflow-hidden cursor-pointer ${
                      theme === 'dark' 
                        ? 'bg-zinc-900/10 border-zinc-900 hover:border-zinc-800 hover:bg-zinc-900/30' 
                        : 'bg-white border-zinc-100 hover:border-zinc-200 hover:shadow-xl hover:shadow-zinc-200/20'
                    }`}
                  >
                    <div className="absolute top-0 right-0 p-5 sm:p-8">
                  <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-1.5">
                          <TrendingUp size={14} className="text-blue-500 sm:size-4" />
                          <span className={`text-xl sm:text-3xl font-black tabular-nums tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                            {repo.velocity_metrics?.velocity_7d?.toFixed(1) || '0.0'}
                    </span>
                        </div>
                        <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-zinc-600' : 'text-zinc-400'}`}>★/day (7d)</span>
                        
                        {/* Trend Badge */}
                        {repo.velocity_metrics?.trend && (
                          <div className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                            repo.velocity_metrics.trend === 'viral' ? 'bg-red-100 text-red-700' :
                            repo.velocity_metrics.trend === 'accelerating' ? 'bg-green-100 text-green-700' :
                            repo.velocity_metrics.trend === 'new' ? 'bg-blue-100 text-blue-700' :
                            'bg-zinc-100 text-zinc-600'
                          }`}>
                            {repo.velocity_metrics.trend === 'viral' && '🔥 VIRAL'}
                            {repo.velocity_metrics.trend === 'accelerating' && '🚀 HOT'}
                            {repo.velocity_metrics.trend === 'new' && '✨ NEW'}
                            {repo.velocity_metrics.trend === 'steady' && '📊'}
                            {repo.velocity_metrics.trend === 'decelerating' && '📉'}
                            {repo.velocity_metrics.trend === 'cooling' && '❄️'}
                          </div>
                        )}
                  </div>
                </div>

                    <div className="flex flex-col h-full lg:max-w-[calc(100%-140px)]">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3">
                        <div className={`px-1.5 py-0.5 rounded text-[8px] sm:text-[10px] font-black tracking-tighter ${theme === 'dark' ? 'bg-blue-500/10 text-blue-500' : 'bg-blue-50 text-blue-600'}`}>#{idx + 1}</div>
                        <h2 className={`text-lg sm:text-2xl font-black transition-colors tracking-tight ${theme === 'dark' ? 'group-hover:text-blue-400' : 'group-hover:text-blue-600'}`}>
                      {repo.name}
                    </h2>
                    <a 
                      href={repo.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                          className={`p-1 sm:p-1.5 rounded-lg border transition-all ${
                            theme === 'dark' 
                              ? 'bg-zinc-950 border-zinc-800 text-zinc-600 hover:text-white hover:border-zinc-700' 
                              : 'bg-zinc-50 border-zinc-200 text-zinc-400 hover:text-zinc-900 hover:border-zinc-300'
                          }`}
                        >
                          <ArrowUpRight size={12} className="sm:size-3.5" />
                    </a>
                  </div>
                  
                      <p className={`text-xs sm:text-sm mb-6 sm:mb-8 leading-relaxed font-medium line-clamp-2 max-w-2xl ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    {repo.description}
                  </p>

                      <div className="mt-auto flex flex-wrap items-center gap-x-4 sm:gap-x-6 gap-y-3 sm:gap-y-4">
                        <div className={`flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                          <Star size={12} className="text-yellow-500 sm:size-3.5" />
                          {(repo.stars || 0).toLocaleString()} <span className="hidden sm:inline lowercase text-zinc-700 dark:text-zinc-300">stars</span>
                    </div>
                        <div className={`flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                          <GitFork size={12} className={`sm:size-3.5 ${theme === 'dark' ? 'text-zinc-600' : 'text-zinc-400'}`} />
                          {(repo.forks || 0).toLocaleString()} <span className="hidden sm:inline lowercase text-zinc-700 dark:text-zinc-300">forks</span>
                    </div>
                        <div className={`flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                          <div className={`w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full bg-blue-500 ${theme === 'dark' ? 'shadow-[0_0_8px_rgba(59,130,246,0.5)]' : ''}`}></div>
                      {repo.language}
                    </div>
                        <div className={`flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                          <Calendar size={12} className={`sm:size-3.5 ${theme === 'dark' ? 'text-zinc-600' : 'text-zinc-400'}`} />
                          {repo.days_old}d
                    </div>
                  </div>
                </div>
              </div>
                ))
              )}

              {/* Infinite Scroll / Load More */}
              {hasMore && !isSearchingSemantic && (
                <div className="mt-12 flex flex-col items-center gap-4">
                  <button
                    onClick={() => fetchTrackerData(page + 1)}
                    disabled={loadingMore}
                    className={`px-8 py-4 rounded-[2rem] text-xs font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3 ${
                      theme === 'dark' 
                        ? 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white' 
                        : 'bg-zinc-100 border border-zinc-200 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900'
                    } ${loadingMore ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {loadingMore ? (
                      <>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                        Loading More...
                      </>
                    ) : (
                      <>
                        <ChevronDown size={16} />
                        Explore More
                      </>
                    )}
                  </button>
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-zinc-600' : 'text-zinc-400'}`}>
                    Showing {displayedRepos.length} results
                  </p>
                </div>
              )}

              {!hasMore && displayedRepos.length > 0 && (
                <div className="mt-12 text-center">
                  <p className={`text-[10px] font-bold uppercase tracking-[0.3em] ${theme === 'dark' ? 'text-zinc-700' : 'text-zinc-300'}`}>
                    You've reached the edge of the radar
                  </p>
                </div>
              )}
          </div>
        </div>
      </main>
      )}

      <footer className={`border-t py-16 transition-colors duration-300 ${theme === 'dark' ? 'border-zinc-900 bg-zinc-950' : 'border-zinc-100 bg-zinc-50'}`}>
        <div className="max-w-7xl mx-auto px-4 flex flex-col items-center text-center">
          <div className={`w-12 h-12 border rounded-2xl flex items-center justify-center mb-6 shadow-2xl ${
            theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
          }`}>
            <Zap size={24} className={theme === 'dark' ? 'text-zinc-600' : 'text-zinc-400'} />
          </div>
          <p className={`text-xs font-black uppercase tracking-[0.3em] mb-4 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
            GitHub Velocity Radar
          </p>
          <p className={`text-xs font-bold max-w-sm leading-loose ${theme === 'dark' ? 'text-zinc-600' : 'text-zinc-500'}`}>
            Spotting technological shifts and developer sentiment through growth analytics. Built for entrepreneurs and product thinkers.
          </p>
          <div className={`mt-8 pt-8 border-t w-full max-w-xs flex justify-center gap-6 ${theme === 'dark' ? 'border-zinc-900' : 'border-zinc-200'}`}>
            <a href="#" className={`transition-colors text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-zinc-600 hover:text-white' : 'text-zinc-400 hover:text-zinc-900'}`}>API</a>
            <a href="#" className={`transition-colors text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-zinc-600 hover:text-white' : 'text-zinc-400 hover:text-zinc-900'}`}>Trends</a>
            <a href="#" className={`transition-colors text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-zinc-600 hover:text-white' : 'text-zinc-400 hover:text-zinc-900'}`}>Github</a>
          </div>
        </div>
      </footer>

      {/* Newsletter Modal */}
      {isSubscribeModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className={`w-full max-w-md p-8 rounded-[2.5rem] border shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 ${
              theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-100'
            }`}
          >
            <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <MessageSquare size={24} className="text-white fill-white" />
              </div>
              <button 
                onClick={() => {
                  setIsSubscribeModalOpen(false);
                  setSubscribeStatus(null);
                }}
                className={`p-2 rounded-xl transition-colors ${theme === 'dark' ? 'hover:bg-zinc-800 text-zinc-500 hover:text-white' : 'hover:bg-zinc-100 text-zinc-400 hover:text-zinc-900'}`}
              >
                <X size={20} />
              </button>
            </div>

            <h3 className="text-2xl font-black tracking-tight mb-2">Stay Notified</h3>
            <p className={`text-sm font-medium leading-relaxed mb-8 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
              Join 2,400+ builders. Get the top 5 high-velocity projects delivered to your inbox every Monday morning.
            </p>

            <form onSubmit={handleSubscribe} className="space-y-4">
              <div>
                <label className={`block text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@email.com"
                  required
                  className={`w-full px-5 py-4 rounded-2xl text-sm font-bold outline-none transition-all border ${
                    theme === 'dark' 
                      ? 'bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-700 focus:border-blue-500/50' 
                      : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500/30'
                  }`}
                />
              </div>

              <button
                type="submit"
                disabled={subscribeLoading}
                className={`w-full py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                  subscribeLoading 
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-xl shadow-blue-500/20 active:scale-[0.98]'
                }`}
              >
                {subscribeLoading ? 'Processing...' : 'Secure My Spot'}
              </button>
            </form>

            {subscribeStatus && (
              <div className={`mt-6 p-4 rounded-2xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${
                subscribeStatus.type === 'success' 
                  ? 'bg-green-500/10 border-green-500/20 text-green-500' 
                  : 'bg-red-500/10 border-red-500/20 text-red-500'
              }`}>
                <Info size={16} />
                <p className="text-[11px] font-black uppercase tracking-wider">
                  {subscribeStatus.message}
                </p>
              </div>
            )}

            <p className={`mt-8 text-center text-[10px] font-bold ${theme === 'dark' ? 'text-zinc-600' : 'text-zinc-400'}`}>
              No spam. Unsubscribe anytime with one click.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
