export function Footer() {
  return (
    <footer className="border-t border-border bg-card/30 px-6 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
          <span>Data sourced from the U.S. Department of Justice Epstein Library</span>
          <span className="hidden sm:inline h-3 w-px bg-border" />
          <a
            href="https://justice.gov/epstein"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors underline underline-offset-2"
          >
            justice.gov/epstein
          </a>
        </div>
        <span className="text-[10px]">
          This tool is for research and educational purposes only
        </span>
      </div>
    </footer>
  );
}
