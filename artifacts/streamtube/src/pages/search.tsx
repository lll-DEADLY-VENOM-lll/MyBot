import { useSearch } from "wouter";
import { useYtSearch, getYtSearchQueryKey } from "@workspace/api-client-react";
import { VideoCard } from "@/components/video-card";
import { Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function SearchResults() {
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const q = searchParams.get("q") || "";

  const { data: searchResults, isLoading, isError } = useYtSearch(
    { q, max: 30 },
    { query: { enabled: !!q, queryKey: getYtSearchQueryKey({ q, max: 30 }) } }
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-xl font-medium text-muted-foreground">
          Results for <span className="font-bold text-foreground">"{q}"</span>
        </h1>
      </div>

      {!q && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Search className="w-12 h-12 mb-4 opacity-20" />
          <p>Enter a search term to find videos</p>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 gap-y-10">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-3">
              <Skeleton className="w-full aspect-video rounded-xl bg-secondary/50" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-full bg-secondary/50" />
                <Skeleton className="h-4 w-3/4 bg-secondary/50" />
                <Skeleton className="h-3 w-1/2 bg-secondary/50 mt-1" />
              </div>
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <p>Failed to load search results.</p>
        </div>
      )}

      {searchResults?.results && searchResults.results.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <p>No videos found for "{q}".</p>
        </div>
      )}

      {searchResults?.results && searchResults.results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 gap-y-10">
          {searchResults.results.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </div>
  );
}
