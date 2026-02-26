"use client"

import * as React from "react"
import { X } from "lucide-react"

const DialogContext = React.createContext<{
    open: boolean
    setOpen: (open: boolean) => void
}>({ open: false, setOpen: () => { } })

const Dialog: React.FC<{
    children: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
}> = ({ children, open: controlledOpen, onOpenChange }) => {
    const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
    const isControlled = controlledOpen !== undefined
    const open = isControlled ? controlledOpen : uncontrolledOpen
    const setOpen = React.useCallback((newOpen: boolean) => {
        if (onOpenChange) {
            onOpenChange(newOpen)
        }
        if (!isControlled) {
            setUncontrolledOpen(newOpen)
        }
    }, [onOpenChange, isControlled])

    return (
        <DialogContext.Provider value={{ open, setOpen }}>
            {children}
        </DialogContext.Provider>
    )
}

const DialogTrigger: React.FC<{
    asChild?: boolean
    children: React.ReactNode
}> = ({ children, asChild }) => {
    const { setOpen } = React.useContext(DialogContext)
    // If asChild is true, we clone the child and add onClick, otherwise we wrap in a button (simplified)
    // For safety/speed, we'll just clone the child if it's a valid element, or wrap.
    if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children as React.ReactElement<any>, {
            onClick: (e: React.MouseEvent) => {
                (children.props as any).onClick?.(e);
                setOpen(true);
            }
        })
    }
    return <button onClick={() => setOpen(true)}>{children}</button>
}

const DialogContent: React.FC<{
    children: React.ReactNode
    className?: string
}> = ({ children, className }) => {
    const { open, setOpen } = React.useContext(DialogContext)

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className={`relative w-full max-w-lg rounded-lg bg-white text-slate-950 p-6 shadow-lg border border-slate-200 ${className}`}>
                <button
                    className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100"
                    onClick={() => setOpen(false)}
                >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </button>
                {children}
            </div>
        </div>
    )
}

const DialogHeader: React.FC<{ className?: string, children: React.ReactNode }> = ({
    className,
    children,
}) => (
    <div className={`flex flex-col space-y-1.5 text-center sm:text-left ${className}`}>
        {children}
    </div>
)

const DialogFooter: React.FC<{ className?: string, children: React.ReactNode }> = ({
    className,
    children,
}) => (
    <div className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 ${className}`}>
        {children}
    </div>
)

const DialogTitle: React.FC<{ className?: string, children: React.ReactNode }> = ({
    className,
    children,
}) => (
    <h2 className={`text-lg font-semibold leading-none tracking-tight ${className}`}>
        {children}
    </h2>
)

const DialogDescription: React.FC<{ className?: string, children: React.ReactNode }> = ({
    className,
    children,
}) => (
    <p className={`text-sm text-muted-foreground ${className}`}>
        {children}
    </p>
)

export {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
}
