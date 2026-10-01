import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-xl border border-transparent bg-clip-padding text-xs sm:text-sm font-bold whitespace-nowrap transition-all outline-none select-none focus-visible:border-[#4A2E1B] focus-visible:ring-2 focus-visible:ring-[#4A2E1B]/30 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 cursor-pointer [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 gap-2",
  {
    variants: {
      variant: {
        default:
          "bg-[#4A2E1B] hover:bg-[#382214] text-white shadow-sm font-bold active:bg-[#2d1a0e]",
        primary:
          "bg-[#4A2E1B] hover:bg-[#382214] text-white shadow-sm font-bold active:bg-[#2d1a0e]",
        brand:
          "bg-[#4A2E1B] hover:bg-[#382214] text-white shadow-sm font-bold active:bg-[#2d1a0e]",
        accent:
          "bg-[#E87A18] hover:bg-[#d46d13] text-white shadow-sm font-bold active:bg-[#c05e0c]",
        outline:
          "border border-[#EDE4D5] bg-white text-[#4A2E1B] hover:bg-[#FAF6F0] hover:text-[#2C1B10] font-bold shadow-2xs dark:bg-card dark:border-border dark:text-foreground",
        secondary:
          "bg-[#F4ECE1] text-[#4A2E1B] hover:bg-[#ebdccb] font-bold active:bg-[#e2ceb8] dark:bg-muted dark:text-muted-foreground",
        ghost:
          "hover:bg-[#FAF6F0] text-[#4A2E1B] hover:text-[#2C1B10] font-medium dark:hover:bg-muted dark:text-foreground",
        destructive:
          "bg-rose-600 text-white hover:bg-rose-700 shadow-sm font-bold active:bg-rose-800",
        destructiveOutline:
          "border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold",
        success:
          "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm font-bold active:bg-emerald-800",
        link: "text-[#E87A18] underline-offset-4 hover:underline font-semibold p-0 h-auto",
      },
      size: {
        default: "h-10 px-4 py-2 text-xs sm:text-sm rounded-xl font-bold",
        sm: "h-10 px-4 py-2 text-xs sm:text-sm rounded-xl font-bold",
        xs: "h-8 px-2.5 py-1 text-xs rounded-lg font-semibold",
        lg: "h-10 px-4.5 py-2 text-xs sm:text-sm rounded-xl font-bold",
        icon: "size-10 p-0 rounded-xl",
        "icon-sm": "size-8 p-0 rounded-lg",
        "icon-xs": "size-7 p-0 rounded-lg",
        "icon-lg": "size-10 p-0 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends ButtonPrimitive.Props,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
  loadingText?: React.ReactNode
}

function Button({
  className,
  variant = "default",
  size = "default",
  loading = false,
  loadingText,
  disabled,
  children,
  onClick,
  ...props
}: ButtonProps) {
  const [internalLoading, setInternalLoading] = React.useState(false)
  const isLoading = loading || internalLoading

  const handleClick = React.useCallback(
    async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      if (isLoading || disabled) {
        e.preventDefault()
        return
      }
      if (onClick) {
        const result = (onClick as any)(e)
        if (result && typeof result === "object" && typeof result.then === "function") {
          try {
            setInternalLoading(true)
            await result
          } finally {
            setInternalLoading(false)
          }
        }
      }
    },
    [isLoading, disabled, onClick]
  )

  const isIconButton = size ? String(size).startsWith("icon") : false
  const isLink = variant === "link"

  // Standardize sizing: strip legacy arbitrary height overrides unless it is an icon, link, or xs button
  let sanitizedClassName = className
  if (!isIconButton && !isLink && size !== "xs") {
    if (typeof sanitizedClassName === "string") {
      sanitizedClassName = sanitizedClassName
        .replace(/\b(?:xs:|sm:|md:|lg:)?h-(?:6|7|8|9|11|12|14)\b/g, "")
        .replace(/\bmin-h-\[\d+px\]\b/g, "")
        .trim()
    }
  }

  return (
    <ButtonPrimitive
      data-slot="button"
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      onClick={handleClick}
      className={cn(
        buttonVariants({ variant, size, className: sanitizedClassName }),
        isLoading && "cursor-wait opacity-80 pointer-events-none"
      )}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="size-4 animate-spin shrink-0" />
          {loadingText ? (
            <span>{loadingText}</span>
          ) : isIconButton ? null : (
            children
          )}
        </>
      ) : (
        children
      )}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
