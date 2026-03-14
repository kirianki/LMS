'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Send, User, Clock } from 'lucide-react';
import api from '@/lib/api';

interface Comment {
    id: string;
    author_name: string;
    author_initials: string;
    comment: string;
    comment_type: string;
    created_at: string;
    updated_at: string;
}

interface LoanCommentsSectionProps {
    loanId: string;
}

export default function LoanCommentsSection({ loanId }: LoanCommentsSectionProps) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchComments();
    }, [loanId]);

    const fetchComments = async () => {
        try {
            const response = await api.get(`/loans/${loanId}/comments/`);
            setComments(response.data);
        } catch (error) {
            console.error('Failed to fetch comments:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        setIsSubmitting(true);
        try {
            await api.post(`/loans/${loanId}/comments/`, {
                comment: newComment,
                comment_type: 'general',
                is_internal: true,
            });
            setNewComment('');
            await fetchComments();
        } catch (error) {
            console.error('Failed to post comment:', error);
            alert('Failed to post comment. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Comment Input Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                    <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Add a comment or note about this loan..."
                        className="w-full min-h-[100px] p-4 rounded-2xl border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        disabled={isSubmitting}
                    />
                </div>
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={!newComment.trim() || isSubmitting}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:shadow-lg hover:shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                        <Send className="h-4 w-4" />
                        {isSubmitting ? 'Posting...' : 'Post Comment'}
                    </button>
                </div>
            </form>

            {/* Comments List */}
            <div className="space-y-4">
                {comments.length > 0 ? (
                    comments.map((comment) => (
                        <div
                            key={comment.id}
                            className="group relative flex gap-4 p-5 rounded-2xl border border-border bg-muted/20 hover:bg-background hover:shadow-md transition-all duration-300"
                        >
                            {/* Avatar */}
                            <div className="flex-shrink-0">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-black text-primary border border-primary/20">
                                    {comment.author_initials}
                                </div>
                            </div>

                            {/* Comment Content */}
                            <div className="flex-1 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-foreground">
                                            {comment.author_name}
                                        </span>
                                        <span className="text-xs text-muted-foreground">•</span>
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {formatDate(comment.created_at)}
                                        </span>
                                    </div>
                                    {comment.comment_type !== 'general' && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                                            {comment.comment_type.replace('_', ' ')}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed break-words overflow-hidden">
                                    {comment.comment}
                                </p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-12 border-2 border-dashed border-border rounded-3xl">
                        <MessageSquare className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                        <h4 className="text-lg font-bold text-foreground">No Comments Yet</h4>
                        <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                            Be the first to add a comment or note about this loan.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
