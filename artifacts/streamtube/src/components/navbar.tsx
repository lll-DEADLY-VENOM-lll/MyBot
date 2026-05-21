import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Search, Youtube } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

export function Navbar() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setLocation(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto px-4 h-16 flex items-center gap-4 md:gap-8">
        <Link href="/" className="flex items-center gap-2 text-primary hover:opacity-90 transition-opacity shrink-0">
          <Youtube className="w-8 h-8" />
          <span className="font-bold text-xl tracking-tight hidden sm:block text-foreground">StreamTube</span>
        </Link>
        
        <div className="flex-1 flex justify-center max-w-2xl mx-auto">
          <form onSubmit={handleSearch} className="w-full relative flex items-center">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search videos..."
              className="w-full bg-secondary/50 border-secondary-foreground/10 focus-visible:ring-primary rounded-full pl-5 pr-12 h-10 shadow-inner"
            />
            <Button 
              type="submit" 
              size="icon"
              variant="ghost" 
              className="absolute right-1 w-8 h-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-transparent"
            >
              <Search className="w-4 h-4" />
            </Button>
          </form>
        </div>
        
        <div className="shrink-0 w-8 sm:w-28" /> {/* Spacer for centering */}
      </div>
    </header>
  );
}
