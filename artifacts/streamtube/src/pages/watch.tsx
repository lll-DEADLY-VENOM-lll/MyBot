import { useSearch } from "wouter";
import { useYtStream, getYtStreamQueryKey, useYtSearch, getYtSearchQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Download, AlertCircle } from "lucide-react";
import { VideoCard } from "@/components/video-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function Watch() {
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const id = searchParams.get("v") || "";

  const { data: streamInfo, isLoading: isStreamLoading, isError: isStreamError } = useYtStream(
    { id },
    { query: { enabled: !!id, queryKey: getYtStreamQueryKey({ id }), retry: false } }
  );

  // We use search with the current title or ID to find related videos
  const relatedQuery = streamInfo?.title ? streamInfo.title.split(" ").slice(0, 3).join(" ") : "music";
  const { data: relatedVideos, isLoading: isRelatedLoading } = useYtSearch(
    { q: relatedQuery, max: 15 },
    { query: { enabled: !!streamInfo?.title, queryKey: getYtSearchQueryKey({ q: relatedQuery, max: 15 }) } }
  );

  const handleDownload = () => {
    if (!id) return;
    const link = document.createElement("a");
    link.href = `/api/yt/download?id=${id}`;
    link.download = streamInfo?.title ?? id;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!id) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">No video selected</h1>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-[1600px]">
      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Main Content Area */}
        <div className="flex-1 lg:max-w-[70%] xl:max-w-[75%]">
          {/* Player */}
          <div className="aspect-video w-full bg-black rounded-xl overflow-hidden shadow-xl ring-1 ring-border relative">
            <iframe
              src={`https://www.youtube.com/embed/${id}?autoplay=1`}
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full border-0"
            />
          </div>

          {/* Video Info */}
          <div className="mt-6">
            {isStreamLoading ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-8 w-3/4 bg-secondary/50" />
                <Skeleton className="h-6 w-1/4 bg-secondary/50" />
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex-1">
                  <h1 className="text-xl md:text-2xl font-bold text-foreground leading-tight">
                    {streamInfo?.title || "Unknown Title"}
                  </h1>
                </div>
                <div className="shrink-0 flex items-center gap-3">
                  <Button 
                    size="lg" 
                    onClick={handleDownload}
                    disabled={!streamInfo?.stream || isStreamLoading || isStreamError}
                    className="w-full sm:w-auto font-semibold rounded-full shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Download Audio
                  </Button>
                </div>
              </div>
            )}

            {isStreamError && (
              <Alert variant="destructive" className="mt-4 bg-destructive/10 border-destructive/20 text-destructive-foreground">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  {streamInfo?.error || "Could not load stream information. The video might be restricted."}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        {/* Sidebar / Related Videos */}
        <div className="w-full lg:w-[30%] xl:w-[25%] flex flex-col gap-4">
          <h3 className="font-semibold text-lg border-b border-border pb-2">Related Videos</h3>
          
          <div className="flex flex-col gap-4">
            {isRelatedLoading || !streamInfo?.title ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="w-40 aspect-video rounded-lg shrink-0 bg-secondary/50" />
                  <div className="flex flex-col gap-2 w-full">
                    <Skeleton className="h-4 w-full bg-secondary/50" />
                    <Skeleton className="h-3 w-1/2 bg-secondary/50" />
                  </div>
                </div>
              ))
            ) : (
              relatedVideos?.results?.filter(v => v.id !== id).map(video => (
                <a 
                  key={video.id} 
                  href={`/watch?v=${video.id}`}
                  className="flex gap-3 group hover:bg-secondary/20 p-2 -mx-2 rounded-xl transition-colors cursor-pointer"
                >
                  <div className="relative w-40 aspect-video rounded-lg overflow-hidden shrink-0 bg-muted/30">
                    <img 
                      src={video.thumb || `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`} 
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 text-white text-[10px] font-medium rounded">
                      {video.duration}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 py-0.5">
                    <h4 className="text-sm font-medium leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                      {video.title}
                    </h4>
                    <span className="text-xs text-muted-foreground line-clamp-1">{video.channel}</span>
                    <span className="text-[10px] text-muted-foreground">{video.views}</span>
                  </div>
                </a>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
