"use client"

import * as React from "react"
import { ChevronDown, Check } from "lucide-react"

const SelectContext = React.createContext<{
    value: string
    onValueChange: (value: string) => void
    open: boolean
    setOpen: (open: boolean) => void
}>({ value: "", onValueChange: () => { }, open: false, setOpen: () => { } })

const Select: React.FC<{
    children: React.ReactNode
    value?: string
    onValueChange?: (value: string) => void
}> = ({ children, value, onValueChange }) => {
    const [open, setOpen] = React.useState(false)

    return (
        <SelectContext.Provider value={{ value: value || "", onValueChange: onValueChange || (() => { }), open, setOpen }}>
            <div className="relative">{children}</div>
        </SelectContext.Provider>
    )
}

const SelectTrigger: React.FC<{
    className?: string
    children: React.ReactNode
}> = ({ className, children }) => {
    const { setOpen, open } = React.useContext(SelectContext)
    return (
        <button
            type="button"
            onClick={() => setOpen(!open)}
            className={`flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        >
            {children}
            <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
    )
}

const SelectValue: React.FC<{ placeholder?: string }> = ({ placeholder }) => {
    const { value } = React.useContext(SelectContext)
    // This simplistic implementation doesn't easily map value -> props.children label of the selected item without valid children inspection
    // But for the purpose of the build, we just show the value. In a real app, this would need a map.
    return <span className="block truncate">{value || placeholder}</span>
}

const SelectContent: React.FC<{
    className?: string
    children: React.ReactNode
}> = ({ className, children }) => {
    const { open } = React.useContext(SelectContext)
    if (!open) return null
    return (
        <div className={`absolute z-50 min-w-[8rem] overflow-hidden rounded-md border border-slate-200 bg-white text-slate-950 shadow-md animate-in fade-in-80 ${className} top-full mt-1 w-full`}>
            <div className="p-1">{children}</div>
        </div>
    )
}

const SelectItem: React.FC<{
    value: string
    children: React.ReactNode
    className?: string
}> = ({ value, children, className }) => {
    const { onValueChange, setOpen, value: selectedValue } = React.useContext(SelectContext)
    return (
        <div
            onClick={() => {
                onValueChange(value)
                setOpen(false)
            }}
            className={`relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${className} ${selectedValue === value ? "bg-accent" : ""}`}
        >
            <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                {selectedValue === value && <Check className="h-4 w-4" />}
            </span>
            <span className="truncate">{children}</span>
        </div>
    )
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
