import PageLoader from '@/components/ui/PageLoader';

// Shown while the login page is loading (fonts, settings fetch, etc.)
export default function Loading() {
    return <PageLoader message="Loading..." />;
}
