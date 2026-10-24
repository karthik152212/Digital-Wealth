import { Skeleton } from "@/components/ui/skeleton";

export function AssetTableSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-48" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
