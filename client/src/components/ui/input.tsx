import * as React from "react"

import { cn } from "@/lib/utils"

// Pre-compute base classes to avoid re-parsing on every render
const BASE_INPUT_CLASSES = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm will-change-contents"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={className ? cn(BASE_INPUT_CLASSES, className) : BASE_INPUT_CLASSES}
        ref={ref}
        spellCheck={props.spellCheck ?? false}
        autoComplete={props.autoComplete ?? "off"}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
