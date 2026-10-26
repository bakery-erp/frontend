"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "#FFFDF8",
          "--normal-text": "#2C1B10",
          "--normal-description": "#4A2E1B",
          "--normal-border": "#EDE4D5",
          "--border-radius": "16px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast font-sans shadow-lg rounded-2xl border border-[#EDE4D5] bg-[#FFFDF8] text-[#2C1B10] p-3.5",
          title: "text-[#2C1B10] font-extrabold text-sm tracking-tight",
          description: "!text-[#4A2E1B] font-semibold text-xs leading-relaxed mt-1 opacity-100",
          actionButton: "!bg-[#2C1B10] !text-white hover:!bg-[#4A2E1B] font-bold text-xs rounded-xl px-3 py-1.5 shadow-xs shrink-0",
          cancelButton: "!bg-[#FAF6F0] !text-[#4A2E1B] font-bold text-xs rounded-xl px-3 py-1.5 shrink-0",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
