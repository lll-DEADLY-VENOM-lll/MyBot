import { Play } from "lucide-react";
import { Link } from "wouter";
import type { VideoItem } from "@workspace/api-client-react/src/generated/api.schemas";

export function VideoCard({ video }: { video: VideoItem }) {
  return (
    <Link href={`/watch?v=${video.id}`} className="group flex flex-col gap-3 cursor-pointer">
      <div className="relative aspect-video rounded-xl overflow-hidden bg-muted/30">
        <img
          src={video.thumb || `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`}
          alt={video.title}
          className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform duration-300">
            <Play className="w-5 h-5 text-white ml-1" />
          </div>
        </div>
        <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/80 text-white text-xs font-medium rounded">
          {video.duration}
        </div>
      </div>
      <div className="flex flex-col gap-1 px-1">
        <h3 className="font-semibold text-sm leading-tight line-clamp-2 text-foreground group-hover:text-primary transition-colors">
          {video.title}
        </h3>
        <div className="text-xs text-muted-foreground flex flex-col gap-0.5">
          <span>{video.channel}</span>
          <span>{video.views}</span>
        </div>
      </div>
    </Link>
  );
}
