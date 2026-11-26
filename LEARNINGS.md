# Learnings

- Run mutation testing with the repo's `stryker.config.json` (Vitest runner), and outside the Claude
  sandbox. Stryker fails copying the sandbox's masked dotfiles into its temp dir, so a sandboxed run
  errors before testing anything (#311).
