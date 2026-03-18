declare module "use-image" {
  export default function useImage(
    url: string,
    crossOrigin?: "anonymous" | "use-credentials",
    referrerpolicy?:
      | "no-referrer"
      | "no-referrer-when-downgrade"
      | "origin"
      | "origin-when-cross-origin"
      | "same-origin"
      | "strict-origin"
      | "strict-origin-when-cross-origin"
      | "unsafe-url"
  ): [HTMLImageElement | undefined, "loaded" | "loading" | "failed"];
}
