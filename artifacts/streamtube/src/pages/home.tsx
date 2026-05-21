import { useYtTrending } from "@workspace/api-client-react";
import { VideoCard } from "@/components/video-card";
import { Flame } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function Home() {
  const { data: trending, isLoading, isError } = useYtTrending();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <Flame className="w-5 h-5" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Trending Now</h1>
      </div>

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
          <p>Failed to load trending videos.</p>
          <p className="text-sm">Please try again later.</p>
        </div>
      )}

      {trending?.results && trending.results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 gap-y-10">
          {trending.results.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </div>
  );
}
