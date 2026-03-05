import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { MapPin, Loader2, Search, X, ExternalLink } from 'lucide-react';

interface NominatimResult {
  place_id: number;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  name: string;
  display_name: string;
  class: string;
  type: string;
}

interface CourseResult {
  name: string;
  location: string;
  lat: number;
  lon: number;
}

interface CourseSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (course: CourseResult) => void;
  placeholder?: string;
  className?: string;
}

/** Parse a Nominatim display_name into a short human-readable location */
function parseLocation(displayName: string, courseName: string): string {
  // display_name is comma-separated: "Course Name, Street, City, County, State, ZIP, Country"
  const parts = displayName
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p !== courseName && p.length > 0);

  // Find city/state/country — skip street numbers, zip codes, county names
  const meaningful = parts.filter((p) => !/^\d+$/.test(p) && p.length > 2);

  if (meaningful.length === 0) return '';

  // Return up to 3 parts: city, state, country (skip long county strings)
  const short = meaningful
    .filter((p) => !p.toLowerCase().includes('county') || meaningful.length <= 2)
    .slice(0, 3);

  return short.join(', ');
}

export function CourseSearch({ value, onChange, onSelect, placeholder, className }: CourseSearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<CourseResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value changes (e.g. on clear)
  useEffect(() => {
    if (value !== query) setQuery(value);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const searchCourses = useCallback(async (q: string) => {
    if (q.trim().length < 3) {
      setResults([]);
      setIsOpen(false);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setHasSearched(false);

    try {
      // Nominatim: search for golf courses specifically
      const params = new URLSearchParams({
        q: `${q} golf course`,
        format: 'json',
        limit: '8',
        featuretype: 'settlement',
      });

      // Use CORS proxy
      const url = `https://proxy.shakespeare.diy/?url=${encodeURIComponent(
        `https://nominatim.openstreetmap.org/search?${params}&addressdetails=0`
      )}`;

      const res = await fetch(url, {
        headers: { 'Accept-Language': 'en' },
      });

      if (!res.ok) throw new Error('Search failed');

      const data: NominatimResult[] = await res.json();

      // Filter to golf-related results and deduplicate by name
      const seen = new Set<string>();
      const courses: CourseResult[] = [];

      for (const item of data) {
        const isGolf =
          item.class === 'leisure' && item.type === 'golf_course';
        const hasGolfInName =
          item.name.toLowerCase().includes('golf') ||
          item.name.toLowerCase().includes('country club') ||
          item.name.toLowerCase().includes('links');

        if (!isGolf && !hasGolfInName) continue;
        if (!item.name) continue;

        const key = item.name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        courses.push({
          name: item.name,
          location: parseLocation(item.display_name, item.name),
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
        });
      }

      // If we got nothing from strict filter, try looser match
      if (courses.length === 0) {
        for (const item of data) {
          if (!item.name) continue;
          const key = item.name.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          courses.push({
            name: item.name,
            location: parseLocation(item.display_name, item.name),
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
          });
        }
      }

      setResults(courses);
      setIsOpen(true);
      setHasSearched(true);
      setSelectedIndex(-1);
    } catch {
      setResults([]);
      setHasSearched(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => searchCourses(val), 400);
  };

  const handleSelect = (course: CourseResult) => {
    setQuery(course.name);
    onChange(course.name);
    setIsOpen(false);
    setResults([]);
    onSelect?.(course);
  };

  const handleClear = () => {
    setQuery('');
    onChange('');
    setResults([]);
    setIsOpen(false);
    setHasSearched(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder={placeholder ?? 'Search for a golf course...'}
          className="pl-9 pr-9"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          ) : query ? (
            <button
              type="button"
              onClick={handleClear}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full bg-popover border border-border rounded-xl shadow-xl overflow-hidden">
          {results.length > 0 ? (
            <ul className="max-h-64 overflow-y-auto py-1">
              {results.map((course, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()} // prevent blur before click
                    onClick={() => handleSelect(course)}
                    className={cn(
                      'w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-accent transition-colors',
                      i === selectedIndex && 'bg-accent'
                    )}
                  >
                    <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{course.name}</div>
                      {course.location && (
                        <div className="text-xs text-muted-foreground truncate">{course.location}</div>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : hasSearched ? (
            <div className="px-4 py-5 text-center space-y-1.5">
              <p className="text-sm text-muted-foreground">No courses found for "{query}"</p>
              <p className="text-xs text-muted-foreground">
                You can still type a course name manually.
              </p>
            </div>
          ) : null}

          {/* Attribution */}
          {results.length > 0 && (
            <div className="border-t border-border px-3 py-1.5 flex items-center justify-end gap-1">
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                onMouseDown={(e) => e.stopPropagation()}
              >
                © OpenStreetMap contributors
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
