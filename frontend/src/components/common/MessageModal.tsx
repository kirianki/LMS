'use client';

import { useState, useEffect } from 'react';
import { Send, Smartphone, Mail, X, Paperclip, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import api from '@/lib/api';

interface MessageModalProps {
    isOpen: boolean;
    onClose: () => void;
    recipientPhone?: string;
    recipientEmail?: string;
    borrowerId?: string;
    loanId?: string;
    applicationId?: string;
    onSuccess?: () => void;
}

type ChannelType = 'sms' | 'email';
type DocumentType = 'offer_letter' | 'disbursement_letter' | 'loan_statement' | '';

export default function MessageModal({
    isOpen,
    onClose,
    recipientPhone = '',
    recipientEmail = '',
    borrowerId,
    loanId,
    applicationId,
    onSuccess
}: MessageModalProps) {
    const [channel, setChannel] = useState<ChannelType>('sms');
    const [recipient, setRecipient] = useState('');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [documentType, setDocumentType] = useState<DocumentType>('');
    const [isSending, setIsSending] = useState(false);

    // Auto-populate recipient based on channel
    useEffect(() => {
        if (channel === 'sms') {
            setRecipient(recipientPhone);
        } else {
            setRecipient(recipientEmail);
        }
    }, [channel, recipientPhone, recipientEmail]);

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setChannel('sms');
            setRecipient(recipientPhone);
            setSubject('');
            setMessage('');
            setDocumentType('');
        }
    }, [isOpen, recipientPhone]);

    const handleSend = async () => {
        if (!recipient || !message) return;

        setIsSending(true);
        try {
            if (documentType && channel === 'email') {
                // Send with document attachment
                await api.post('/notifications/logs/send_with_document/', {
                    recipient,
                    document_type: documentType,
                    application_id: applicationId,
                    loan_id: loanId,
                    message,
                });
            } else {
                // Standard message send
                await api.post('/notifications/logs/send_manual_message/', {
                    recipient,
                    message,
                    message_type: channel,
                    subject: channel === 'email' ? subject : undefined,
                    borrower_id: borrowerId,
                    loan_id: loanId,
                });
            }

            if (onSuccess) onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Failed to send message:', error);
            alert(error.response?.data?.error || 'Failed to send message');
        } finally {
            setIsSending(false);
        }
    };

    const hasDocumentContext = !!(applicationId || loanId);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Send className="h-5 w-5 text-primary" />
                        Send Message
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Channel Toggle */}
                    <div className="flex rounded-xl border border-border overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setChannel('sms')}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold transition-all ${channel === 'sms'
                                    ? 'bg-blue-500/10 text-blue-500 border-r border-border'
                                    : 'text-muted-foreground hover:bg-muted/50 border-r border-border'
                                }`}
                        >
                            <Smartphone className="h-4 w-4" />
                            SMS
                        </button>
                        <button
                            type="button"
                            onClick={() => setChannel('email')}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold transition-all ${channel === 'email'
                                    ? 'bg-purple-500/10 text-purple-500'
                                    : 'text-muted-foreground hover:bg-muted/50'
                                }`}
                        >
                            <Mail className="h-4 w-4" />
                            Email
                        </button>
                    </div>

                    {/* Recipient */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium leading-none flex items-center gap-2 text-muted-foreground">
                            {channel === 'sms' ? <Smartphone className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                            {channel === 'sms' ? 'Phone Number' : 'Email Address'}
                        </label>
                        <input
                            type={channel === 'sms' ? 'tel' : 'email'}
                            placeholder={channel === 'sms' ? '+254...' : 'borrower@example.com'}
                            value={recipient}
                            onChange={(e) => setRecipient(e.target.value)}
                            className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0 transition-all font-mono"
                        />
                    </div>

                    {/* Subject (Email only) */}
                    {channel === 'email' && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none text-muted-foreground">
                                Subject
                            </label>
                            <input
                                type="text"
                                placeholder="Email subject..."
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0 transition-all"
                            />
                        </div>
                    )}

                    {/* Message */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium leading-none text-muted-foreground">
                            Message Content
                        </label>
                        <textarea
                            placeholder="Type your message here..."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={4}
                            className="flex min-h-[100px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0 resize-none transition-all leading-relaxed"
                        />
                        <p className="text-[10px] text-right text-muted-foreground">
                            {message.length} characters
                        </p>
                    </div>

                    {/* Document Attachment (Email only, when context available) */}
                    {channel === 'email' && hasDocumentContext && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none flex items-center gap-2 text-muted-foreground">
                                <Paperclip className="h-4 w-4" />
                                Attach Document (Optional)
                            </label>
                            <select
                                value={documentType}
                                onChange={(e) => setDocumentType(e.target.value as DocumentType)}
                                className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0 transition-all"
                            >
                                <option value="">No attachment</option>
                                {applicationId && <option value="offer_letter">📄 Offer Letter</option>}
                                {applicationId && <option value="disbursement_letter">📋 Disbursement Checklist</option>}
                                {loanId && <option value="loan_statement">📊 Loan Statement</option>}
                            </select>
                            {documentType && (
                                <p className="text-[10px] text-amber-500 flex items-center gap-1">
                                    <FileText className="h-3 w-3" />
                                    Document will be generated and attached as PDF
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <div className="flex items-center justify-end gap-3 w-full">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-muted transition-colors text-muted-foreground"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSend}
                            disabled={isSending || !recipient || !message || (channel === 'email' && !subject && !documentType)}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 shadow-lg ${channel === 'email'
                                    ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-purple-600/20'
                                    : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20'
                                }`}
                        >
                            {isSending ? (
                                <>
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    {channel === 'email' ? <Mail className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                                    Send {channel === 'email' ? 'Email' : 'SMS'}
                                    {documentType && ' + Doc'}
                                </>
                            )}
                        </button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
