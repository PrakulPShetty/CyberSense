/// <reference types="vite/client" />

// lucide-react@0.510.0 ships types in dist/ but has no `types` field in
// package.json; the declaration below is a fallback that is superseded by
// the package's own types once a version with a proper exports map is installed.
declare module "lucide-react" {
  export * from "lucide-react/dist/lucide-react";
}
