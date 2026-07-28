import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Rounded display value with the exact figure on hover/focus.
// Renders plain text when no exact detail is provided (or it adds nothing).
export function ExactValue({ display, exact, className }) {
  if (!exact || exact === display) {
    return <span className={className}>{display}</span>;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={`cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-4 outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] rounded-sm ${className || ''}`}
        >
          {display}
        </span>
      </TooltipTrigger>
      <TooltipContent>{exact}</TooltipContent>
    </Tooltip>
  );
}
