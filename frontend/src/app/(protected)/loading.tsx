import PageLoader from '@/components/ui/PageLoader';

// Next.js automatically renders this while page segments are loading.
// This covers any navigating to pages inside (protected)/.
export default function Loading() {
    return <PageLoader message="Loading page..." />;
}
