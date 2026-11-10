import { Button } from "konsta/react";
import type { AnchorHTMLAttributes, ComponentProps } from "react";

type ShelfButtonProps = ComponentProps<typeof Button> & Pick<AnchorHTMLAttributes<HTMLAnchorElement>, "target" | "rel">;

/** Neutral shelf actions use Konsta's public color and shape props. */
export function ShelfButton({ className = "", colors, clear, ...props }: ShelfButtonProps) {
  return <Button rounded clear={clear} {...props} colors={{
    textIos: "text-black dark:text-white",
    fillTextIos: "text-black dark:text-white",
    fillBgIos: "bg-ios-light-glass dark:bg-ios-dark-glass",
    outlineBgIos: "bg-ios-light-glass dark:bg-ios-dark-glass",
    outlineBorderIos: "border-black/15 dark:border-white/15",
    ...colors,
  }} className={`shelf-action ${clear ? "" : "backdrop-blur-lg shadow-ios-light-glass dark:shadow-ios-dark-glass"} ${className}`} />;
}
