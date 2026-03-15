import * as React from "react"

import { cn } from "@/lib/utils"

// Pre-compute base classes to avoid re-parsing on every render
const BASE_TEXTAREA_CLASSES = "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm resize-none will-change-contents"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={className ? cn(BASE_TEXTAREA_CLASSES, className) : BASE_TEXTAREA_CLASSES}
      ref={ref}
      spellCheck={props.spellCheck ?? false}
      autoComplete={props.autoComplete ?? "off"}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
