'use client';

interface PageLoaderProps {
    message?: string;
    fullscreen?: boolean;
}

/**
 * A polished full-page loading spinner.
 * Used for: initial settings load, auth checks, page transitions.
 */
export default function PageLoader({ message = 'Loading...', fullscreen = true }: PageLoaderProps) {
    return (
        <div
            className={`flex flex-col items-center justify-center gap-6 bg-background ${fullscreen ? 'fixed inset-0 z-50' : 'h-full w-full min-h-[200px]'
                }`}
        >
            {/* Animated logo mark */}
            <div className="relative flex items-center justify-center">
                {/* Outer pulse ring */}
                <span className="absolute inline-flex h-16 w-16 animate-ping rounded-full bg-primary/20" />
                {/* Spinning arc */}
                <span className="relative inline-flex h-12 w-12">
                    <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" style={{ animationDuration: '0.8s' }} />
                </span>
            </div>

            {/* Message */}
            <p className="text-sm font-medium text-muted-foreground animate-pulse tracking-wide">
                {message}
            </p>
        </div>
    );
}
